-- Row-Level Security lockdown. Run in the Supabase SQL editor. Idempotent.
--
-- Fixes the Supabase security advisor finding "rls_disabled_in_public":
-- the base-schema tables were created without RLS, leaving them readable and
-- writable by anyone holding the project URL + anon key. The app accesses the
-- database EXCLUSIVELY through the service-role key (which bypasses RLS), so
-- enabling RLS with NO policies locks the public out completely while
-- changing nothing about how the app works.

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_sources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs       ENABLE ROW LEVEL SECURITY;

-- Views and materialized views can't carry RLS — they are protected by
-- revoking API-role access instead. The service role keeps its own grants,
-- so the app and the loaders are unaffected. Wrapped so this file also runs
-- cleanly on a database where geo3/geo4 haven't been applied yet.
DO $$
DECLARE v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY['deals_geo', 'mv_white_space', 'mv_unpositioned_pipeline', 'mv_sector_concentration']
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', v);
    EXCEPTION WHEN undefined_table THEN
      NULL; -- not created yet — geo3.sql / geo4.sql will be run later
    END;
  END LOOP;
END $$;

-- Belt-and-braces: also revoke direct API-role table access. RLS-without-
-- policies already denies everything, but this removes even the ability to
-- issue queries that return empty sets.
REVOKE ALL ON users, sessions, deals, sources, deal_sources, deal_events,
  score_config, connector_config, ingest_logs, email_logs
  FROM anon, authenticated;
