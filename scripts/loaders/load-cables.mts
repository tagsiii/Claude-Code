// Subsea cables → cables table (+ landing points → facilities).
//
// LICENSING (design constraint): TeleGeography's submarine cable map data is
// NOT openly licensed for automated ingestion, so this loader deliberately has
// no downloader. It reads a USER-PROVIDED GeoJSON at data/cables.geojson and
// logs a skip when the file is absent. See data/README.md for details and the
// free interactive map for manual reference.

import { getDb, startRunLog, finishRunLog, readLocalFile } from './_shared.mts';

const db = getDb();
const logId = await startRunLog(db, 'load:cables');

const raw = readLocalFile('data/cables.geojson');
if (!raw) {
  const note =
    'data/cables.geojson not provided — skipping (expected; cable data is user-supplied ' +
    'due to licensing, see data/README.md).';
  console.log(note);
  await finishRunLog(db, logId, true, { found: 0, created: 0 }, { loader: 'cables', skipped: note });
  process.exit(0);
}

try {
  type Feature = { properties?: Record<string, unknown>; geometry?: { type?: string } };
  const features: Feature[] = JSON.parse(raw).features ?? [];

  // Landing points often ship as a SEPARATE file (e.g. the map site serves
  // cable lines and landing points as two JSON endpoints) — merge if present.
  const landingRaw = readLocalFile('data/cable-landing-points.geojson');
  if (landingRaw) {
    const extra: Feature[] = JSON.parse(landingRaw).features ?? [];
    features.push(...extra);
    console.log(`data/cable-landing-points.geojson: +${extra.length} features`);
  }

  let cables = 0;
  let landings = 0;
  const errors: string[] = [];

  for (const f of features) {
    const p = f.properties ?? {};
    const name = String(p.name ?? p.Name ?? p.cable_name ?? '').trim();
    const gtype = f.geometry?.type ?? '';
    if (!name || !f.geometry) continue;

    if (gtype === 'LineString' || gtype === 'MultiLineString') {
      const owners = Array.isArray(p.owners)
        ? (p.owners as unknown[]).map(String)
        : typeof p.owners === 'string'
          ? p.owners.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
      const rfs = parseInt(String(p.rfs_year ?? p.rfs ?? ''), 10);
      const { error } = await db.rpc('upsert_cable', {
        p_name: name,
        p_geojson: JSON.stringify(f.geometry),
        p_owners: owners,
        p_rfs_year: Number.isFinite(rfs) ? rfs : null,
      });
      if (error) { if (errors.length < 5) errors.push(`${name}: ${error.message}`); }
      else cables++;
    } else if (gtype === 'Point') {
      // Landing points feed the flag_near_cable_landing proximity signal.
      const coords = (f.geometry as { coordinates?: [number, number] }).coordinates;
      if (!coords || coords.length < 2) continue;
      const { error } = await db.rpc('upsert_facility', {
        p_name: name,
        p_type: 'cable_landing',
        p_iso3: String(p.country_iso3 ?? p.iso3 ?? ''),
        p_lon: coords[0],
        p_lat: coords[1],
        p_source: 'user_cables_file',
        p_source_ref: null,
        p_aliases: [],
      });
      if (error) { if (errors.length < 5) errors.push(`${name}: ${error.message}`); }
      else landings++;
    }
  }

  console.log(`Upserted ${cables} cables, ${landings} landing points`);
  if (cables + landings === 0 && features.length > 0) {
    const sample = features.find((f) => f.properties) ?? features[0];
    console.log(
      `  ⚠ 0 rows matched. Sample feature — geometry: ${sample?.geometry?.type ?? 'none'}, ` +
        `property keys: ${Object.keys(sample?.properties ?? {}).slice(0, 20).join(' | ') || 'none'}`
    );
  }
  await finishRunLog(db, logId, errors.length === 0, { found: features.length, created: cables + landings }, {
    loader: 'cables', cables, landing_points: landings, ...(errors.length ? { errors } : {}),
  });
  if (errors.length) { console.error('Errors:', errors); process.exit(1); }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`load:cables failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'cables' }, msg);
  process.exit(1);
}
