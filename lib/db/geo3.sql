-- Economic Statecraft Monitor — Geospatial layer, Phase 3 migration
-- Run in the Supabase SQL editor AFTER geo.sql and geo2.sql. Idempotent.
-- Adds GeoJSON export functions used by `npm run export:tiles` to pre-generate
-- the static map layers served from Supabase Storage (Vercel constraint:
-- heavy geometry never goes through serverless functions).

-- Facilities as a point FeatureCollection, filtered by type.
-- (Ports + LNG + cable landings ≈ small; the 400k power plants are
-- deliberately NOT exported — they would overwhelm the browser.)
CREATE OR REPLACE FUNCTION export_facility_points(p_types TEXT[])
RETURNS JSONB AS $$
  SELECT jsonb_build_object('type', 'FeatureCollection', 'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(geom, 5)::jsonb,
      'properties', jsonb_build_object('name', name, 'ftype', facility_type, 'iso3', country_iso3)
    )), '[]'::jsonb))
  FROM facilities WHERE facility_type = ANY(p_types);
$$ LANGUAGE sql STABLE;

-- Chinese finance projects as representative points.
-- Computing points from 4,900+ (often huge, multi-site) geometries at export
-- time blows Supabase's statement timeout — so the display point is computed
-- ONCE, stored in geom_point, and the export just reads the column.
-- (ST_PointOnSurface errors on GeometryCollection, hence the centroid fallback.)
ALTER TABLE cn_finance_projects ADD COLUMN IF NOT EXISTS geom_point geometry(Point, 4326);

-- Backfill for already-loaded projects (few seconds; re-runs only touch new rows).
UPDATE cn_finance_projects
SET geom_point = CASE WHEN GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON')
                      THEN ST_PointOnSurface(geom)
                      ELSE ST_Centroid(geom) END
WHERE geom_point IS NULL AND geom IS NOT NULL AND NOT ST_IsEmpty(geom);

-- Loader upsert now maintains geom_point for future loads (supersedes geo2.sql).
CREATE OR REPLACE FUNCTION upsert_cn_project(
  p_ref TEXT, p_title TEXT, p_sector TEXT, p_commitment_usd BIGINT,
  p_year INTEGER, p_status TEXT, p_iso3 TEXT, p_geojson TEXT
) RETURNS VOID AS $$
DECLARE g geometry;
BEGIN
  g := ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326);
  INSERT INTO cn_finance_projects
    (project_ref, title, sector, commitment_usd, year, status, country_iso3, geom, geom_point, loaded_at)
  VALUES
    (p_ref, p_title, p_sector, p_commitment_usd, p_year, p_status,
     NULLIF(p_iso3, ''), g,
     CASE WHEN g IS NULL OR ST_IsEmpty(g) THEN NULL
          WHEN GeometryType(g) IN ('POLYGON', 'MULTIPOLYGON') THEN ST_PointOnSurface(g)
          ELSE ST_Centroid(g) END,
     NOW())
  ON CONFLICT (project_ref) DO UPDATE SET
    title = EXCLUDED.title, sector = EXCLUDED.sector,
    commitment_usd = EXCLUDED.commitment_usd, year = EXCLUDED.year,
    status = EXCLUDED.status, country_iso3 = EXCLUDED.country_iso3,
    geom = EXCLUDED.geom, geom_point = EXCLUDED.geom_point, loaded_at = NOW();
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION export_cn_points()
RETURNS JSONB AS $$
  SELECT jsonb_build_object('type', 'FeatureCollection', 'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(geom_point, 5)::jsonb,
      'properties', jsonb_build_object(
        'title', LEFT(title, 160), 'sector', sector, 'usd', commitment_usd,
        'year', year, 'status', status, 'iso3', country_iso3)
    )), '[]'::jsonb))
  FROM cn_finance_projects WHERE geom_point IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- Per-country Chinese commitment aggregates (choropleth + white-space input).
CREATE OR REPLACE FUNCTION export_cn_country_sums()
RETURNS JSONB AS $$
  SELECT COALESCE(jsonb_object_agg(country_iso3, jsonb_build_object('usd', total, 'count', cnt)), '{}'::jsonb)
  FROM (
    SELECT country_iso3, SUM(COALESCE(commitment_usd, 0))::bigint AS total, COUNT(*) AS cnt
    FROM cn_finance_projects WHERE country_iso3 IS NOT NULL GROUP BY country_iso3
  ) t;
$$ LANGUAGE sql STABLE;

-- US agency activity as country-centroid points (records carry no precise geom).
CREATE OR REPLACE FUNCTION export_us_activity_points()
RETURNS JSONB AS $$
  SELECT jsonb_build_object('type', 'FeatureCollection', 'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', jsonb_build_object('type', 'Point', 'coordinates',
        jsonb_build_array(round(c.centroid_lon::numeric, 4), round(c.centroid_lat::numeric, 4))),
      'properties', jsonb_build_object(
        'name', LEFT(u.project_name, 160), 'agency', u.agency, 'rtype', u.record_type,
        'sector', u.sector, 'usd', u.value_usd, 'leading', u.is_leading_indicator, 'iso3', u.country_iso3)
    )), '[]'::jsonb))
  FROM us_activity u JOIN countries c ON c.iso3 = u.country_iso3
  WHERE c.centroid_lon IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- Cables (user-licensed data; empty collection when none loaded).
CREATE OR REPLACE FUNCTION export_cables()
RETURNS JSONB AS $$
  SELECT jsonb_build_object('type', 'FeatureCollection', 'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.05), 4)::jsonb,
      'properties', jsonb_build_object('name', name, 'rfs', rfs_year)
    )), '[]'::jsonb))
  FROM cables WHERE geom IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- EEZ boundaries, aggressively simplified for display.
CREATE OR REPLACE FUNCTION export_eez_display()
RETURNS JSONB AS $$
  SELECT jsonb_build_object('type', 'FeatureCollection', 'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(COALESCE(geom_display, geom), 0.1), 3)::jsonb,
      'properties', jsonb_build_object('name', name, 'sovereign', sovereign)
    )), '[]'::jsonb))
  FROM eez WHERE COALESCE(geom_display, geom) IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- Country polygons for the choropleth (already low-res Natural Earth 110m).
CREATE OR REPLACE FUNCTION export_countries_display()
RETURNS JSONB AS $$
  SELECT jsonb_build_object('type', 'FeatureCollection', 'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.05), 3)::jsonb,
      'properties', jsonb_build_object('iso3', iso3, 'name', name)
    )), '[]'::jsonb))
  FROM countries WHERE geom IS NOT NULL;
$$ LANGUAGE sql STABLE;
