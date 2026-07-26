// OECD CRS commitment aggregates → intl_finance (country-level, no geometry).
// Donors per spec: Japan, Korea, EU institutions, India is not a CRS reporter
// (skipped), Gulf funds (Saudi Arabia, UAE, Kuwait report to CRS).
// Uses the OECD SDMX API (reachable per user probe) in SDMX-CSV form.
// The exact dataflow key can shift between OECD releases; on failure the
// response head is printed so the query can be corrected against real errors.

import { getDb, startRunLog, finishRunLog , upsertWithRetry } from './_shared.mts';
import { parseCsv } from '../../lib/geo/parsers.ts';
import { oecdCsvRowToFinance } from '../../lib/geo/activityParsers.ts';

// DAC donor codes: Japan 701, Korea 742, EU Institutions 918, Saudi 566? —
// CRS donor dimension uses these labels in the DF_CRS dataflow.
const DONORS = ['JPN', 'KOR', '4EU001', 'SAU', 'ARE', 'KWT'];
const START_YEAR = 2018;

// The DF_CRS dataflow is an *external reference* hosted on the dcd-public
// service (probe-verified: structureURL points there), and OECD bumps its
// version between releases (1.3 → 1.6 broke the original pinned URL). So:
// discover the current version from the catalog, then try both hosts.
const CATALOG_URL = 'https://sdmx.oecd.org/public/rest/dataflow/OECD.DCD.FSD';
const DATA_BASES = [
  'https://sdmx.oecd.org/dcd-public/rest/data',
  'https://sdmx.oecd.org/public/rest/data',
];
const FALLBACK_VERSION = '1.6'; // probe-verified 2026-07

const db = getDb();
const logId = await startRunLog(db, 'sync:oecd');

async function discoverCrsVersion(): Promise<string> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(CATALOG_URL, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return FALLBACK_VERSION;
    const xml = await res.text();
    const m = xml.match(/<structure:Dataflow[^>]*\bid="DSD_CRS@DF_CRS"[^>]*\bversion="([^"]+)"/)
      ?? xml.match(/\bversion="([^"]+)"[^>]*\bid="DSD_CRS@DF_CRS"/);
    if (m) {
      console.log(`Catalog: DSD_CRS@DF_CRS is at version ${m[1]}`);
      return m[1];
    }
  } catch { /* fall through */ }
  return FALLBACK_VERSION;
}

async function fetchCsv(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 120_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.sdmx.data+csv, text/csv' },
    });
    clearTimeout(t);
    const text = await res.text();
    if (!res.ok) {
      console.log(`  ⚠ HTTP ${res.status} — ${text.slice(0, 200).replace(/\s+/g, ' ')}`);
      return null;
    }
    return text;
  } catch (err) {
    console.log(`  ⚠ fetch failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

try {
  let ok = 0;
  let parsed = 0;
  const errors: string[] = [];

  const version = await discoverCrsVersion();
  // The working host is remembered after the first donor succeeds.
  let goodBase: string | null = null;

  for (const donor of DONORS) {
    // DSD_CRS@DF_CRS: DONOR.RECIPIENT.SECTOR.FLOW.CHANNEL.MODALITY.MEASURE.PRICE_BASE.PERIOD
    // Query commitments (measure 1140? use default) for all recipients, total sector.
    const key = `${donor}..1000.100._T._T.C.Q._T?startPeriod=${START_YEAR}&dimensionAtObservation=AllDimensions&format=csvfilewithlabels`;
    console.log(`OECD CRS: donor ${donor}…`);
    let csv: string | null = null;
    for (const base of goodBase ? [goodBase] : DATA_BASES) {
      csv = await fetchCsv(`${base}/OECD.DCD.FSD,DSD_CRS@DF_CRS,${version}/${key}`);
      if (csv) { goodBase = base; break; }
    }
    if (!csv) { errors.push(`${donor}: query failed (see output above)`); continue; }

    const rows = parseCsv(csv);
    if (rows.length < 2) { errors.push(`${donor}: empty result`); continue; }
    const header = rows[0];
    const records = rows.slice(1).map((r) => {
      const rec: Record<string, string> = {};
      header.forEach((h, i) => { rec[h] = r[i] ?? ''; });
      return rec;
    });

    const finRows = records
      .map(oecdCsvRowToFinance)
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        donor: r.donor, country_iso3: r.iso3, sector: r.sector, year: r.year,
        commitment_usd: r.commitmentUsd, source: 'oecd_crs',
      }));
    parsed += finRows.length;

    for (let i = 0; i < finRows.length; i += 500) {
      const { error, count } = await upsertWithRetry(db, 'intl_finance', finRows.slice(i, i + 500), 'donor,country_iso3,sector,year');
      if (error) { if (errors.length < 5) errors.push(error); }
      else ok += count;
    }
    if (finRows.length === 0 && records.length > 0) {
      console.log(`  ⚠ 0 rows parsed. CSV columns: ${header.slice(0, 25).join(' | ')}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Every donor failed → the query key itself is probably wrong for this
  // version. Print the DSD's actual dimension order so the fix is one paste away.
  if (ok === 0 && errors.length >= DONORS.length) {
    try {
      const res = await fetch(
        `https://sdmx.oecd.org/dcd-public/rest/datastructure/OECD.DCD.FSD/DSD_CRS?references=none`
      );
      if (res.ok) {
        const xml = await res.text();
        const dims: Array<{ id: string; pos: number }> = [];
        const re = /<structure:Dimension\b[^>]*\bid="([^"]+)"[^>]*\bposition="(\d+)"/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(xml)) !== null) dims.push({ id: m[1], pos: Number(m[2]) });
        dims.sort((a, b) => a.pos - b.pos);
        if (dims.length) console.log(`  ⚠ DSD_CRS dimension order: ${dims.map((d) => d.id).join('.')}`);
      } else {
        console.log(`  ⚠ DSD_CRS structure fetch: HTTP ${res.status}`);
      }
    } catch { /* diagnostic only */ }
  }

  console.log(`OECD CRS: ${ok} donor×country×year aggregates loaded`);
  await finishRunLog(db, logId, errors.length === 0, { found: parsed, created: ok }, {
    loader: 'oecd', donors: DONORS, ...(errors.length ? { errors } : {}),
  });
  if (errors.length) { console.error('Issues:', errors); process.exit(1); }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`sync:oecd failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'oecd' }, msg);
  process.exit(1);
}
