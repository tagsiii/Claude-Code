-- Economic Statecraft Monitor — Geospatial layer, Phase 4 migration
-- Run in the Supabase SQL editor AFTER geo.sql, geo2.sql, geo3.sql. Idempotent.
-- Adds: deterministic spatial-flag computation (apply_spatial_flags), the three
-- gap materialized views, their refresh function, and white-space snapshots
-- for the briefing email's change detection.

-- ─── Sector vocabulary bridge ─────────────────────────────────────────────────
-- Deals use the app enum (strategic_infrastructure/…); activity records use
-- keyword-derived keys (ports/digital/power/…). This mapping is the single
-- source of truth for cross-matching them.
CREATE OR REPLACE FUNCTION deal_sector_activity_keys(p_sector TEXT)
RETURNS TEXT[] AS $$
  SELECT CASE p_sector
    WHEN 'strategic_infrastructure' THEN ARRAY['ports','rail','aviation','minerals','water']
    WHEN 'digital_connectivity'     THEN ARRAY['digital']
    WHEN 'cybersecurity'            THEN ARRAY['digital']
    WHEN 'energy'                   THEN ARRAY['power','oil_gas','renewables','nuclear']
    ELSE ARRAY[]::TEXT[]
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ─── Gap materialized views ───────────────────────────────────────────────────
-- Small aggregate views; refreshed after scans / recompute:spatial. Plain
-- REFRESH (not CONCURRENTLY) because the refresh function runs inside a
-- transaction where CONCURRENTLY is disallowed — these views are tiny
-- (dozens–hundreds of rows), so the lock is milliseconds.

-- Countries in the top tier of Chinese commitments (≥ 60th percentile) with
-- ZERO recorded US activity — China contests the space, nobody is on the field.
DROP MATERIALIZED VIEW IF EXISTS mv_white_space;
CREATE MATERIALIZED VIEW mv_white_space AS
  WITH sums AS (
    SELECT country_iso3 AS iso3,
           SUM(COALESCE(commitment_usd, 0))::BIGINT AS cn_usd,
           COUNT(*) AS cn_count,
           MAX(year) AS latest_year
    FROM cn_finance_projects
    WHERE country_iso3 IS NOT NULL
    GROUP BY country_iso3
  ), cut AS (
    SELECT PERCENTILE_CONT(0.6) WITHIN GROUP (ORDER BY cn_usd) AS p60 FROM sums
  )
  SELECT s.iso3, COALESCE(c.name, s.iso3) AS country_name,
         s.cn_usd, s.cn_count, s.latest_year
  FROM sums s CROSS JOIN cut
  LEFT JOIN countries c ON c.iso3 = s.iso3
  WHERE s.cn_usd >= cut.p60 AND s.cn_usd > 0
    AND NOT EXISTS (SELECT 1 FROM us_activity u WHERE u.country_iso3 = s.iso3)
  ORDER BY s.cn_usd DESC;
CREATE UNIQUE INDEX idx_mv_white_space ON mv_white_space(iso3);

-- Upcoming MDB projects with no matching-sector US activity in the country —
-- a financing train leaving with no US car attached.
DROP MATERIALIZED VIEW IF EXISTS mv_unpositioned_pipeline;
CREATE MATERIALIZED VIEW mv_unpositioned_pipeline AS
  SELECT m.bank, m.project_ref, m.name, m.country_iso3 AS iso3,
         COALESCE(c.name, m.country_iso3) AS country_name, m.sector, m.value_usd
  FROM mdb_pipeline m
  LEFT JOIN countries c ON c.iso3 = m.country_iso3
  WHERE m.status = 'pipeline' AND m.country_iso3 IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM us_activity u
      WHERE u.country_iso3 = m.country_iso3
        AND (m.sector IS NULL OR u.sector IS NULL OR u.sector = m.sector)
    )
  ORDER BY m.value_usd DESC NULLS LAST;
CREATE UNIQUE INDEX idx_mv_unpositioned ON mv_unpositioned_pipeline(bank, project_ref);

