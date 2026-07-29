// Phase 4: deterministic spatial flags. The geometry work happens in Postgres
// (apply_spatial_flags in geo4.sql) — this module calls it, decides whether a
// rescore is needed, and defines the FIXED score contributions each flag adds.
// No AI anywhere in this path.

import { db } from '../db/client';
import type { Deal } from '../types';

export const FLAG_KEYS = [
  'flag_near_cable_landing',
  'flag_white_space',
  'flag_contested_asset',
  'flag_us_positioning',
  'flag_unpositioned_mdb',
] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export type SpatialFlags = Partial<
  Record<FlagKey, boolean> & Record<`${FlagKey}_reason`, string | null>
>;

// Fixed, documented score contributions (points added to the 0–100 sub-score,
// capped at 100). Strategic Priority rewards intrinsically important assets;
// Actionability rewards situations where the US has a concrete opening.
export const SPATIAL_PRIORITY_POINTS: Partial<Record<FlagKey, number>> = {
  flag_near_cable_landing: 12,
  flag_contested_asset: 12,
  flag_white_space: 10,
};
export const SPATIAL_ACTIONABILITY_POINTS: Partial<Record<FlagKey, number>> = {
  flag_us_positioning: 10,
  flag_unpositioned_mdb: 8,
  flag_white_space: 5,
};

const FLAG_LABELS: Record<FlagKey, string> = {
  flag_near_cable_landing: 'near cable landing',
  flag_white_space: 'white space',
  flag_contested_asset: 'contested asset',
  flag_us_positioning: 'US positioning exists',
  flag_unpositioned_mdb: 'unpositioned MDB pipeline',
};

// Pure: total bonus + human-readable notes for a sub-score. Used by scoring.ts.
export function spatialBonus(
  deal: Partial<Deal>,
  points: Partial<Record<FlagKey, number>>
): { bonus: number; notes: string[] } {
  let bonus = 0;
  const notes: string[] = [];
  for (const key of FLAG_KEYS) {
    const pts = points[key];
    if (pts && deal[key] === true) {
      bonus += pts;
      notes.push(`+${pts} ${FLAG_LABELS[key]}`);
    }
  }
  return { bonus, notes };
}

export function anyFlagSet(flags: SpatialFlags | null | undefined): boolean {
  return !!flags && FLAG_KEYS.some((k) => flags[k] === true);
}

// Which flags flipped false→true relative to the previous deal state — these
// get timeline events so the audit trail explains score jumps.
export function newlyRaisedFlags(
  previous: Partial<Deal>,
  flags: SpatialFlags
): Array<{ key: FlagKey; reason: string }> {
  const out: Array<{ key: FlagKey; reason: string }> = [];
  for (const key of FLAG_KEYS) {
    if (flags[key] === true && previous[key] !== true) {
      out.push({ key, reason: flags[`${key}_reason`] ?? FLAG_LABELS[key] });
    }
  }
  return out;
}

export function flagsChanged(previous: Partial<Deal>, flags: SpatialFlags): boolean {
  return FLAG_KEYS.some((k) => (flags[k] === true) !== (previous[k] === true));
}

// Compute + persist the flags for one deal (RPC does both). Best-effort: a
// pre-migration database or transient error records a warning and returns null.
export async function applySpatialFlags(
  dealId: string,
  warnings?: string[]
): Promise<SpatialFlags | null> {
  try {
    const { data, error } = await db.rpc('apply_spatial_flags', { p_deal_id: dealId });
    if (error) {
      // Missing function = geo4.sql not run yet — expected pre-migration, stay quiet.
      if (!/function .*apply_spatial_flags.* does not exist|schema cache/i.test(error.message)) {
        warnings?.push(`spatial flags: ${error.message}`.slice(0, 160));
      }
      return null;
    }
    return (data as SpatialFlags) ?? null;
  } catch (err) {
    warnings?.push(`spatial flags: ${err instanceof Error ? err.message : err}`.slice(0, 160));
    return null;
  }
}

// Refresh the gap materialized views (post-scan / post-recompute). Best-effort.
export async function refreshGapViews(warnings?: string[]): Promise<void> {
  try {
    const { error } = await db.rpc('refresh_gap_views', {});
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      warnings?.push(`gap views refresh: ${error.message}`.slice(0, 160));
    }
  } catch { /* best-effort */ }
}
