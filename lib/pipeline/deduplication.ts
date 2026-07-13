import type { Deal, DealCandidate } from '../types';
import { findSimilarDeals, findSimilarDealsBySector } from '../db/queries';

// Thresholds: BASE for candidates with no conflicting signals; STRONG when the
// candidate and existing deal disagree on a distinguishing attribute (subsector,
// sponsor, or facility type). Without the STRONG guard, "Port Expansion, Colombo"
// and "Airport Expansion, Colombo" (Jaccard ≈ 0.75) would merge into one record.
const BASE_THRESHOLD = 0.55;
const STRONG_THRESHOLD = 0.9;

// Facility-type words that distinguish otherwise similar deals in the same
// country + sector. Disjoint facility sets ⇒ demand near-identical titles.
const FACILITY_TOKENS = new Set([
  'port', 'ports', 'airport', 'rail', 'railway', 'railroad', 'metro', 'bridge',
  'dam', 'highway', 'road', 'pipeline', 'refinery', 'nuclear', 'solar', 'wind',
  'hydro', 'lng', 'cable', 'cables', 'subsea', '5g', 'datacenter', 'satellite',
  'grid', 'sez', 'terminal', 'telecom', 'cloud',
]);

export interface MatchVerdict {
  match: boolean;
  similarity: number;
}

// Pure decision function — unit-testable without a database.
export function isLikelySameDeal(
  candidate: Pick<DealCandidate, 'title' | 'subsector' | 'sponsoring_state'>,
  deal: Pick<Deal, 'title' | 'subsector' | 'sponsoring_state'>
): MatchVerdict {
  const similarity = titleSimilarity(candidate.title, deal.title);

  const subA = candidate.subsector?.toLowerCase().trim() || null;
  const subB = deal.subsector?.toLowerCase().trim() || null;
  if (subA && subB && subA !== subB) {
    return { match: similarity >= STRONG_THRESHOLD, similarity };
  }

  const spA = candidate.sponsoring_state?.toLowerCase().trim() || null;
  const spB = deal.sponsoring_state?.toLowerCase().trim() || null;
  if (spA && spB && spA !== spB) {
    return { match: similarity >= STRONG_THRESHOLD, similarity };
  }

  const facA = facilityTokens(candidate.title);
  const facB = facilityTokens(deal.title);
  if (facA.size > 0 && facB.size > 0 && disjoint(facA, facB)) {
    return { match: similarity >= STRONG_THRESHOLD, similarity };
  }

  return { match: similarity >= BASE_THRESHOLD, similarity };
}

// Returns the BEST-matching existing deal (highest similarity), not the first
// row that clears the threshold.
export async function findDuplicateDeal(
  candidate: DealCandidate
): Promise<{ dealId: string; isNew: boolean } | null> {
  if (!candidate.title || !candidate.sector) return null;

  // With a host country we can prefilter tightly; without one, fall back to a
  // recent same-sector pool but demand a stronger match to compensate.
  const pool = candidate.host_country
    ? await findSimilarDeals(candidate.title, candidate.host_country, candidate.sector)
    : await findSimilarDealsBySector(candidate.sector);

  let best: { deal: Deal; similarity: number } | null = null;
  for (const deal of pool) {
    const verdict = isLikelySameDeal(candidate, deal);
    if (verdict.match && (!best || verdict.similarity > best.similarity)) {
      best = { deal, similarity: verdict.similarity };
    }
  }

  if (!best) return null;
  if (!candidate.host_country && best.similarity < 0.75) return null;
  return { dealId: best.deal.id, isNew: false };
}

// Jaccard similarity on word tokens
export function titleSimilarity(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.size === 0 || tokB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokA) {
    if (tokB.has(t)) intersection++;
  }
  const union = tokA.size + tokB.size - intersection;
  return intersection / union;
}

function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for', 'on',
    'with', 'by', 'at', 'from', 'is', 'are', 'was', 'be', 'has',
    'its', 'this', 'that', 'deal', 'project', 'new',
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopWords.has(t))
  );
}

function facilityTokens(title: string): Set<string> {
  const out = new Set<string>();
  for (const t of tokenize(title)) {
    if (FACILITY_TOKENS.has(t)) out.add(t);
  }
  return out;
}

function disjoint(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return false;
  return true;
}

// Merge a candidate's data onto an existing deal (keep best/most-recent values)
export function mergeCandidateIntoDeal(
  existing: Deal,
  candidate: DealCandidate
): Partial<Deal> {
  const merged: Partial<Deal> = {};

  // Upgrade lifecycle stage (never downgrade)
  const stageOrder = [
    'rumored', 'exploratory_mou', 'negotiation', 'signed',
    'financing_secured', 'under_construction', 'completed',
  ];
  const existingIdx = stageOrder.indexOf(existing.lifecycle_stage);
  const candidateIdx = stageOrder.indexOf(candidate.lifecycle_stage);
  if (candidateIdx > existingIdx) {
    merged.lifecycle_stage = candidate.lifecycle_stage;
    merged.lifecycle_reasoning = candidate.lifecycle_reasoning;
  }

  // Upgrade sponsoring state if previously unknown
  if (!existing.sponsoring_state && candidate.sponsoring_state) {
    merged.sponsoring_state = candidate.sponsoring_state;
  }

  // Upgrade ROM value if previously unknown
  if (!existing.rom_value_usd && candidate.rom_value_usd) {
    merged.rom_value_usd = candidate.rom_value_usd;
    merged.rom_basis = candidate.rom_basis;
  }

  // Merge financial sponsors (deduplicate by name)
  const knownNames = new Set(existing.financial_sponsors.map((s) => s.name));
  const newSponsors = (candidate.financial_sponsors ?? []).filter(
    (s) => !knownNames.has(s.name)
  );
  if (newSponsors.length > 0) {
    merged.financial_sponsors = [...existing.financial_sponsors, ...newSponsors];
  }

  return merged;
}
