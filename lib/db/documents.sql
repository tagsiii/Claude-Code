-- Economic Statecraft Monitor — Attachment Ingestion schema
-- Run this in your Supabase SQL editor AFTER schema.sql.
-- Adds the `documents` table (uploaded Word/Excel/PDF/text files) and the
-- private Storage bucket that holds the original files.

-- ─── Uploaded Documents ────────────────────────────────────────────────────────
-- Each uploaded file is recorded here, parsed to text, then fed through the SAME
-- extract → dedup → merge → score pipeline as the news connectors. Because an
-- uploaded doc is analyst-provided primary material, it is treated as a tier-1
-- (official/primary) source, which boosts the corroboration score of any deal
-- it touches.
CREATE TABLE IF NOT EXISTS documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename       TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  byte_size      BIGINT NOT NULL DEFAULT 0,
  sha256         TEXT,                         -- content hash → dedupe identical uploads
  storage_path   TEXT NOT NULL,                -- path within the private Storage bucket
  kind           TEXT NOT NULL DEFAULT 'other' CHECK (kind IN (
                   'word','excel','pdf','csv','text','other')),
  parsed_text    TEXT,                         -- extracted text used for analysis
  page_count     INTEGER,
  char_count     INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
                   'uploaded','parsing','parsed','analyzing','analyzed','error')),
  error_message  TEXT,
  -- links + outcomes once analyzed
  source_id      UUID REFERENCES sources(id) ON DELETE SET NULL,
  deals_found    INTEGER NOT NULL DEFAULT 0,
  deals_created  INTEGER NOT NULL DEFAULT 0,
  deals_updated  INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,                         -- optional analyst note attached at upload
  uploaded_by    TEXT,                         -- email of the uploading user
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  analyzed_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256) WHERE sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Lock the table to service_role only (app uses the service key, which bypasses RLS).
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- ─── Storage bucket for original files ─────────────────────────────────────────
-- Private bucket; only the service_role key (used server-side) can read/write.
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-documents', 'deal-documents', FALSE)
ON CONFLICT (id) DO NOTHING;
