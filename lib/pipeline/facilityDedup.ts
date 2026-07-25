// Facility-first deduplication rules (pure, fixture-testable).
//
// Runs AHEAD of title similarity. When both a candidate and an existing deal
// resolve to the same physical facility:
//   · same subsector + any sponsor overlap        → same deal (merge)
//   · different subsector + disjoint sponsors     → distinct deals
//     (a Chinese terminal deal and a US dredging contract at the same port
//      are two deals)
//   · anything else                               → inconclusive; title
//     similarity remains the fallback path.
// Merge semantics themselves are untouched — this only decides WHICH record
// a candidate belongs to.

export type FacilityVerdict = 'merge' | 'distinct' | 'inconclusive';

export interface FacilityDedupSide {
  facilityId: string | null;
  subsector: string | null;
  sponsorKeys: string[]; // canonical sponsor ids (preferred) or normalized names
}

function normSub(s: string | null): string | null {
  const v = s?.toLowerCase().trim();
  return v || null;
}

function overlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(a.map((x) => x.toLowerCase()));
  return b.some((x) => set.has(x.toLowerCase()));
}

export function decideFacilityDedup(
  candidate: FacilityDedupSide,
  existing: FacilityDedupSide
): FacilityVerdict {
  if (!candidate.facilityId || !existing.facilityId) return 'inconclusive';
  if (candidate.facilityId !== existing.facilityId) return 'inconclusive';

  const subA = normSub(candidate.subsector);
  const subB = normSub(existing.subsector);
  const sameSub = !!subA && !!subB && subA === subB;
  const diffSub = !!subA && !!subB && subA !== subB;
  const sponsorsOverlap = overlap(candidate.sponsorKeys, existing.sponsorKeys);
  const sponsorsDisjoint =
    candidate.sponsorKeys.length > 0 && existing.sponsorKeys.length > 0 && !sponsorsOverlap;

  if (sameSub && sponsorsOverlap) return 'merge';
  if (diffSub && sponsorsDisjoint) return 'distinct';
  // Same facility + same subsector but sponsors unknown on one side:
  // treat as the same underlying project (facility+subsector is a strong key).
  if (sameSub && !sponsorsDisjoint) return 'merge';
  return 'inconclusive';
}
