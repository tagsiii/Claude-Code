// Global Energy Monitor trackers → facilities (power_plant / lng_terminal /
// pipeline / mine, inferred from filename). GEM distributes tracker
// spreadsheets from globalenergymonitor.org (free registration for some);
// download any you want and drop them in data/gem/*.xlsx. Idempotent.

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, startRunLog, finishRunLog, inBatches } from './_shared.mts';
import { gemRecordToFacility, gemTypeForFilename, GEM_SKIP_FILENAME, type FacilityRow } from '../../lib/geo/parsers.ts';

const db = getDb();
const logId = await startRunLog(db, 'load:gem');

try {
  const dir = resolve(process.cwd(), 'data/gem');
  if (!existsSync(dir)) {
    throw new Error(
      'data/gem/ not found. Download Global Energy Monitor tracker spreadsheets ' +
        '(https://globalenergymonitor.org/projects/) into data/gem/*.xlsx. See data/README.md.'
    );
  }
  const files = readdirSync(dir).filter((f) => /\.(xlsx|xls)$/i.test(f));
  if (files.length === 0) throw new Error('No .xlsx files in data/gem/ — see data/README.md.');

  // xlsx ships CJS; under tsx the callable API lands on .default. Read bytes
  // with Node fs and parse from buffer — readFile needs fs wiring the ESM
  // build doesn't do.
  const xlsxMod = await import('xlsx');
  const XLSX = ((xlsxMod as { default?: unknown }).default ?? xlsxMod) as typeof import('xlsx');
  const rows: FacilityRow[] = [];
  const perFile: Record<string, number> = {};

  for (const file of files) {
    if (GEM_SKIP_FILENAME.test(file)) {
      console.log(`${file}: skipped (not facility-level data — finance/supplement/ownership/vessel dataset)`);
      perFile[file] = -1;
      continue;
    }
    const type = gemTypeForFilename(file);
    const wb = XLSX.read(readFileSync(resolve(dir, file)), { type: 'buffer' });
    let count = 0;
    let sampleHeaders: string[] | null = null;
    for (const sheetName of wb.SheetNames) {
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
      if (!sampleHeaders && records.length > 0) sampleHeaders = Object.keys(records[0]).slice(0, 25);
      for (const rec of records) {
        const row = gemRecordToFacility(rec, type);
        if (row) { rows.push(row); count++; }
      }
    }
    perFile[file] = count;
    console.log(`${file}: ${count} facilities (${type})`);
    if (count === 0 && sampleHeaders) {
      // Don't guess at unknown formats — surface the actual columns so the
      // parser can be extended against real data.
      console.log(`  ⚠ no rows matched. Sheets: ${wb.SheetNames.join(', ')}`);
      console.log(`  ⚠ first sheet columns: ${sampleHeaders.join(' | ')}`);
    }
  }

  const { ok, failed, firstErrors } = await inBatches(rows, 25, async (row) => {
    const { error } = await db.rpc('upsert_facility', {
      p_name: row.name,
      p_type: row.facilityType,
      p_iso3: row.iso3 ?? '',
      p_lon: row.lon,
      p_lat: row.lat,
      p_source: 'gem',
      p_source_ref: row.sourceRef,
      p_aliases: row.aliases,
    });
    if (error) throw new Error(error.message);
  });

  console.log(`Upserted ${ok} GEM facilities (${failed} failed)`);
  await finishRunLog(db, logId, failed === 0, { found: rows.length, created: ok }, {
    loader: 'gem', files: perFile, ...(firstErrors.length ? { errors: firstErrors } : {}),
  });
  if (failed > 0) process.exit(1);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`load:gem failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'gem' }, msg);
  process.exit(1);
}
