-- Economic Statecraft Monitor — Geospatial layer, Phase 2 migration
-- Run in the Supabase SQL editor AFTER geo.sql. Idempotent.
-- Adds the geometry-writing helpers used by the Phase-2 loaders
-- (AidData Chinese finance projects, Marine Regions EEZ).

-- AidData GCDF project upsert (geometry arrives as GeoJSON, mixed types).
CREATE OR REPLACE FUNCTION upsert_cn_project(
  p_ref TEXT, p_title TEXT, p_sector TEXT, p_commitment_usd BIGINT,
  p_year INTEGER, p_status TEXT, p_iso3 TEXT, p_geojson TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO cn_finance_projects
    (project_ref, title, sector, commitment_usd, year, status, country_iso3, geom, loaded_at)
  VALUES
    (p_ref, p_title, p_sector, p_commitment_usd, p_year, p_status,
     NULLIF(p_iso3, ''), ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326), NOW())
  ON CONFLICT (project_ref) DO UPDATE SET
    title = EXCLUDED.title, sector = EXCLUDED.sector,
    commitment_usd = EXCLUDED.commitment_usd, year = EXCLUDED.year,
    status = EXCLUDED.status, country_iso3 = EXCLUDED.country_iso3,
    geom = EXCLUDED.geom, loaded_at = NOW();
END $$ LANGUAGE plpgsql;

-- EEZ upsert: stores the full polygon and a simplified display copy for the map.
CREATE OR REPLACE FUNCTION upsert_eez(
  p_name TEXT, p_sovereign TEXT, p_geojson TEXT
) RETURNS VOID AS $$
DECLARE g geometry;
BEGIN
  g := ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326);
  INSERT INTO eez (name, sovereign, geom, geom_display, loaded_at)
  VALUES (p_name, p_sovereign, g, ST_SimplifyPreserveTopology(g, 0.05), NOW())
  ON CONFLICT (lower(name)) DO UPDATE SET
    sovereign = EXCLUDED.sovereign, geom = EXCLUDED.geom,
    geom_display = EXCLUDED.geom_display, loaded_at = NOW();
END $$ LANGUAGE plpgsql;