-- Chinese money piling into ONE sector of one country (≥40% of a ≥$500M total).
DROP MATERIALIZED VIEW IF EXISTS mv_sector_concentration;
CREATE MATERIALIZED VIEW mv_sector_concentration AS
  WITH per AS (
    SELECT country_iso3 AS iso3, COALESCE(sector, 'unspecified') AS sector,
           SUM(COALESCE(commitment_usd, 0))::BIGINT AS usd, COUNT(*) AS cnt
    FROM cn_finance_projects
    WHERE country_iso3 IS NOT NULL
    GROUP BY 1, 2
  ), tot AS (
    SELECT iso3, SUM(usd) AS total FROM per GROUP BY iso3
  )
  SELECT p.iso3, COALESCE(c.name, p.iso3) AS country_name, p.sector, p.usd, p.cnt,
         ROUND(100.0 * p.usd / NULLIF(t.total, 0), 1) AS share_pct
  FROM per p
  JOIN tot t USING (iso3)
  LEFT JOIN countries c ON c.iso3 = p.iso3
  WHERE t.total >= 500000000 AND p.usd > 0
    AND 100.0 * p.usd / NULLIF(t.total, 0) >= 40
  ORDER BY p.usd DESC;
CREATE UNIQUE INDEX idx_mv_sector_conc ON mv_sector_concentration(iso3, sector);

CREATE OR REPLACE FUNCTION refresh_gap_views() RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_white_space;
  REFRESH MATERIALIZED VIEW mv_unpositioned_pipeline;
  REFRESH MATERIALIZED VIEW mv_sector_concentration;
END $$ LANGUAGE plpgsql;

