// Recomputes the five spatial flags + composite score for every active deal,
// then refreshes the gap materialized views. Run LOCALLY after loading or
// refreshing reference data (AidData, US activity, cables, WPI):
//
//   npm run recompute:spatial
//
// Requires lib/db/geo4.sql to have been run in the Supabase SQL editor.
// Zero AI tokens — flags are pure PostGIS, scoring is deterministic.

import { getDb, startRunLog, finishRunLog } from './loaders/_shared.mts';

const db = getDb(); // also loads .env.local, so the lib/ imports below work
const { scoreDeal } = await import('../lib/pipeline/scoring.ts');
const { FLAG_KEYS } = await import('../lib/pipeline/spatialFlags.ts');

const logId = await startRunLog(db, 'recompute:spatial');

try {
  const { data: deals, error } = await db
    .from('deals')
    .select('id')
    .eq('status', 'active');
  if (error) throw new Error(error.message);

  const ids = (deals ?? []).map((d) => d.id as string);
  console.log(`Recomputing spatial flags for ${ids.length} active deals…`);

  let ok = 0;
  let failed = 0;
  const flagCounts: Record<string, number> = {};
  const errors: string[] = [];

  for (const id of ids) {
    try {
      const { data: flags, error: rpcErr } = await db.rpc('apply_spatial_flags', { p_deal_id: id });
      if (rpcErr) throw new Error(rpcErr.message);

      for (const key of FLAG_KEYS) {
        if ((flags as Record<string, unknown>)?.[key] === true) {
          flagCounts[key] = (flagCounts[key] ?? 0) + 1;
        }
      }

      // Rescore from the freshly-updated row (includes the new flags).
      const { data: row, error: rowErr } = await db.from('deals').select('*').eq('id', id).single();
      if (rowErr) throw new Error(rowErr.message);
      const { composite, breakdown } = await scoreDeal(row);
      const { error: upErr } = await db
        .from('deals')
        .update({
          composite_score: composite,
          score_breakdown: breakdown,
          score_calculated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (upErr) throw new Error(upErr.message);
      ok++;
    } catch (err) {
      failed++;
      if (errors.length < 5) errors.push(`${id}: ${err instanceof Error ? err.message : err}`.slice(0, 140));
    }
    if (ok % 25 === 0 && ok > 0) console.log(`  … ${ok}/${ids.length}`);
  }

  console.log('Refreshing gap views…');
  const { error: refreshErr } = await db.rpc('refresh_gap_views', {});
  if (refreshErr) errors.push(`refresh_gap_views: ${refreshErr.message}`.slice(0, 140));

  console.log(`\nDone: ${ok} deals rescored, ${failed} failed.`);
  for (const key of FLAG_KEYS) {
    console.log(`  ${key.replace('flag_', '')}: ${flagCounts[key] ?? 0} deal(s)`);
  }
  if (errors.length > 0 && /does not exist|schema cache/i.test(errors[0])) {
    console.log('\n⚠ Looks like lib/db/geo4.sql has not been run in the Supabase SQL editor yet.');
  }

  await finishRunLog(db, logId, failed === 0 && errors.length === 0, { found: ids.length, created: ok }, {
    loader: 'recompute-spatial', flags: flagCounts, ...(errors.length ? { errors } : {}),
  });
  if (failed > 0 || errors.length > 0) { console.error('Issues:', errors); process.exit(1); }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`recompute:spatial failed — ${msg}`);
  await finishRunLog(db, logId, false, {}, { loader: 'recompute-spatial' }, msg);
  process.exit(1);
}
