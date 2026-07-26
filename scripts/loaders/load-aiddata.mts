// AidData GeoGCDF v3 → cn_finance_projects.
// Auto-fetches per-project GeoJSONs from the aiddata/gcdf-geospatial-data
// GitHub repo (format verified live: features[0].properties carries id, Title,
// Recipient.ISO-3, Amount.(Constant.USD.2021), Status, Sector.Name,
// Commitment.Year). RESUMABLE: already-loaded project_refs are skipped, so an
// interrupted run just continues on re-run. ~6k files ≈ 20-40 min first time.

import { getDb, startRunLog, finishRunLog, tryDownload } from './_shared.mts';
import { aidDataProjectToRow } from '../../lib/geo/activityParsers.ts';

const TREE_URL = 'https://api.github.com/repos/aiddata/gcdf-geospatial-data/git/trees/main?recursive=1';
const RAW_BASE = 'https://raw.githubusercontent.com/aiddata/gcdf-geospatial-data/main/';
const CONCURRENCY = 6;

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

  // 3. Fetch + upsert with modest concurrency.
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (path) => {
        try {
          const raw = await tryDownload(RAW_BASE + path, 60_000);
          if (!raw) throw new Error('download failed');
          const row = aidDataProjectToRow(JSON.parse(raw));
          if (!row) throw new Error('unparseable properties');
          const { error } = await db.rpc('upsert_cn_project', {
            p_ref: row.projectRef, p_title: row.title, p_sector: row.sector,
            p_commitment_usd: row.commitmentUsd, p_year: row.year, p_status: row.status,
            p_iso3: row.iso3 ?? '', p_geojson: row.geometryJson,
          });
          if (error) throw new Error(error.message);
          ok++;
        } catch (err) {
          failed++;
          if (errors.length < 8) errors.push(`${path}: ${err instanceof Error ? err.message : err}`.slice(0, 140));
        }
      })
    );
    if ((i / CONCURRENCY) % 50 === 0 && i > 0) console.log(`  … ${i}/${pending.length} (ok ${ok}, failed ${failed})`);
  }

  console.log(`Loaded ${ok} Chinese finance projects (${failed} failed, ${existing.size} pre-existing)`);
  await finishRunLog(db, logId, failed === 0, { found: pending.length, created: ok }, {
    loader: 'aiddata', pre_existing: existing.size, ...(errors.length ? { errors } : {}),
  });
  if (failed > 0) process.exit(1);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`load:aiddata failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'aiddata' }, msg);
  process.exit(1);
}
