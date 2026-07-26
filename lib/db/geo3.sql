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

-- Chinese finance projects as representative points (full geometry stays in DB).
CREATE OR REPLACE FUNCTION export_cn_points()
RETURNS JSONB AS $$
  SELECT jsonb_build_object('type', 'FeatureCollection', 'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(ST_PointOnSurface(geom), 5)::jsonb,
      'properties', jsonb_build_object(
        'title', LEFT(title, 160), 'sector', sector, 'usd', commitment_usd,
        'year', year, 'status', status, 'iso3', country_iso3)
    )), '[]'::jsonb))
  FROM cn_finance_projects WHERE geom IS NOT NULL;
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
