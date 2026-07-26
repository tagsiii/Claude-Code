// Exports static map layers from Postgres to the public `map-layers` Supabase
// Storage bucket. Run LOCALLY (npm run export:tiles) after loading/refreshing
// reference data — the map page reads these files directly from Storage so
// heavy geometry never goes through a serverless function.
//
// Requires lib/db/geo3.sql to have been run in the Supabase SQL editor
// (it defines the export_* functions this script calls).

import { getDb, startRunLog, finishRunLog } from './loaders/_shared.mts';

const BUCKET = 'map-layers';

// RPC → filename. Keep filenames in sync with LAYER_FILES in lib/geo/mapStyle.ts.
const EXPORTS: Array<{ rpc: string; args?: Record<string, unknown>; file: string; label: string }> = [
  {
    rpc: 'export_facility_points',
    // Only the strategic, small-count facility types — 400k power plants would
    // overwhelm the browser and are deliberately excluded from the map.
    args: { p_types: ['port', 'lng_terminal', 'cable_landing'] },
    file: 'facilities.geojson',
    label: 'facilities (ports, LNG, cable landings)',
  },
  { rpc: 'export_cn_points', file: 'cn-projects.geojson', label: 'Chinese finance projects' },
  { rpc: 'export_cn_country_sums', file: 'cn-country-sums.json', label: 'CN per-country sums' },
  { rpc: 'export_us_activity_points', file: 'us-activity.geojson', label: 'US agency activity' },
  { rpc: 'export_cables', file: 'cables.geojson', label: 'submarine cables' },
  { rpc: 'export_eez_display', file: 'eez.geojson', label: 'EEZ boundaries' },
  { rpc: 'export_countries_display', file: 'countries.geojson', label: 'country polygons' },
];

// Why a layer might legitimately export zero features — printed so an empty
// map layer is explainable instead of mysterious.
const EMPTY_HINTS: Record<string, string> = {
  'facilities.geojson': 'no ports/LNG/cable landings loaded — run npm run load:wpi (and load:gem)',
  'cn-projects.geojson': 'no Chinese finance projects loaded — run npm run load:aiddata',
  'us-activity.geojson': 'no US activity loaded — run load:dfc / load:exim / sync:ustda / sync:mcc',
  'cables.geojson': 'cables need the licensed TeleGeography file at data/cables.geojson (see data/README.md), then npm run load:cables',
  'eez.geojson': 'no EEZ boundaries loaded — run npm run load:eez',
  'countries.geojson': 'no country polygons — run npm run load:countries',
};

const db = getDb();
const logId = await startRunLog(db, 'export:tiles');

try {
  // Ensure the public bucket exists (idempotent).
  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await db.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Could not create bucket ${BUCKET}: ${error.message}`);
    console.log(`Created public Storage bucket "${BUCKET}"`);
  }

  let ok = 0;
  const errors: string[] = [];
  for (const exp of EXPORTS) {
    const { data, error } = await db.rpc(exp.rpc, exp.args ?? {});
    if (error) {
      const hint = /function .* does not exist|schema cache/i.test(error.message)
        ? ' — did you run lib/db/geo3.sql in the Supabase SQL editor?'
        : '';
      errors.push(`${exp.rpc}: ${error.message}${hint}`);
      console.log(`⚠ ${exp.label}: ${error.message}${hint}`);
      continue;
    }

    const body = JSON.stringify(data);
    const features = Array.isArray((data as { features?: unknown[] })?.features)
      ? (data as { features: unknown[] }).features.length
      : Object.keys((data as Record<string, unknown>) ?? {}).length;

    const { error: upErr } = await db.storage.from(BUCKET).upload(exp.file, body, {
      contentType: 'application/json',
      upsert: true,
      cacheControl: '3600',
    });
    if (upErr) {
      errors.push(`${exp.file}: upload failed — ${upErr.message}`);
      console.log(`⚠ ${exp.file}: upload failed — ${upErr.message}`);
      continue;
    }
    ok++;
    console.log(`✓ ${exp.file} — ${features} features, ${(body.length / 1024).toFixed(0)} KB (${exp.label})`);
    if (features === 0 && EMPTY_HINTS[exp.file]) {
      console.log(`  ⚠ empty layer: ${EMPTY_HINTS[exp.file]}`);
    }
  }

  console.log(`\nExported ${ok}/${EXPORTS.length} layers to Storage bucket "${BUCKET}"`);
  await finishRunLog(db, logId, errors.length === 0, { found: EXPORTS.length, created: ok }, {
    loader: 'export-tiles', ...(errors.length ? { errors } : {}),
  });
  if (errors.length) process.exit(1);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`export:tiles failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'export-tiles' }, msg);
  process.exit(1);
}
