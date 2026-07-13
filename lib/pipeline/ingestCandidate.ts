import {
  upsertDeal,
  getDealById,
  linkSourceToDeal,
  addDealEvent,
} from '../db/queries';
import { findDuplicateDeal, mergeCandidateIntoDeal } from './deduplication';
import { normalizeCandidate } from './normalize';
import { scoreDeal } from './scoring';
import { generateDealSummary } from '../llm/analyze';
import type { ConfidenceTier, Deal, DealCandidate } from '../types';

export interface IngestSourceRef {
  id: string;
  url: string;
  title: string | null;
  published_at: string | null;
}

export interface CandidateContext {
  // Sources persisted this run, keyed by URL, so a candidate's cited URLs resolve to ids.
  sourcesByUrl?: Map<string, IngestSourceRef>;
  // Sources always linked to the deal regardless of URL (e.g. an uploaded document's
  // own source row). Also used as evidence for summary generation.
  pinnedSources?: IngestSourceRef[];
  // Confidence tier stamped on newly-created deals (uploads = 1, press = 2).
  sourceConfidenceTier?: ConfidenceTier;
  // Whether to spend an LLM call generating executive summary + diplomatic context.
  generateSummaries?: boolean;
}

export type IngestOutcome = 'created' | 'updated' | 'skipped';

const today = () => new Date().toISOString().slice(0, 10);

// Resolve the full set of source refs backing this candidate (cited URLs + pinned).
function resolveSources(candidate: DealCandidate, ctx: CandidateContext): IngestSourceRef[] {
  const byId = new Map<string, IngestSourceRef>();
  for (const url of candidate.source_urls ?? []) {
    const ref = ctx.sourcesByUrl?.get(url);
    if (ref) byId.set(ref.id, ref);
  }
  for (const ref of ctx.pinnedSources ?? []) {
    byId.set(ref.id, ref);
  }
  return [...byId.values()];
}

