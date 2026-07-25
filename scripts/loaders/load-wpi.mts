// World Port Index (NGA MSI) → facilities (facility_type='port').
// NGA's download endpoint changes periodically and sits behind their MSI site,
// so this loader reads a locally downloaded CSV: data/wpi.csv
// (see data/README.md for the download path). ~3,700 ports. Idempotent.

import { getDb, startRunLog, finishRunLog, readLocalFile, inBatches } from './_shared.mts';
import { csvToRecords, wpiRecordToFacility } from '../../lib/geo/parsers.ts';

const db = getDb();
const logId = await startRunLog(db, 'load:wpi');

try {
  const raw = readLocalFile('data/wpi.csv');
  if (!raw) {
    throw new Error(
      'data/wpi.csv not found. Download the World Port Index CSV from NGA MSI ' +
        '(https://msi.nga.mil/Publications/WPI) and save it as data/wpi.csv. See data/README.md.'
    );
  }

  const records = csvToRecords(raw);
  const rows = records
    .map(wpiRecordToFacility)
    .filter((r): r is NonNullable<typeof r> => r !== null);
  console.log(`Parsed ${rows.length} ports from ${records.length} WPI rows`);

  const { ok, failed, firstErrors } = await inBatches(rows, 25, async (row) => {
    const { error } = await db.rpc('upsert_facility', {
      p_name: row.name,
      p_type: row.facilityType,
      p_iso3: row.iso3 ?? '',
      p_lon: row.lon,
      p_lat: row.lat,
      p_source: 'wpi',
      p_source_ref: row.sourceRef,
      p_aliases: row.aliases,
    });
    if (error) throw new Error(error.message);
  });

  console.log(`Upserted ${ok} ports (${failed} failed)`);
  await finishRunLog(db, logId, failed === 0, { found: rows.length, created: ok }, {
    loader: 'wpi', ...(firstErrors.length ? { errors: firstErrors } : {}),
  });
  if (failed > 0) process.exit(1);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`load:wpi failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'wpi' }, msg);
  process.exit(1);
}
