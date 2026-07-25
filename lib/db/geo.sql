-- Economic Statecraft Monitor — Geospatial layer, Phase 1 migration
-- Run in the Supabase SQL editor AFTER schema.sql (and documents.sql).
-- Idempotent: safe to re-run.

-- ─── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Deals: the "where" columns ────────────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS location_precision TEXT
  CHECK (location_precision IN ('exact','facility','city','country_centroid','unknown'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS facility_id UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS country_iso3 CHAR(3);

-- Spatial signal flags (computed deterministically on create/merge; Phase 4
-- fills them — columns exist now so the scorer contract is stable).
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_near_cable_landing BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_near_cable_landing_reason TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_white_space BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_white_space_reason TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_contested_asset BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_contested_asset_reason TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_us_positioning BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_us_positioning_reason TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_unpositioned_mdb BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS flag_unpositioned_mdb_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_deals_geom ON deals USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_deals_country_iso3 ON deals(country_iso3);
CREATE INDEX IF NOT EXISTS idx_deals_facility_id ON deals(facility_id);

-- ─── Facilities: unified gazetteer (WPI + Global Energy Monitor + cable landings)
CREATE TABLE IF NOT EXISTS facilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  aliases       TEXT[] NOT NULL DEFAULT '{}',
  facility_type TEXT NOT NULL CHECK (facility_type IN
                  ('port','power_plant','lng_terminal','pipeline','mine','rail','cable_landing','other')),
  country_iso3  CHAR(3),
  geom          geometry(Point, 4326) NOT NULL,
  source        TEXT NOT NULL,
  source_ref    TEXT,
  loaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_facilities_geom ON facilities USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_facilities_name_trgm ON facilities USING GIN (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_facilities_country ON facilities(country_iso3);
CREATE UNIQUE INDEX IF NOT EXISTS idx_facilities_natural_key
  ON facilities (facility_type, coalesce(country_iso3,'---'), lower(name));

ALTER TABLE deals
  DROP CONSTRAINT IF EXISTS deals_facility_id_fkey;
ALTER TABLE deals
  ADD CONSTRAINT deals_facility_id_fkey FOREIGN KEY (facility_id)
  REFERENCES facilities(id) ON DELETE SET NULL;

-- ─── Countries: Natural Earth admin-0 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS countries (
  iso3          CHAR(3) PRIMARY KEY,
  name          TEXT NOT NULL,
  continent     TEXT,
  un_region     TEXT,
  subregion     TEXT,
  geom          geometry(MultiPolygon, 4326),
  centroid      geometry(Point, 4326),
  centroid_lon  DOUBLE PRECISION,
  centroid_lat  DOUBLE PRECISION,
  source        TEXT NOT NULL DEFAULT 'natural_earth',
  loaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_countries_geom ON countries USING GIST (geom);

-- ─── Sponsors: canonical entity resolution ────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT UNIQUE NOT NULL,
  aliases        TEXT[] NOT NULL DEFAULT '{}',
  country_iso3   CHAR(3),
  is_state_backed BOOLEAN NOT NULL DEFAULT FALSE,
  entity_type    TEXT NOT NULL DEFAULT 'private' CHECK (entity_type IN
                   ('soe','policy_bank','dfi','private','sovereign_fund','agency')),
  needs_review   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sponsors_name_trgm ON sponsors USING GIN (lower(canonical_name) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS deal_sponsors (
  deal_id    UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  PRIMARY KEY (deal_id, sponsor_id)
);

INSERT INTO sponsors (canonical_name, aliases, country_iso3, is_state_backed, entity_type) VALUES
  ('China Exim Bank', ARRAY['China Exim','Export-Import Bank of China','CEXIM'], 'CHN', TRUE, 'policy_bank'),
  ('China Development Bank', ARRAY['CDB'], 'CHN', TRUE, 'policy_bank'),
  ('Silk Road Fund', ARRAY[]::text[], 'CHN', TRUE, 'sovereign_fund'),
  ('AIIB', ARRAY['Asian Infrastructure Investment Bank'], 'CHN', TRUE, 'policy_bank'),
  ('Sinosure', ARRAY['China Export & Credit Insurance Corporation'], 'CHN', TRUE, 'policy_bank'),
  ('COSCO', ARRAY['COSCO Shipping','COSCO Shipping Ports','China COSCO Shipping','China Ocean Shipping Company'], 'CHN', TRUE, 'soe'),
  ('China Merchants', ARRAY['China Merchants Port','China Merchants Group','China Merchants Port Holdings','CMPort'], 'CHN', TRUE, 'soe'),
  ('CCCC', ARRAY['China Communications Construction','China Communications Construction Company','China Harbour','China Harbour Engineering','CHEC','China Road and Bridge Corporation','CRBC'], 'CHN', TRUE, 'soe'),
  ('CRCC', ARRAY['China Railway Construction Corporation','China Railway Construction'], 'CHN', TRUE, 'soe'),
  ('China Railway Group', ARRAY['CREC','China Railway Engineering'], 'CHN', TRUE, 'soe'),
  ('PowerChina', ARRAY['Power Construction Corporation of China','PowerChina International'], 'CHN', TRUE, 'soe'),
  ('Sinohydro', ARRAY['Sinohydro Corporation'], 'CHN', TRUE, 'soe'),
  ('State Grid', ARRAY['State Grid Corporation of China','SGCC'], 'CHN', TRUE, 'soe'),
  ('CNPC', ARRAY['China National Petroleum Corporation','PetroChina'], 'CHN', TRUE, 'soe'),
  ('Sinopec', ARRAY['China Petroleum & Chemical Corporation'], 'CHN', TRUE, 'soe'),
  ('CGN', ARRAY['China General Nuclear','China General Nuclear Power Group'], 'CHN', TRUE, 'soe'),
  ('CNNC', ARRAY['China National Nuclear Corporation'], 'CHN', TRUE, 'soe'),
  ('Huawei', ARRAY['Huawei Technologies','Huawei Marine'], 'CHN', TRUE, 'soe'),
  ('ZTE', ARRAY['ZTE Corporation'], 'CHN', TRUE, 'soe'),
  ('Rosatom', ARRAY['Rosatom State Corporation','Atomstroyexport'], 'RUS', TRUE, 'soe'),
  ('Gazprom', ARRAY['Gazprom Neft'], 'RUS', TRUE, 'soe'),
  ('Rosneft', ARRAY[]::text[], 'RUS', TRUE, 'soe'),
  ('Russian Railways', ARRAY['RZD'], 'RUS', TRUE, 'soe'),
  ('Rostec', ARRAY[]::text[], 'RUS', TRUE, 'soe'),
  ('DP World', ARRAY['Dubai Ports World','DPW'], 'ARE', TRUE, 'soe'),
  ('AD Ports', ARRAY['AD Ports Group','Abu Dhabi Ports'], 'ARE', TRUE, 'soe'),
  ('Mubadala', ARRAY['Mubadala Investment Company'], 'ARE', TRUE, 'sovereign_fund'),
  ('ADIA', ARRAY['Abu Dhabi Investment Authority'], 'ARE', TRUE, 'sovereign_fund'),
  ('Public Investment Fund', ARRAY['PIF','Saudi Public Investment Fund'], 'SAU', TRUE, 'sovereign_fund'),
  ('ACWA Power', ARRAY[]::text[], 'SAU', TRUE, 'soe'),
  ('Masdar', ARRAY['Abu Dhabi Future Energy Company'], 'ARE', TRUE, 'soe'),
  ('Qatar Investment Authority', ARRAY['QIA'], 'QAT', TRUE, 'sovereign_fund'),
  ('DFC', ARRAY['U.S. International Development Finance Corporation','US International Development Finance Corporation'], 'USA', TRUE, 'agency'),
  ('EXIM', ARRAY['Export-Import Bank of the United States','US EXIM','U.S. EXIM'], 'USA', TRUE, 'agency'),
  ('USTDA', ARRAY['U.S. Trade and Development Agency','US Trade and Development Agency'], 'USA', TRUE, 'agency'),
  ('MCC', ARRAY['Millennium Challenge Corporation'], 'USA', TRUE, 'agency')
ON CONFLICT (canonical_name) DO NOTHING;

-- ─── Reference tables (loaders fill these; Phase 2 for most) ──────────────────
CREATE TABLE IF NOT EXISTS cables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  geom           geometry(Geometry, 4326),
  owners         TEXT[] NOT NULL DEFAULT '{}',
  rfs_year       INTEGER,
  source         TEXT NOT NULL DEFAULT 'user_provided',
  loaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cables_geom ON cables USING GIST (geom);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cables_name ON cables (lower(name));

CREATE TABLE IF NOT EXISTS cn_finance_projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_ref    TEXT UNIQUE,
  title          TEXT NOT NULL,
  sector         TEXT,
  commitment_usd BIGINT,
  year           INTEGER,
  status         TEXT,
  country_iso3   CHAR(3),
  geom           geometry(Geometry, 4326),
  source         TEXT NOT NULL DEFAULT 'aiddata_gcdf3',
  loaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cnfin_geom ON cn_finance_projects USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_cnfin_country ON cn_finance_projects(country_iso3);

CREATE TABLE IF NOT EXISTS us_activity (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency         TEXT NOT NULL CHECK (agency IN ('DFC','USTDA','EXIM','MCC')),
  record_type    TEXT NOT NULL CHECK (record_type IN
                   ('investment','feasibility_study','authorization','compact','framework')),
  project_name   TEXT NOT NULL,
  country_iso3   CHAR(3),
  sector         TEXT,
  value_usd      BIGINT,
  announced_date DATE,
  is_leading_indicator BOOLEAN NOT NULL DEFAULT FALSE,
  geom           geometry(Point, 4326),
  source_url     TEXT,
  source         TEXT NOT NULL,
  loaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency, project_name, country_iso3)
);
CREATE INDEX IF NOT EXISTS idx_usact_geom ON us_activity USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_usact_country ON us_activity(country_iso3);

CREATE TABLE IF NOT EXISTS mdb_pipeline (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank         TEXT NOT NULL,
  project_ref  TEXT NOT NULL,
  name         TEXT NOT NULL,
  country_iso3 CHAR(3),
  sector       TEXT,
  status       TEXT NOT NULL CHECK (status IN ('pipeline','active','closed')),
  value_usd    BIGINT,
  geom         geometry(Point, 4326),
  source       TEXT NOT NULL,
  loaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bank, project_ref)
);
CREATE INDEX IF NOT EXISTS idx_mdb_geom ON mdb_pipeline USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_mdb_country ON mdb_pipeline(country_iso3);

CREATE TABLE IF NOT EXISTS intl_finance (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor          TEXT NOT NULL,
  country_iso3   CHAR(3) NOT NULL,
  sector         TEXT NOT NULL,
  year           INTEGER NOT NULL,
  commitment_usd BIGINT NOT NULL DEFAULT 0,
  source         TEXT NOT NULL,
  loaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (donor, country_iso3, sector, year)
);

CREATE TABLE IF NOT EXISTS eez (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  sovereign TEXT,
  geom      geometry(Geometry, 4326),
  geom_display geometry(Geometry, 4326),  -- simplified copy for the map
  source    TEXT NOT NULL DEFAULT 'marine_regions',
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eez_geom ON eez USING GIST (geom);
CREATE UNIQUE INDEX IF NOT EXISTS idx_eez_name ON eez (lower(name));

-- ─── Row Level Security (service_role bypasses; anon locked out) ──────────────
ALTER TABLE facilities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_sponsors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cables              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cn_finance_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_activity         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdb_pipeline        ENABLE ROW LEVEL SECURITY;
ALTER TABLE intl_finance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE eez                 ENABLE ROW LEVEL SECURITY;

-- ─── RPC helpers (called from loaders + pipeline via supabase-js) ─────────────

-- Upsert a point facility by natural key (type, country, name).
CREATE OR REPLACE FUNCTION upsert_facility(
  p_name TEXT, p_type TEXT, p_iso3 TEXT, p_lon DOUBLE PRECISION, p_lat DOUBLE PRECISION,
  p_source TEXT, p_source_ref TEXT DEFAULT NULL, p_aliases TEXT[] DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO facilities (name, facility_type, country_iso3, geom, source, source_ref, aliases)
  VALUES (p_name, p_type, NULLIF(p_iso3,''), ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326), p_source, p_source_ref, p_aliases)
  ON CONFLICT (facility_type, coalesce(country_iso3,'---'), lower(name))
  DO UPDATE SET geom = EXCLUDED.geom, source = EXCLUDED.source,
                source_ref = COALESCE(EXCLUDED.source_ref, facilities.source_ref),
                aliases = EXCLUDED.aliases, loaded_at = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$ LANGUAGE plpgsql;

-- Upsert a country from a GeoJSON geometry string; computes centroid columns.
CREATE OR REPLACE FUNCTION upsert_country(
  p_iso3 TEXT, p_name TEXT, p_continent TEXT, p_un_region TEXT, p_subregion TEXT, p_geojson TEXT
) RETURNS VOID AS $$
DECLARE g geometry;
BEGIN
  g := ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(p_geojson)), 4326);
  INSERT INTO countries (iso3, name, continent, un_region, subregion, geom, centroid, centroid_lon, centroid_lat, loaded_at)
  VALUES (p_iso3, p_name, p_continent, p_un_region, p_subregion, g,
          ST_PointOnSurface(g), ST_X(ST_PointOnSurface(g)), ST_Y(ST_PointOnSurface(g)), NOW())
  ON CONFLICT (iso3) DO UPDATE SET
    name = EXCLUDED.name, continent = EXCLUDED.continent, un_region = EXCLUDED.un_region,
    subregion = EXCLUDED.subregion, geom = EXCLUDED.geom, centroid = EXCLUDED.centroid,
    centroid_lon = EXCLUDED.centroid_lon, centroid_lat = EXCLUDED.centroid_lat, loaded_at = NOW();
END $$ LANGUAGE plpgsql;

-- Upsert a cable from GeoJSON (LineString/MultiLineString).
CREATE OR REPLACE FUNCTION upsert_cable(
  p_name TEXT, p_geojson TEXT, p_owners TEXT[], p_rfs_year INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO cables (name, geom, owners, rfs_year, loaded_at)
  VALUES (p_name, ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326), p_owners, p_rfs_year, NOW())
  ON CONFLICT (lower(name)) DO UPDATE SET
    geom = EXCLUDED.geom, owners = EXCLUDED.owners, rfs_year = EXCLUDED.rfs_year, loaded_at = NOW();
END $$ LANGUAGE plpgsql;

-- Facility matcher: exact/alias first, trigram similarity fallback.
-- Same-country required when both sides know the country.
CREATE OR REPLACE FUNCTION match_facility(p_name TEXT, p_iso3 TEXT DEFAULT NULL)
RETURNS TABLE (id UUID, name TEXT, facility_type TEXT, country_iso3 CHAR(3),
               lon DOUBLE PRECISION, lat DOUBLE PRECISION, match_score REAL) AS $$
  WITH candidates AS (
    SELECT f.id, f.name, f.facility_type, f.country_iso3,
           ST_X(f.geom) AS lon, ST_Y(f.geom) AS lat,
           GREATEST(
             CASE WHEN lower(f.name) = lower(p_name) THEN 1.0
                  WHEN EXISTS (SELECT 1 FROM unnest(f.aliases) a WHERE lower(a) = lower(p_name)) THEN 0.99
                  ELSE 0 END,
             similarity(lower(f.name), lower(p_name))
           )::real AS match_score
    FROM facilities f
    WHERE (p_iso3 IS NULL OR f.country_iso3 IS NULL OR f.country_iso3 = p_iso3)
  )
  SELECT * FROM candidates WHERE match_score >= 0.45
  ORDER BY match_score DESC LIMIT 3;
$$ LANGUAGE sql STABLE;

-- Trigram sponsor fallback for strings the pure alias matcher missed.
CREATE OR REPLACE FUNCTION resolve_sponsor_fuzzy(p_name TEXT)
RETURNS TABLE (id UUID, canonical_name TEXT, match_score REAL) AS $$
  SELECT s.id, s.canonical_name, similarity(lower(s.canonical_name), lower(p_name))::real
  FROM sponsors s
  WHERE similarity(lower(s.canonical_name), lower(p_name)) >= 0.5
  ORDER BY 3 DESC LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Write a deal's location.
CREATE OR REPLACE FUNCTION set_deal_location(
  p_deal_id UUID, p_lon DOUBLE PRECISION, p_lat DOUBLE PRECISION,
  p_precision TEXT, p_facility_id UUID DEFAULT NULL, p_iso3 TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE deals SET
    geom = ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326),
    location_precision = p_precision,
    facility_id = COALESCE(p_facility_id, facility_id),
    country_iso3 = COALESCE(NULLIF(p_iso3,''), country_iso3)
  WHERE id = p_deal_id;
END $$ LANGUAGE plpgsql;

-- Lightweight geo projection of deals for the map (Phase 3 consumes this).
CREATE OR REPLACE VIEW deals_geo AS
  SELECT id, title, sector, lifecycle_stage, composite_score, rom_value_usd,
         status, country_iso3, location_precision, facility_id,
         ST_X(geom) AS lon, ST_Y(geom) AS lat
  FROM deals
  WHERE geom IS NOT NULL;
