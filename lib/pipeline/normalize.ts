import type { DealCandidate, LifecycleStage, Sector, SponsoringEntity } from '../types';

// LLM output is probabilistic: enum values arrive with wrong casing, spaces, or
// synonyms ("Energy", "MOU signed", "in talks"). The deals table enforces CHECK
// constraints on sector/lifecycle_stage, so an un-normalized value makes the
// insert throw — and the candidate silently vanishes. This module coerces every
// candidate to schema-safe values before it touches the pipeline.

const SECTOR_SET = new Set<string>([
  'strategic_infrastructure', 'digital_connectivity', 'energy', 'cybersecurity', 'other',
]);
const STAGE_SET = new Set<string>([
  'rumored', 'exploratory_mou', 'negotiation', 'signed',
  'financing_secured', 'under_construction', 'completed', 'cancelled',
]);
const ENTITY_TYPES = new Set<string>(['policy_bank', 'soe', 'sovereign_fund', 'commercial', 'unknown']);
const COMMITMENT_SET = new Set<string>(['rumored', 'identified', 'committed', 'signed']);

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s || null;
}

function slug(v: unknown): string {
  return String(v ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

export function normalizeSector(v: unknown): Sector {
  const s = slug(v);
  if (SECTOR_SET.has(s)) return s as Sector;
  if (/infra|port|rail|transport|logistic|airport|bridge|highway/.test(s)) return 'strategic_infrastructure';
  if (/digital|telecom|5g|data|cable|satellite|smart_city|cloud/.test(s)) return 'digital_connectivity';
  if (/energy|power|nuclear|lng|electric|pipeline|mineral|oil|gas/.test(s)) return 'energy';
  if (/cyber|security|surveillance/.test(s)) return 'cybersecurity';
  return 'other';
}

export function normalizeStage(v: unknown): LifecycleStage {
  const s = slug(v);
  if (STAGE_SET.has(s)) return s as LifecycleStage;
  // Order matters: more specific / later-stage signals first.
  if (/cancel|collaps|abandon/.test(s)) return 'cancelled';
  if (/complet|operational|inaugurat/.test(s)) return 'completed';
  if (/construct|ground|build/.test(s)) return 'under_construction';
  if (/financ|loan|fund/.test(s)) return 'financing_secured';
  if (/sign|agree|contract/.test(s)) return 'signed';
  if (/negotiat|talk|discussion/.test(s)) return 'negotiation';
  if (/mou|explorator|feasibil|study/.test(s)) return 'exploratory_mou';
  return 'rumored';
}

// Accepts numbers or strings like "$1.2 billion", "450M", "1,200,000,000".
export function parseUsd(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  if (typeof v !== 'string') return null;
  const s = v.toLowerCase().replace(/[$,\s]|usd/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(billion|bn|b|million|mn|m|thousand|k)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2] ?? '';
  const mult = unit.startsWith('b') ? 1e9 : unit.startsWith('m') ? 1e6 : unit ? 1e3 : 1;
  return Math.round(n * mult);
}

function normalizeEntities(v: unknown): SponsoringEntity[] {
  if (!Array.isArray(v)) return [];
  const out: SponsoringEntity[] = [];
  for (const e of v as Array<Record<string, unknown>>) {
    const name = str(e?.name);
    if (!name) continue;
    const type = ENTITY_TYPES.has(slug(e?.type)) ? (slug(e?.type) as SponsoringEntity['type']) : 'unknown';
    const status = COMMITMENT_SET.has(slug(e?.commitment_status))
      ? (slug(e?.commitment_status) as SponsoringEntity['commitment_status'])
      : 'rumored';
    out.push({ name: name.slice(0, 160), type, country: str(e?.country), commitment_status: status });
  }
  return out;
}

// Coerce loose date strings to a valid ISO date (DATE column requires YYYY-MM-DD).
export function normalizeKeyDates(v: unknown): Array<{ date: string; description: string }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ date: string; description: string }> = [];
  for (const e of v as Array<Record<string, unknown>>) {
    const description = str(e?.description);
    const d = str(e?.date);
    let iso: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) iso = d.slice(0, 10);
    else if (/^\d{4}-\d{2}$/.test(d)) iso = `${d}-01`;
    else if (/^\d{4}$/.test(d)) iso = `${d}-01-01`;
    if (iso && description) out.push({ date: iso, description: description.slice(0, 300) });
  }
  return out;
}

export function normalizeCandidate(raw: DealCandidate): DealCandidate {
  const r = raw as unknown as Record<string, unknown>;
  const confidence = typeof r.confidence === 'number' ? Math.min(1, Math.max(0, r.confidence)) : 0.5;
  return {
    title: str(r.title).slice(0, 300),
    sponsoring_state: strOrNull(r.sponsoring_state),
    sponsoring_entities: normalizeEntities(r.sponsoring_entities),
    host_country: strOrNull(r.host_country),
    host_region: strOrNull(r.host_region),
    sector: normalizeSector(r.sector),
    subsector: strOrNull(r.subsector),
    lifecycle_stage: normalizeStage(r.lifecycle_stage),
    lifecycle_reasoning: str(r.lifecycle_reasoning),
    rom_value_usd: parseUsd(r.rom_value_usd),
    rom_basis: strOrNull(r.rom_basis),
    financial_sponsors: normalizeEntities(r.financial_sponsors),
    is_confirmed: r.is_confirmed === true,
    executive_summary: str(r.executive_summary),
    us_diplomatic_context: str(r.us_diplomatic_context),
    key_dates: normalizeKeyDates(r.key_dates),
    source_urls: Array.isArray(r.source_urls) ? (r.source_urls as unknown[]).filter((u): u is string => typeof u === 'string') : [],
    confidence,
  };
}
