-- Economic Statecraft Monitor — Database Schema
-- Run this in your Supabase SQL editor (or psql)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin','analyst')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── NextAuth Sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires       TIMESTAMPTZ NOT NULL
);

-- ─── Deals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                             TEXT NOT NULL,
  slug                              TEXT UNIQUE,
  sponsoring_state                  TEXT,
  sponsoring_entities               JSONB NOT NULL DEFAULT '[]',
  host_country                      TEXT,
  host_region                       TEXT,
  sector                            TEXT NOT NULL CHECK (sector IN (
                                      'strategic_infrastructure','digital_connectivity',
                                      'energy','cybersecurity','other')),
  subsector                         TEXT,
  lifecycle_stage                   TEXT NOT NULL DEFAULT 'rumored' CHECK (lifecycle_stage IN (
                                      'rumored','exploratory_mou','negotiation','signed',
                                      'financing_secured','under_construction','completed','cancelled')),
  lifecycle_reasoning               TEXT,
  lifecycle_inferred_at             TIMESTAMPTZ,
  rom_value_usd                     BIGINT,
  rom_value_min                     BIGINT,
  rom_value_max                     BIGINT,
  rom_basis                         TEXT,
  financial_sponsors                JSONB NOT NULL DEFAULT '[]',
  is_confirmed                      BOOLEAN NOT NULL DEFAULT FALSE,
  executive_summary                 TEXT,
  executive_summary_generated_at    TIMESTAMPTZ,
  us_diplomatic_context             TEXT,
  us_diplomatic_context_generated_at TIMESTAMPTZ,
  composite_score                   NUMERIC(5,2),
  score_breakdown                   JSONB,
  score_calculated_at               TIMESTAMPTZ,
  source_count                      INTEGER NOT NULL DEFAULT 0,
  source_confidence_tier            INTEGER NOT NULL DEFAULT 3 CHECK (source_confidence_tier IN (1,2,3)),
  status                            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','duplicate')),
  first_seen_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_composite_score ON deals(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_deals_sector ON deals(sector);
CREATE INDEX IF NOT EXISTS idx_deals_sponsoring_state ON deals(sponsoring_state);
CREATE INDEX IF NOT EXISTS idx_deals_lifecycle_stage ON deals(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_last_updated ON deals(last_updated_at DESC);

-- ─── Sources ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url              TEXT UNIQUE NOT NULL,
  title            TEXT,
  published_at     TIMESTAMPTZ,
  retrieved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connector        TEXT NOT NULL,
  confidence_tier  INTEGER NOT NULL DEFAULT 2 CHECK (confidence_tier IN (1,2,3)),
  content_excerpt  TEXT
);

CREATE INDEX IF NOT EXISTS idx_sources_connector ON sources(connector);
CREATE INDEX IF NOT EXISTS idx_sources_retrieved_at ON sources(retrieved_at DESC);

-- ─── Deal ↔ Source junction ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_sources (
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  source_id       UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (deal_id, source_id)
);

-- ─── Timeline Events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  event_date  DATE,
  description TEXT NOT NULL,
  source_id   UUID REFERENCES sources(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_events_deal_id ON deal_events(deal_id, event_date DESC);

-- ─── Score Configuration ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS score_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  weight      NUMERIC(5,4) NOT NULL,
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO score_config (name, weight, description) VALUES
  ('likelihood',         0.3000, 'Likelihood to close — deal maturity and lifecycle stage'),
  ('actionability',      0.3000, 'US actionability window — runway and leverage to counter, compete, or support'),
  ('financing',          0.2000, 'Financing certainty — sponsor identified and funds committed'),
  ('corroboration',      0.1000, 'Source corroboration and confidence — number and quality of independent sources'),
  ('strategic_priority', 0.1000, 'Strategic priority intensity — sector rank plus actor-of-concern weight')
ON CONFLICT (name) DO NOTHING;

-- ─── Connector Configuration ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connector_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at  TIMESTAMPTZ,
  config       JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO connector_config (name, display_name, enabled) VALUES
  ('gdelt',       'GDELT Global News',         TRUE),
  ('worldbank',   'World Bank Projects',       TRUE),
  ('newsapi',     'NewsAPI',                   FALSE),
  ('gnews',       'GNews',                     FALSE),
  ('adb',         'Asian Development Bank',    FALSE),
  ('state_dept',  'US State Department',       FALSE)
ON CONFLICT (name) DO NOTHING;

-- ─── Ingest Logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingest_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector      TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  deals_found    INTEGER NOT NULL DEFAULT 0,
  deals_created  INTEGER NOT NULL DEFAULT 0,
  deals_updated  INTEGER NOT NULL DEFAULT 0,
  error_message  TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'
);

-- ─── Email Logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient     TEXT NOT NULL,
  deal_ids      UUID[],
  status        TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT
);

-- ─── Helper: auto-update last_updated_at on deals ────────────────────────────
CREATE OR REPLACE FUNCTION update_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_updated_at ON deals;
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_last_updated_at();