-- Snapshots of the white-space country set — the email diffs against the last
-- one and stays silent when nothing changed.
CREATE TABLE IF NOT EXISTS white_space_snapshots (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  iso3s    TEXT[] NOT NULL,
  detail   JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE white_space_snapshots ENABLE ROW LEVEL SECURITY;

-- ─── Spatial flags ────────────────────────────────────────────────────────────
-- Computes all five flags for one deal, writes them (with plain-English
-- reasons) onto the row, and returns them as JSONB with flag_-prefixed keys so
-- the caller can spread them straight into scoring. Fully deterministic.
CREATE OR REPLACE FUNCTION apply_spatial_flags(p_deal_id UUID)
RETURNS JSONB AS $$
DECLARE
  d RECORD;
  keys TEXT[];
  v_near BOOLEAN := FALSE; v_near_r TEXT := NULL;
  v_ws   BOOLEAN := FALSE; v_ws_r   TEXT := NULL;
  v_con  BOOLEAN := FALSE; v_con_r  TEXT := NULL;
  v_usp  BOOLEAN := FALSE; v_usp_r  TEXT := NULL;
  v_mdb  BOOLEAN := FALSE; v_mdb_r  TEXT := NULL;
  rec RECORD;
BEGIN
  SELECT id, geom, location_precision, country_iso3, facility_id, sector
    INTO d FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  keys := deal_sector_activity_keys(d.sector);

  -- 1. Near cable landing: within 25 km of a landing station. Only for real
  --    site locations — a country centroid near a coast would fire spuriously.
  IF d.geom IS NOT NULL AND d.location_precision IN ('exact', 'facility', 'city') THEN
    SELECT f.name, ROUND((ST_Distance(d.geom::geography, f.geom::geography) / 1000.0)::numeric, 1) AS km
      INTO rec
      FROM facilities f
      WHERE f.facility_type = 'cable_landing'
        AND ST_DWithin(d.geom::geography, f.geom::geography, 25000)
      ORDER BY d.geom <-> f.geom
      LIMIT 1;
    IF FOUND THEN
      v_near := TRUE;
      v_near_r := 'Within 25 km of submarine cable landing "' || rec.name || '" (' || rec.km || ' km)';
    END IF;
  END IF;

  -- 2. White space: host country in the top tier of Chinese commitments with
  --    zero recorded US activity (mv_white_space, refreshed post-scan).
  IF d.country_iso3 IS NOT NULL THEN
    SELECT ws.cn_usd, ws.cn_count INTO rec FROM mv_white_space ws WHERE ws.iso3 = d.country_iso3;
    IF FOUND THEN
      v_ws := TRUE;
      v_ws_r := 'Host country holds $' || ROUND((rec.cn_usd / 1e9)::numeric, 1) ||
                'B across ' || rec.cn_count || ' Chinese-financed projects with zero recorded US activity';
    END IF;
  END IF;

  -- 3. Contested asset: the deal's resolved facility sits within 10 km of a
  --    Chinese-financed project while US programs are active in the country.
  IF d.facility_id IS NOT NULL AND d.country_iso3 IS NOT NULL THEN
    SELECT p.title INTO rec
      FROM cn_finance_projects p
      JOIN facilities f ON f.id = d.facility_id
      WHERE p.geom_point IS NOT NULL
        AND ST_DWithin(f.geom::geography, p.geom_point::geography, 10000)
      LIMIT 1;
    IF FOUND AND EXISTS (SELECT 1 FROM us_activity u WHERE u.country_iso3 = d.country_iso3) THEN
      v_con := TRUE;
      v_con_r := 'Facility within 10 km of Chinese-financed "' || LEFT(rec.title, 100) ||
                 '" while US programs are active in the country';
    END IF;
  END IF;

  -- 4. US positioning: a leading indicator (e.g. USTDA feasibility study)
  --    already exists for this country in a compatible sector.
  IF d.country_iso3 IS NOT NULL THEN
    SELECT u.agency, u.project_name INTO rec
      FROM us_activity u
      WHERE u.country_iso3 = d.country_iso3 AND u.is_leading_indicator
        AND (u.sector IS NULL OR cardinality(keys) = 0 OR u.sector = ANY(keys))
      ORDER BY u.announced_date DESC NULLS LAST
      LIMIT 1;
    IF FOUND THEN
      v_usp := TRUE;
      v_usp_r := rec.agency || ' leading indicator in-country: "' || LEFT(rec.project_name, 100) || '"';
    END IF;
  END IF;

  -- 5. Unpositioned MDB pipeline: an upcoming MDB project matches this
  --    country+sector and no US agency has any matching activity there.
  IF d.country_iso3 IS NOT NULL THEN
    SELECT m.bank, m.name INTO rec
      FROM mdb_pipeline m
      WHERE m.country_iso3 = d.country_iso3 AND m.status = 'pipeline'
        AND (m.sector IS NULL OR cardinality(keys) = 0 OR m.sector = ANY(keys))
        AND NOT EXISTS (
          SELECT 1 FROM us_activity u
          WHERE u.country_iso3 = d.country_iso3
            AND (u.sector IS NULL OR cardinality(keys) = 0 OR u.sector = ANY(keys))
        )
      ORDER BY m.value_usd DESC NULLS LAST
      LIMIT 1;
    IF FOUND THEN
      v_mdb := TRUE;
      v_mdb_r := rec.bank || ' pipeline project "' || LEFT(rec.name, 100) || '" has no matching US activity';
    END IF;
  END IF;

  UPDATE deals SET
    flag_near_cable_landing = v_near, flag_near_cable_landing_reason = v_near_r,
    flag_white_space        = v_ws,   flag_white_space_reason        = v_ws_r,
    flag_contested_asset    = v_con,  flag_contested_asset_reason    = v_con_r,
    flag_us_positioning     = v_usp,  flag_us_positioning_reason     = v_usp_r,
    flag_unpositioned_mdb   = v_mdb,  flag_unpositioned_mdb_reason   = v_mdb_r
  WHERE id = p_deal_id;

  RETURN jsonb_build_object(
    'flag_near_cable_landing', v_near, 'flag_near_cable_landing_reason', v_near_r,
    'flag_white_space', v_ws, 'flag_white_space_reason', v_ws_r,
    'flag_contested_asset', v_con, 'flag_contested_asset_reason', v_con_r,
    'flag_us_positioning', v_usp, 'flag_us_positioning_reason', v_usp_r,
    'flag_unpositioned_mdb', v_mdb, 'flag_unpositioned_mdb_reason', v_mdb_r
  );
END $$ LANGUAGE plpgsql;
