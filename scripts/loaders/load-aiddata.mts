// AidData GeoGCDF v3 → cn_finance_projects.
// Auto-fetches per-project GeoJSONs from the aiddata/gcdf-geospatial-data
// GitHub repo (format verified live: features[0].properties carries id, Title,
// Recipient.ISO-3, Amount.(Constant.USD.2021), Status, Sector.Name,
// Commitment.Year). RESUMABLE: already-loaded project_refs are skipped, so an
// interrupted run just continues on re-run. ~6k files ≈ 20-40 min first time.

import { getDb, startRunLog, finishRunLog, tryDownload, downloadWithStatus } from './_shared.mts';
import { aidDataProjectToRow } from '../../lib/geo/activityParsers.ts';

const TREE_URL = 'https://api.github.com/repos/aiddata/gcdf-geospatial-data/git/trees/main?recursive=1';
const RAW_BASE = 'https://raw.githubusercontent.com/aiddata/gcdf-geospatial-data/main/';
// GitHub's raw host rate-limits sustained bulk fetching. Stay gentle: low
// concurrency + pacing, cool down on throttle responses, and halt early on a
// sustained lockout — the loader is resumable, so a later re-run continues.
const CONCURRENCY = 2;
const BATCH_DELAY_MS = 400;
const THROTTLE_COOLDOWN_MS = 90_000;
const CONSECUTIVE_FAILURE_HALT = 25;

const db = getDb();
const logId = await startRunLog(db, 'load:aiddata');

try {
  // 1. Enumerate project GeoJSONs via the git tree (single API call).
  const treeRaw = await tryDownload(TREE_URL, 120_000);
  if (!treeRaw) throw new Error('Could not list the AidData repo (GitHub API unreachable or rate-limited — retry in an hour)');
  const tree: { tree?: Array<{ path: string }>; truncated?: boolean } = JSON.parse(treeRaw);
  const paths = (tree.tree ?? [])
    .map((t) => t.path)
    .filter((p) => /^latest\/geojsons\/\d+\.geojson$/.test(p));
  if (paths.length === 0) throw new Error('No project GeoJSONs found in repo tree — repo layout may have changed');
  console.log(`AidData repo lists ${paths.length} project GeoJSONs${tree.truncated ? ' (tree truncated!)' : ''}`);

  // 2. Resume support: skip already-loaded projects.
  const existing = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('cn_finance_projects').select('project_ref').range(from, from + 999);
    (data ?? []).forEach((r) => r.project_ref && existing.add(r.project_ref as string));
    if (!data || data.length < 1000) break;
  }
  const pending = paths.filter((p) => !existing.has(p.match(/(\d+)\.geojson$/)![1]));
  console.log(`${existing.size} already loaded, ${pending.length} to fetch`);

  // 3. Fetch + upsert, throttle-aware.
  let ok = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let halted = false;
  const errors: string[] = [];

  for (let i = 0; i < pending.length && !halted; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(
      batch.map(async (path): Promise<'ok' | 'throttled' | 'failed'> => {
        try {
          let res = await downloadWithStatus(RAW_BASE + path, 60_000);
          if (res && (res.status === 429 || res.status === 403)) return 'throttled';
          if (!res || res.status !== 200) throw new Error(`HTTP ${res?.status ?? 'network error'}`);
          const row = aidDataProjectToRow(JSON.parse(res.text));
          if (!row) throw new Error('unparseable properties');
          const { error } = await db.rpc('upsert_cn_project', {
            p_ref: row.projectRef, p_title: row.title, p_sector: row.sector,
            p_commitment_usd: row.commitmentUsd, p_year: row.year, p_status: row.status,
            p_iso3: row.iso3 ?? '', p_geojson: row.geometryJson,
          });
          if (error) throw new Error(error.message);
          return 'ok';
        } catch (err) {
          if (errors.length < 8) errors.push(`${path}: ${err instanceof Error ? err.message : err}`.slice(0, 140));
          return 'failed';
        }
      })
    );

    const throttledCount = outcomes.filter((o) => o === 'throttled').length;
    ok += outcomes.filter((o) => o === 'ok').length;
    failed += outcomes.filter((o) => o === 'failed').length;

    if (throttledCount > 0) {
      // Rate-limited: cool down once, then retry the same batch by rewinding.
      console.log(`  … rate-limited by GitHub at ${i}/${pending.length} — cooling down ${THROTTLE_COOLDOWN_MS / 1000}s`);
      await new Promise((r) => setTimeout(r, THROTTLE_COOLDOWN_MS));
      consecutiveFailures += throttledCount;
      i -= CONCURRENCY; // retry this batch after the cooldown
    } else if (outcomes.every((o) => o === 'failed')) {
      consecutiveFailures += outcomes.length;
    } else {
      consecutiveFailures = 0;
    }

    if (consecutiveFailures >= CONSECUTIVE_FAILURE_HALT) {
      halted = true;
      console.log(
        `\nHalting: GitHub is persistently rate-limiting this IP. ` +
          `${ok + existing.size} projects are loaded so far — re-run "npm run load:aiddata" in ~1 hour; it resumes automatically.`
      );
    }

    if ((i / CONCURRENCY) % 100 === 0 && i > 0) console.log(`  … ${i}/${pending.length} (ok ${ok}, failed ${failed})`);
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(`Loaded ${ok} Chinese finance projects this run (${failed} failed, ${existing.size} pre-existing)`);
  await finishRunLog(db, logId, failed === 0 && !halted, { found: pending.length, created: ok }, {
    loader: 'aiddata', pre_existing: existing.size,
    ...(halted ? { halted_early: 'github rate limit — resume later' } : {}),
    ...(errors.length ? { errors } : {}),
  });
  if (failed > 0 || halted) process.exit(1);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`load:aiddata failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'aiddata' }, msg);
  process.exit(1);
}
