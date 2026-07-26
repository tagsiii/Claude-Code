// Generic loader for user-downloaded activity files:
//   npm run load:dfc | load:exim | load:mcc | load:ppi
// Reads data/<key>.xlsx or data/<key>.csv, parses with the tolerant per-source
// parser, and upserts into us_activity (DFC/EXIM/MCC) or mdb_pipeline (PPI).
// Zero-count runs print the file's actual columns for parser extension.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, startRunLog, finishRunLog } from './_shared.mts';
import { csvToRecords, detectHeaderRow, rowsToRecords } from '../../lib/geo/parsers.ts';
import {
  dfcRecordToActivity, eximRecordToActivity, mccRecordToActivity, ppiRecordToMdb,
  type UsActivityRow, type MdbRow,
} from '../../lib/geo/activityParsers.ts';

const CONFIGS: Record<string, {
  download: string;
  kind: 'us_activity' | 'mdb_pipeline';
  parse: (rec: Record<string, unknown>) => UsActivityRow | MdbRow | null;
}> = {
  dfc: { download: 'dfc.gov — "View DFC Project Data" (active projects export)', kind: 'us_activity', parse: dfcRecordToActivity },
  exim: { download: 'exim.gov/open — authorizations dataset', kind: 'us_activity', parse: eximRecordToActivity },
  mcc: { download: 'mcc.gov open data — compacts/programs export', kind: 'us_activity', parse: mccRecordToActivity },
  ppi: { download: 'ppi.worldbank.org — bulk project download', kind: 'mdb_pipeline', parse: ppiRecordToMdb },
};

const key = process.argv[2];
const config = CONFIGS[key ?? ''];
if (!config) {
  console.error(`Usage: load-activity-file.mts <${Object.keys(CONFIGS).join('|')}>`);
  process.exit(1);
}

const db = getDb();
const logId = await startRunLog(db, `load:${key}`);

try {
  // Find the file: data/<key>.xlsx or data/<key>.csv
  const xlsxPath = resolve(process.cwd(), `data/${key}.xlsx`);
  const csvPath = resolve(process.cwd(), `data/${key}.csv`);
  let records: Array<Record<string, unknown>> = [];
  let sourceFile = '';

  if (existsSync(xlsxPath)) {
    sourceFile = `data/${key}.xlsx`;
    const xlsxMod = await import('xlsx');
    const XLSX = ((xlsxMod as { default?: unknown }).default ?? xlsxMod) as typeof import('xlsx');
    const wb = XLSX.read(readFileSync(xlsxPath), { type: 'buffer' });
    for (const sheetName of wb.SheetNames) {
      const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1 });
      records.push(...rowsToRecords(raw as unknown[][], detectHeaderRow(raw as unknown[][])));
    }
  } else if (existsSync(csvPath)) {
    sourceFile = `data/${key}.csv`;
    records = csvToRecords(readFileSync(csvPath, 'utf8'));
  } else {
    throw new Error(`data/${key}.xlsx or data/${key}.csv not found. Download from: ${config.download} (see data/README.md).`);
  }

  const rows = records.map(config.parse).filter((r): r is NonNullable<typeof r> => r !== null);
  console.log(`${sourceFile}: ${rows.length} rows parsed from ${records.length} records`);
  if (rows.length === 0 && records.length > 0) {
    console.log(`  ⚠ no rows matched. Columns: ${Object.keys(records[0]).slice(0, 40).join(' | ')}`);
  }

  let ok = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const slice = rows.slice(i, i + 200);
    const payload =
      config.kind === 'us_activity'
        ? (slice as UsActivityRow[]).map((r) => ({
            agency: r.agency, record_type: r.recordType, project_name: r.projectName,
            country_iso3: r.iso3, sector: r.sector, value_usd: r.valueUsd,
            announced_date: r.announcedDate, is_leading_indicator: r.isLeadingIndicator,
            source_url: r.sourceUrl, source: `file:${key}`,
          }))
        : (slice as MdbRow[]).map((r) => ({
            bank: r.bank, project_ref: r.projectRef, name: r.name, country_iso3: r.iso3,
            sector: r.sector, status: r.status, value_usd: r.valueUsd, source: `file:${key}`,
          }));
    const onConflict = config.kind === 'us_activity' ? 'agency,project_name,country_iso3' : 'bank,project_ref';
    const { error, count } = await db.from(config.kind).upsert(payload, { onConflict, count: 'exact', ignoreDuplicates: false });
    if (error) { if (errors.length < 5) errors.push(error.message.slice(0, 160)); }
    else ok += count ?? slice.length;
  }

  console.log(`Upserted ${ok} rows into ${config.kind}`);
  await finishRunLog(db, logId, errors.length === 0, { found: rows.length, created: ok }, {
    loader: key, file: sourceFile, ...(errors.length ? { errors } : {}),
  });
  if (errors.length) { console.error('Errors:', errors); process.exit(1); }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`load:${key} failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: key }, msg);
  process.exit(1);
}
