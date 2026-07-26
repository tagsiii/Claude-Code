// Marine Regions World EEZ → eez table (full geometry + simplified display copy).
// Reads the user-downloaded zip (data/eez.zip, shapefile inside — see
// data/README.md) via shpjs, or data/eez.geojson if provided instead.

// shpjs is browser-built; give it the global it expects BEFORE importing.
(globalThis as { self?: unknown }).self = globalThis;

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, startRunLog, finishRunLog, readLocalFile } from './_shared.mts';
import { eezFeatureToRow } from '../../lib/geo/activityParsers.ts';

type FeatureCollection = { features?: Array<{ properties?: Record<string, unknown>; geometry?: unknown }> };

const db = getDb();
const logId = await startRunLog(db, 'load:eez');

try {
  let collections: FeatureCollection[] = [];
  const zipPath = resolve(process.cwd(), 'data/eez.zip');

  if (existsSync(zipPath)) {
    const shpMod = await import('shpjs');
    const shp = ((shpMod as { default?: unknown }).default ?? shpMod) as (b: ArrayBuffer) => Promise<FeatureCollection | FeatureCollection[]>;
    const buf = readFileSync(zipPath);
    const parsed = await shp(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    collections = Array.isArray(parsed) ? parsed : [parsed];
  } else {
    const raw = readLocalFile('data/eez.geojson');
    if (!raw) {
      throw new Error(
        'Neither data/eez.zip nor data/eez.geojson found. Download the World EEZ shapefile zip ' +
          'from marineregions.org (Maritime Boundaries → latest version) and save as data/eez.zip. See data/README.md.'
      );
    }
    collections = [JSON.parse(raw)];
  }

  let ok = 0;
  const errors: string[] = [];
  let total = 0;
  for (const fc of collections) {
    for (const feature of fc.features ?? []) {
      total++;
      const row = eezFeatureToRow(feature);
      if (!row) continue;
      const { error } = await db.rpc('upsert_eez', {
        p_name: row.name,
        p_sovereign: row.sovereign,
        p_geojson: row.geometryJson,
      });
      if (error) { if (errors.length < 5) errors.push(`${row.name}: ${error.message}`); }
      else ok++;
      if (ok % 50 === 0 && ok > 0) console.log(`  … ${ok} EEZ polygons`);
    }
  }

  if (total > 0 && ok === 0) {
    const sample = collections[0]?.features?.[0]?.properties ?? {};
    console.log(`  ⚠ no features matched. Sample properties: ${Object.keys(sample).slice(0, 30).join(' | ')}`);
  }

  console.log(`Upserted ${ok}/${total} EEZ polygons (full + simplified display geometry)`);
  await finishRunLog(db, logId, errors.length === 0, { found: total, created: ok }, {
    loader: 'eez', ...(errors.length ? { errors } : {}),
  });
  if (errors.length) { console.error('Errors:', errors); process.exit(1); }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`load:eez failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'eez' }, msg);
  process.exit(1);
}
