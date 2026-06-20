import type { Deal, DealCandidate } from '../types';
import { findSimilarDeals } from '../db/queries';

// Returns existing deal ID if candidate is a duplicate, null if it's new
export async function findDuplicateDeal(
  candidate: DealCandidate
): Promise<{ dealId: string; isNew: boolean } | null> {
  if (!candidate.host_country || !candidate.sector) return null;

  const existing = await findSimilarDeals(
    candidate.title,
    candidate.host_country,
    candidate.sector
  );

  if (existing.length === 0) return null;

  for (const deal of existing) {
    const sim = titleSimilarity(candidate.title, deal.title);
    if (sim >= 0.55) {
      return { dealId: deal.id, isNew: false };
    }
  }
  return null;
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
