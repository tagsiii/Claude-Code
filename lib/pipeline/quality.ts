// Data-quality vetting engine — pure functions (testable, no DB access here).
// Three jobs: count truly-independent sources (different outlets, not two
// copies of one wire story), grade each deal's evidentiary completeness A–D,
// and decide whether a new deal needs human review before joining the table.

import type { Deal } from '../types';

// Registrable domain of a URL: "www.reuters.com/x" → "reuters.com".
// Handles the common two-part public suffixes; unknown schemes (upload://)
// return their own identity so documents count as independent sources.
const TWO_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au',
  'co.jp', 'com.cn', 'com.hk', 'com.sg', 'com.br', 'com.mx', 'co.in',
  'co.za', 'co.kr', 'com.tr', 'com.pk', 'co.id', 'com.my', 'com.ng',
]);

export function registrableDomain(url: string): string {
  try {
    if (url.startsWith('upload://')) return url; // each document is itself a source
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const lastTwo = parts.slice(-2).join('.');
    return TWO_PART_TLDS.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
  } catch {
    return url;
  }
}

// Independent sources = distinct outlets. Two Reuters links are ONE source.
export function countIndependentSources(urls: string[]): number {
  return new Set(urls.map(registrableDomain)).size;
}

// Syndicated-copy detection: the same wire story republished under a
// near-identical headline on different sites should not double-count.
export function normalizeHeadline(title: string): string {
  return title
    .split(/\s+(?:\||—|–)\s+/)[0] // drop trailing "— Outlet Name" attributions
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 12) // compare the lead words — outlets tweak the tail
    .join(' ');
}

export function dedupeSyndicated<T extends { title: string; url: string }>(articles: T[]): T[] {
  const seen = new Map<string, string>(); // normalized headline → first domain
  const out: T[] = [];
  for (const a of articles) {
    const key = normalizeHeadline(a.title || a.url);
    const domain = registrableDomain(a.url);
    const first = seen.get(key);
    if (first !== undefined && first !== domain) continue; // syndicated copy
    if (first === undefined) seen.set(key, domain);
    out.push(a);
  }
  return out;
}

// ─── Quality grade ────────────────────────────────────────────────────────────
// Fixed, documented point system over the evidence a deal carries:
//   named sponsor            +2      sourced dollar value      +2
//   2 independent sources    +2      3+ independent sources    +1 more
//   precise location         +1      tier-1/2 sourcing         +1
//   official-record match    +2      confirmed status          +1
// A ≥ 8 · B ≥ 6 · C ≥ 4 · D < 4   (max 12)

export interface QualityComponents {
  has_sponsor: boolean;
  has_value: boolean;
  independent_sources: number;
  precise_location: boolean;
  strong_sourcing: boolean;
  official_xref: boolean;
  confirmed: boolean;
  points: number;
}

export function computeQualityGrade(deal: Partial<Deal>, independentSources: number): {
  grade: 'A' | 'B' | 'C' | 'D';
  components: QualityComponents;
} {
  const has_sponsor =
    (deal.financial_sponsors?.length ?? 0) > 0 || (deal.sponsoring_entities?.length ?? 0) > 0;
  const has_value = !!deal.rom_value_usd && deal.rom_value_usd > 0;
  const precise_location =
    deal.location_precision === 'facility' || deal.location_precision === 'city' || deal.location_precision === 'exact';
  const strong_sourcing = (deal.source_confidence_tier ?? 3) <= 2;
  const official_xref = !!deal.xref_cn_ref;
  const confirmed = deal.is_confirmed === true;

  let points = 0;
  if (has_sponsor) points += 2;
  if (has_value) points += 2;
  if (independentSources >= 2) points += 2;
  if (independentSources >= 3) points += 1;
  if (precise_location) points += 1;
  if (strong_sourcing) points += 1;
  if (official_xref) points += 2;
  if (confirmed) points += 1;

  const grade = points >= 8 ? 'A' : points >= 6 ? 'B' : points >= 4 ? 'C' : 'D';
  return {
    grade,
    components: {
      has_sponsor, has_value, independent_sources: independentSources,
      precise_location, strong_sourcing, official_xref, confirmed, points,
    },
  };
}

// ─── Review gate ──────────────────────────────────────────────────────────────
// New deals join the table automatically unless the evidence is thin:
// grade D, or a single anonymous-tier source with nothing confirmed.
export function autoReviewStatus(
  grade: 'A' | 'B' | 'C' | 'D',
  tier: number,
  independentSources: number,
  isConfirmed: boolean
): 'approved' | 'pending' {
  if (tier === 1) return 'approved'; // analyst-provided primary material
  if (grade === 'D') return 'pending';
  if (independentSources < 2 && tier >= 3 && !isConfirmed) return 'pending';
  return 'approved';
}

// ─── Provenance ───────────────────────────────────────────────────────────────
// { field: { source, date } } — which outlet asserted each key fact, and when.
export type Provenance = Record<string, { source: string; date: string }>;

export function stampProvenance(
  existing: Provenance | null | undefined,
  fields: string[],
  sourceLabel: string,
  date: string
): Provenance {
  const prov: Provenance = { ...(existing ?? {}) };
  for (const f of fields) {
    prov[f] = { source: sourceLabel.slice(0, 120), date };
  }
  return prov;
}

// Human-readable label for a source ref: outlet domain, or document title.
export function sourceLabel(ref: { url: string; title?: string | null }): string {
  if (ref.url.startsWith('upload://')) return `document: ${ref.title ?? 'upload'}`;
  return registrableDomain(ref.url);
}
