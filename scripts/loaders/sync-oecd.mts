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

const db = getDb();
const logId = await startRunLog(db, 'sync:oecd');

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

  for (const donor of DONORS) {
    // DSD_CRS@DF_CRS: DONOR.RECIPIENT.SECTOR.FLOW.CHANNEL.MODALITY.MEASURE.PRICE_BASE.PERIOD
    // Query commitments (measure 1140? use default) for all recipients, total sector.
    const url =
      `https://sdmx.oecd.org/public/rest/data/OECD.DCD.FSD,DSD_CRS@DF_CRS,1.3/` +
      `${donor}..1000.100._T._T.C.Q._T?startPeriod=${START_YEAR}&dimensionAtObservation=AllDimensions&format=csvfilewithlabels`;
    console.log(`OECD CRS: donor ${donor}…`);
    const csv = await fetchCsv(url);
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
