// Natural Earth admin-0 → countries table, then backfill deals.country_iso3.
// Auto-downloads the 110m GeoJSON (public domain); falls back to a local copy
// at data/ne_countries.geojson. Idempotent (upsert on iso3).

import { getDb, startRunLog, finishRunLog, readLocalFile, tryDownload } from './_shared.mts';
import { neFeatureToCountry } from '../../lib/geo/parsers.ts';
import { toIso3 } from '../../lib/data/countryCodes.ts';

const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

const db = getDb();
const logId = await startRunLog(db, 'load:countries');

try {
  let raw = await tryDownload(NE_URL);
  let sourceNote = NE_URL;
  if (!raw) {
    raw = readLocalFile('data/ne_countries.geojson');
    sourceNote = 'data/ne_countries.geojson';
  }
  if (!raw) {
    throw new Error(
      'Could not download Natural Earth data and no local copy found. ' +
        'Download the GeoJSON to data/ne_countries.geojson — see data/README.md.'
    );
  }

  const features: unknown[] = JSON.parse(raw).features ?? [];
  const rows = features
    .map((f) => neFeatureToCountry(f as never))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  console.log(`Parsed ${rows.length} countries from ${sourceNote}`);

  let ok = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await db.rpc('upsert_country', {
      p_iso3: row.iso3,
      p_name: row.name,
      p_continent: row.continent,
      p_un_region: row.unRegion,
      p_subregion: row.subregion,
      p_geojson: row.geometryJson,
    });
    if (error) { if (errors.length < 5) errors.push(`${row.iso3}: ${error.message}`); }
    else ok++;
  }
  console.log(`Upserted ${ok}/${rows.length} countries`);

  // Backfill deals.country_iso3 from host_country names.
  const { data: deals } = await db
    .from('deals')
    .select('id, host_country')
    .is('country_iso3', null)
    .not('host_country', 'is', null);
  let backfilled = 0;
  for (const d of deals ?? []) {
    const iso3 = toIso3(d.host_country as string);
    if (!iso3) continue;
    const { error } = await db.from('deals').update({ country_iso3: iso3 }).eq('id', d.id);
    if (!error) backfilled++;
  }
  console.log(`Backfilled country_iso3 on ${backfilled} deals`);

  await finishRunLog(db, logId, errors.length === 0, { found: rows.length, created: ok }, {
    loader: 'countries', source: sourceNote, backfilled_deals: backfilled,
    ...(errors.length ? { errors } : {}),
  });
  if (errors.length) { console.error('Errors:', errors); process.exit(1); }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`load:countries failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'countries' }, msg);
  process.exit(1);
}
