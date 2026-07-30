-- Data-quality vetting migration. Run in the Supabase SQL editor. Idempotent.
-- Adds: quality grade + components, independent-source counting, field-level
-- provenance, review workflow (pending/approved/rejected), AidData
-- cross-reference stamps, richer enrichment storage, and a domain blocklist.

-- ─── Deals: quality + provenance + review columns ────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS data_quality_grade CHAR(1)
  CHECK (data_quality_grade IN ('A','B','C','D'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS quality_components JSONB;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS independent_source_count INTEGER NOT NULL DEFAULT 1;
-- provenance: { field: { source: "outlet/url", date: "YYYY-MM-DD" } }
ALTER TABLE deals ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb;
-- enrichment_details: { financing_structure, counterparties[], milestones[], verification }
ALTER TABLE deals ADD COLUMN IF NOT EXISTS enrichment_details JSONB;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (review_status IN ('pending','approved','rejected'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS review_note TEXT;
-- Official-record cross-reference (AidData GCDF)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS xref_cn_ref TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS xref_note TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_corroborated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_deals_review_status ON deals(review_status);
CREATE INDEX IF NOT EXISTS idx_deals_quality_grade ON deals(data_quality_grade);

-- ─── Analyst triage workflow ──────────────────────────────────────────────────
-- act = needs action · watching = monitor · dismissed = hidden from default
-- views. triaged_at lets the UI flag deals that CHANGED since you last judged
-- them (last_updated_at > triaged_at).
ALTER TABLE deals ADD COLUMN IF NOT EXISTS triage_status TEXT NOT NULL DEFAULT 'none'
  CHECK (triage_status IN ('none','act','watching','dismissed'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS triage_note TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_deals_triage ON deals(triage_status);

-- Existing rows predate the review workflow — they stay approved (default).

-- ─── Domain rules: outlets the analyst has blocked ───────────────────────────
CREATE TABLE IF NOT EXISTS domain_rules (
  domain     TEXT PRIMARY KEY,          -- registrable domain, e.g. "example.com"
  action     TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('block')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE domain_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON domain_rules FROM anon, authenticated;

-- ─── AidData cross-reference: fuzzy title match within the host country ──────
-- Best-effort corroboration of a news-extracted deal against the official
-- Chinese-finance record. Uses trigram similarity; caller applies thresholds.
CREATE OR REPLACE FUNCTION match_cn_project(p_title TEXT, p_iso3 TEXT)
RETURNS TABLE (project_ref TEXT, title TEXT, commitment_usd BIGINT, year INTEGER, sim REAL) AS $$
  SELECT p.project_ref, p.title, p.commitment_usd, p.year,
         similarity(lower(p.title), lower(p_title)) AS sim
  FROM cn_finance_projects p
  WHERE p.country_iso3 = p_iso3
    AND similarity(lower(p.title), lower(p_title)) >= 0.25
  ORDER BY sim DESC
  LIMIT 3;
$$ LANGUAGE sql STABLE;
