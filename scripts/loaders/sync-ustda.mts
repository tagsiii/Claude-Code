// USTDA press-release feed → us_activity (feasibility studies etc.,
// is_leading_indicator=true — these drive the flag_us_positioning signal).
// Uses the standard WordPress REST API (verified reachable via user probe).
// Zero AI tokens: pure keyword country/sector extraction.

import { getDb, startRunLog, finishRunLog, tryDownload , upsertWithRetry } from './_shared.mts';
import { ustdaPostToActivity } from '../../lib/geo/activityParsers.ts';

const BASE = 'https://www.ustda.gov/wp-json/wp/v2/posts';
const MAX_PAGES = 10; // 100/page → up to 1000 recent releases

const db = getDb();
const logId = await startRunLog(db, 'sync:ustda');

try {
  let ok = 0;
  let scanned = 0;
  const errors: string[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const raw = await tryDownload(`${BASE}?per_page=100&page=${page}&_fields=id,date,link,title,excerpt`, 60_000);
    if (!raw) {
      if (page === 1) throw new Error('USTDA feed unreachable');
      break; // past the last page
    }
    let posts: unknown[];
    try { posts = JSON.parse(raw); } catch { break; }
    if (!Array.isArray(posts) || posts.length === 0) break;
    scanned += posts.length;

    const rows = posts
      .map((p) => ustdaPostToActivity(p as never))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        agency: r.agency, record_type: r.recordType, project_name: r.projectName,
        country_iso3: r.iso3, sector: r.sector, value_usd: r.valueUsd,
        announced_date: r.announcedDate, is_leading_indicator: true,
        source_url: r.sourceUrl, source: 'ustda_press',
      }));

    if (rows.length > 0) {
      const { error, count } = await upsertWithRetry(db, 'us_activity', rows, 'agency,project_name,country_iso3');
      if (error) { if (errors.length < 5) errors.push(error); }
      else ok += count;
    }
    await new Promise((r) => setTimeout(r, 800)); // be polite
  }

  console.log(`USTDA: ${ok} leading-indicator records from ${scanned} press releases`);
  await finishRunLog(db, logId, errors.length === 0, { found: scanned, created: ok }, {
    loader: 'ustda', ...(errors.length ? { errors } : {}),
  });
  if (errors.length) process.exit(1);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`sync:ustda failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'ustda' }, msg);
  process.exit(1);
}
