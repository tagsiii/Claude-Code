// One-time geocode backfill for deals created before the geo layer existed.
// Pre-Phase-1 deals have no stored facility/place names to geocode from, so
// the best honest precision for them is the country centroid ('country_centroid');
// scans that re-mention them will upgrade precision through the normal merge
// path. Idempotent: only touches deals with no location_precision.

import { getDb, startRunLog, finishRunLog } from './_shared.mts';

const db = getDb();
const logId = await startRunLog(db, 'geocode:backfill');

try {
  const { data: countries, error: cErr } = await db
    .from('countries')
    .select('iso3, centroid_lon, centroid_lat');
  if (cErr) throw new Error(`countries table unavailable — run load:countries first (${cErr.message})`);
  const centroids = new Map(
    (countries ?? [])
      .filter((c) => c.centroid_lon != null && c.centroid_lat != null)
      .map((c) => [c.iso3 as string, { lon: c.centroid_lon as number, lat: c.centroid_lat as number }])
  );

  const { data: deals, error: dErr } = await db
    .from('deals')
    .select('id, title, country_iso3')
    .is('location_precision', null)
    .not('country_iso3', 'is', null);
  if (dErr) throw new Error(dErr.message);

  let updated = 0;
  const errors: string[] = [];
  for (const deal of deals ?? []) {
    const c = centroids.get(deal.country_iso3 as string);
    if (!c) continue;
    const { error } = await db.rpc('set_deal_location', {
      p_deal_id: deal.id,
      p_lon: c.lon,
      p_lat: c.lat,
      p_precision: 'country_centroid',
      p_facility_id: null,
      p_iso3: deal.country_iso3,
    });
    if (error) { if (errors.length < 5) errors.push(`${deal.title}: ${error.message}`); }
    else updated++;
  }

  const skipped = (deals?.length ?? 0) - updated - errors.length;
  console.log(`Backfilled ${updated} deals to country_centroid precision (${skipped} without centroid data)`);
  console.log('Deals with no country_iso3 stay unlocated until a scan re-touches them.');
  await finishRunLog(db, logId, errors.length === 0, { found: deals?.length ?? 0, created: updated }, {
    loader: 'geocode-backfill', ...(errors.length ? { errors } : {}),
  });
  if (errors.length) { console.error('Errors:', errors); process.exit(1); }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`geocode:backfill failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'geocode-backfill' }, msg);
  process.exit(1);
}
