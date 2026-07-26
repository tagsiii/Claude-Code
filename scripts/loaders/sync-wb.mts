// World Bank Projects API → mdb_pipeline.
// Endpoint + shape verified via user probe: search.worldbank.org/api/v3/projects
// returns { total, projects: { P123: {...} } }. Paged, resumable by upsert.

import { getDb, startRunLog, finishRunLog, tryDownload } from './_shared.mts';
import { wbProjectToMdb } from '../../lib/geo/activityParsers.ts';

const BASE = 'https://search.worldbank.org/api/v3/projects';
const PAGE_SIZE = 200;
const MAX_ROWS = 6000; // most-recent slice is what matters for pipeline signals

const db = getDb();
const logId = await startRunLog(db, 'sync:wb');

try {
  let ok = 0;
  let scanned = 0;
  let zeroSampleShown = false;
  const errors: string[] = [];

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const url = `${BASE}?format=json&rows=${PAGE_SIZE}&os=${offset}&order=desc&srt=boardapprovaldate`;
    const raw = await tryDownload(url, 90_000);
    if (!raw) { if (offset === 0) throw new Error('World Bank API unreachable'); break; }

    let parsed: { projects?: Record<string, Record<string, unknown>> };
    try { parsed = JSON.parse(raw); } catch { errors.push(`offset ${offset}: non-JSON response`); break; }
    const projects = Object.values(parsed.projects ?? {});
    if (projects.length === 0) break;
    scanned += projects.length;

    const rows = projects
      .map(wbProjectToMdb)
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        bank: r.bank, project_ref: r.projectRef, name: r.name, country_iso3: r.iso3,
        sector: r.sector, status: r.status, value_usd: r.valueUsd, source: 'wb_projects_api',
      }));

    if (rows.length === 0 && !zeroSampleShown && projects.length > 0) {
      console.log(`  ⚠ page parsed 0 rows. Sample keys: ${Object.keys(projects[0]).slice(0, 30).join(' | ')}`);
      zeroSampleShown = true;
    }
    if (rows.length > 0) {
      const { error, count } = await db.from('mdb_pipeline').upsert(rows, { onConflict: 'bank,project_ref', count: 'exact' });
      if (error) { if (errors.length < 5) errors.push(error.message.slice(0, 160)); }
      else ok += count ?? rows.length;
    }
    console.log(`  … ${scanned} scanned, ${ok} upserted`);
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log(`World Bank: ${ok} projects in mdb_pipeline (${scanned} scanned)`);
  await finishRunLog(db, logId, errors.length === 0, { found: scanned, created: ok }, {
    loader: 'wb', ...(errors.length ? { errors } : {}),
  });
  if (errors.length) process.exit(1);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`sync:wb failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'wb' }, msg);
  process.exit(1);
}