// Process one extracted candidate: create a new deal or merge it into an existing
// one, keeping the running tab of each transaction current. Writes timeline events
// for every material change so the deal's evolution is auditable.
export async function ingestCandidate(
  rawCandidate: DealCandidate,
  ctx: CandidateContext
): Promise<IngestOutcome> {
  // Coerce LLM output to schema-safe values (enum casing, synonyms, loose dates,
  // "$1.2 billion" strings) so CHECK constraints can't silently kill the insert.
  const candidate = normalizeCandidate(rawCandidate);
  if (!candidate.title) return 'skipped';

  const sources = resolveSources(candidate, ctx);
  const dup = await findDuplicateDeal(candidate);

  if (dup && !dup.isNew) {
    const existing = await getDealById(dup.dealId);
    if (!existing) return 'skipped';

    const merged = mergeCandidateIntoDeal(existing, candidate);
    const hasFieldChanges = Object.keys(merged).length > 0;

    // Link any new sources (idempotent) and count how many are genuinely new.
    const alreadyLinked = new Set((existing.sources ?? []).map((s) => s.id));
    let newlyLinked = 0;
    for (const ref of sources) {
      await linkSourceToDeal(existing.id, ref.id);
      if (!alreadyLinked.has(ref.id)) newlyLinked++;
    }

    if (!hasFieldChanges && newlyLinked === 0) return 'skipped';

    const newSourceCount = existing.source_count + newlyLinked;
    const nextState = { ...existing, ...merged, source_count: newSourceCount };
    const { composite, breakdown } = await scoreDeal(nextState);

    await upsertDeal({
      id: existing.id,
      ...merged,
      composite_score: composite,
      score_breakdown: breakdown,
      score_calculated_at: new Date().toISOString(),
      source_count: newSourceCount,
    });

    await logChangeEvents(existing, merged, newlyLinked);
    return 'updated';
  }

  // ─── New deal ────────────────────────────────────────────────────────────────
  const { composite, breakdown } = await scoreDeal({
    ...(candidate as Partial<Deal>),
    source_count: sources.length || candidate.source_urls?.length || 1,
    source_confidence_tier: ctx.sourceConfidenceTier ?? 2,
  });

  const newDeal = await upsertDeal({
    title: candidate.title,
    sponsoring_state: candidate.sponsoring_state,
    sponsoring_entities: candidate.sponsoring_entities ?? [],
    host_country: candidate.host_country,
    host_region: candidate.host_region,
    sector: candidate.sector,
    subsector: candidate.subsector,
    lifecycle_stage: candidate.lifecycle_stage ?? 'rumored',
    lifecycle_reasoning: candidate.lifecycle_reasoning,
    lifecycle_inferred_at: new Date().toISOString(),
    rom_value_usd: candidate.rom_value_usd,
    rom_basis: candidate.rom_basis,
    financial_sponsors: candidate.financial_sponsors ?? [],
    is_confirmed: candidate.is_confirmed ?? false,
    composite_score: composite,
    score_breakdown: breakdown,
    score_calculated_at: new Date().toISOString(),
    source_count: sources.length || 1,
    source_confidence_tier: ctx.sourceConfidenceTier ?? 2,
    status: 'active',
  });

  for (const ref of sources) {
    await linkSourceToDeal(newDeal.id, ref.id);
  }

  // Seed the timeline: a "first seen" marker plus any LLM-extracted key dates.
  await addDealEvent({
    deal_id: newDeal.id,
    event_date: today(),
    description: `Deal first tracked (stage: ${candidate.lifecycle_stage ?? 'rumored'})`,
    source_id: sources[0]?.id ?? null,
  });
  for (const evt of candidate.key_dates ?? []) {
    try {
      await addDealEvent({
        deal_id: newDeal.id,
        event_date: evt.date.slice(0, 10),
        description: evt.description,
        source_id: null,
      });
    } catch {
      // skip malformed date
    }
  }

  // Generate summary + diplomatic context if we have evidence and a host country.
  if (ctx.generateSummaries !== false && sources.length > 0 && candidate.host_country) {
    const summaries = await generateDealSummary(
      newDeal.title,
      candidate.host_country,
      candidate.sponsoring_state,
      candidate.sector,
      sources
    );
    if (summaries) {
      await upsertDeal({
        id: newDeal.id,
        executive_summary: summaries.executive_summary,
        executive_summary_generated_at: new Date().toISOString(),
        us_diplomatic_context: summaries.us_diplomatic_context,
        us_diplomatic_context_generated_at: new Date().toISOString(),
      });
    }
  }

  return 'created';
}

// Append timeline events describing what changed on a merge — the audit ledger.
async function logChangeEvents(
  existing: Deal,
  merged: Partial<Deal>,
  newlyLinked: number
): Promise<void> {
  const events: string[] = [];

  if (merged.lifecycle_stage && merged.lifecycle_stage !== existing.lifecycle_stage) {
    events.push(
      `Stage advanced: ${existing.lifecycle_stage} → ${merged.lifecycle_stage}` +
        (merged.lifecycle_reasoning ? ` — ${merged.lifecycle_reasoning}` : '')
    );
  }
  if (merged.rom_value_usd && !existing.rom_value_usd) {
    events.push(`Deal value first reported: ~$${merged.rom_value_usd.toLocaleString()}`);
  }
  if (merged.sponsoring_state && !existing.sponsoring_state) {
    events.push(`Sponsoring state identified: ${merged.sponsoring_state}`);
  }
  if (merged.financial_sponsors) {
    const added = merged.financial_sponsors.length - existing.financial_sponsors.length;
    if (added > 0) events.push(`${added} new financial sponsor(s) identified`);
  }
  if (events.length === 0 && newlyLinked > 0) {
    events.push(`${newlyLinked} new corroborating source(s) added`);
  }

  for (const description of events) {
    try {
      await addDealEvent({
        deal_id: existing.id,
        event_date: today(),
        description,
        source_id: null,
      });
    } catch {
      // non-fatal
    }
  }
}
