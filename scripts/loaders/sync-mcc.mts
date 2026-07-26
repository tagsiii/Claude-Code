// MCC country program data → us_activity (record_type 'compact').
// MCC's open-data portal splits data into ~50 per-country pages (bot-blocked),
// but the same data is published to the IATI Registry — which is built for
// programmatic access, key-free. Flow: registry search for the MCC publisher →
// fetch its IATI activity XML resources → parse → upsert.
// If the publisher search comes back empty, the organizations found for a
// looser query are printed so the publisher id can be corrected from real data.

import { getDb, startRunLog, finishRunLog, tryDownload , upsertWithRetry } from './_shared.mts';
import { iatiActivitiesToRows, mccIatiToActivity } from '../../lib/geo/activityParsers.ts';

const REGISTRY = 'https://iatiregistry.org/api/3/action/package_search';
const PUBLISHER_CANDIDATES = ['millenniumchallenge', 'mcc', 'millennium-challenge-corporation'];
const MAX_RESOURCES = 60;

interface CkanPackage {
  organization?: { name?: string; title?: string };
  resources?: Array<{ url?: string; format?: string }>;
}

const db = getDb();
const logId = await startRunLog(db, 'sync:mcc');

try {
  // 1. Find MCC's publisher datasets on the registry.
  let packages: CkanPackage[] = [];
  for (const pub of PUBLISHER_CANDIDATES) {
    const raw = await tryDownload(`${REGISTRY}?fq=organization:${pub}&rows=100`, 60_000);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const results: CkanPackage[] = parsed?.result?.results ?? [];
      if (results.length > 0) { packages = results; console.log(`Registry publisher '${pub}': ${results.length} datasets`); break; }
    } catch { /* try next candidate */ }
  }

  if (packages.length === 0) {
    // Diagnostics: show which organizations a loose search DOES find.
    const raw = await tryDownload(`${REGISTRY}?q=millennium+challenge&rows=10`, 60_000);
    if (raw) {
      try {
        const results: CkanPackage[] = JSON.parse(raw)?.result?.results ?? [];
        const orgs = [...new Set(results.map((r) => r.organization?.name).filter(Boolean))];
        console.log(`  ⚠ publisher candidates found nothing. Orgs matching 'millennium challenge': ${orgs.join(', ') || 'none'}`);
      } catch { /* fall through */ }
    }
    throw new Error('MCC publisher not found on IATI registry — see ⚠ line above for the real publisher id');
  }

  // 2. Fetch + parse each XML resource.
  const resources = packages
    .flatMap((p) => p.resources ?? [])
    .filter((r) => r.url && (r.format ?? '').toLowerCase().includes('xml') || (r.url ?? '').endsWith('.xml'))
    .slice(0, MAX_RESOURCES);
  console.log(`${resources.length} XML resources to fetch`);

  let ok = 0;
  let activities = 0;
  const errors: string[] = [];
  for (const res of resources) {
    const xml = await tryDownload(res.url!, 90_000);
    if (!xml) { if (errors.length < 5) errors.push(`${res.url}: download failed`); continue; }
    const parsed = iatiActivitiesToRows(xml);
    activities += parsed.length;
    const rows = parsed
      .map((r) => mccIatiToActivity(r, res.url ?? null))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        agency: r.agency, record_type: r.recordType, project_name: r.projectName,
        country_iso3: r.iso3, sector: r.sector, value_usd: r.valueUsd,
        announced_date: r.announcedDate, is_leading_indicator: false,
        source_url: r.sourceUrl, source: 'mcc_iati',
      }));
    if (rows.length > 0) {
      const { error, count } = await upsertWithRetry(db, 'us_activity', rows, 'agency,project_name,country_iso3');
      if (error) { if (errors.length < 5) errors.push(error); }
      else ok += count;
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  if (activities === 0 && resources.length > 0) {
    console.log('  ⚠ resources fetched but zero IATI activities parsed — paste this whole output back');
  }
  console.log(`MCC: ${ok} compact/program records from ${activities} IATI activities`);
  await finishRunLog(db, logId, errors.length === 0, { found: activities, created: ok }, {
    loader: 'mcc', ...(errors.length ? { errors } : {}),
  });
  if (errors.length) { console.error('Issues:', errors); process.exit(1); }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`sync:mcc failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'mcc' }, msg);
  process.exit(1);
}
