import {
  upsertDeal,
  getDealById,
  linkSourceToDeal,
  addDealEvent,
  updateSourceExcerpt,
  linkDealSponsor,
} from '../db/queries';
import { findDuplicateDeal, mergeCandidateIntoDeal } from './deduplication';
import { normalizeCandidate } from './normalize';
import { resolveSponsorEntities } from './sponsors';
import { geocodeCandidate, applyDealLocation, type GeoResult } from './geocode';
import { applySpatialFlags, anyFlagSet, flagsChanged, newlyRaisedFlags } from './spatialFlags';
import {
  countIndependentSources, computeQualityGrade, autoReviewStatus,
  stampProvenance, sourceLabel, type Provenance,
} from './quality';
import { matchCnProject } from '../db/queries';
import { scoreDeal } from './scoring';
import { generateDealSummary, extractDealFacts, type DealFacts } from '../llm/analyze';
import { fetchArticleText } from '../utils/articleFetch';
import type { ConfidenceTier, Deal, DealCandidate, EnrichmentDetails, LocationPrecision } from '../types';

export interface IngestSourceRef {
  id: string;
  url: string;
  title: string | null;
  published_at: string | null;
  // Full-text excerpt when the caller already has content (document uploads).
  excerpt?: string | null;
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
  // Sink for non-fatal geo/sponsor resolution problems (recorded in run logs).
  warnings?: string[];
}

const PRECISION_RANK: Record<LocationPrecision, number> = {
  exact: 4, facility: 3, city: 2, country_centroid: 1, unknown: 0,
};

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

  // Canonical sponsor resolution (best-effort; canonicalizes JSONB names and
  // yields sponsor ids for the junction table + dedup overlap checks).
  const resolvedFinancial = await resolveSponsorEntities(candidate.financial_sponsors, ctx.warnings);
  candidate.financial_sponsors = resolvedFinancial.map((r) => r.entity);
  const resolvedSponsoring = await resolveSponsorEntities(candidate.sponsoring_entities, ctx.warnings);
  candidate.sponsoring_entities = resolvedSponsoring.map((r) => r.entity);
  const sponsorIds = [...resolvedFinancial, ...resolvedSponsoring]
    .map((r) => r.sponsorId)
    .filter((id): id is string => !!id);
  const sponsorKeys = [...candidate.financial_sponsors, ...candidate.sponsoring_entities].map((s) => s.name);

  // Geocode: facility → city → country centroid (best-effort).
  const geo: GeoResult | null = await geocodeCandidate(candidate, ctx.warnings);

  // Official-record cross-reference: does AidData already know this project?
  // (Best-effort; pre-migration databases return null.)
  const candidateIso3 = candidate.host_country_iso3 ?? geo?.iso3 ?? null;
  const xref = candidateIso3 ? await matchCnProject(candidate.title, candidateIso3) : null;

  const dup = await findDuplicateDeal(candidate, {
    facilityId: geo?.facilityId ?? null,
    sponsorKeys,
  });

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

    // Geo upgrade on merge: better precision wins, never downgrades. Runs
    // BEFORE the skip check — a re-seen candidate whose facility now resolves
    // (e.g. the gazetteer was loaded after the deal was created) must still
    // upgrade the location even when no other field changed.
    let geoUpgraded = false;
    if (geo) {
      const existingRank = PRECISION_RANK[existing.location_precision ?? 'unknown'] ?? 0;
      if (PRECISION_RANK[geo.precision] > existingRank) {
        const ok = await applyDealLocation(existing.id, geo, ctx.warnings);
        if (ok) {
          geoUpgraded = true;
          if (geo.precision === 'facility' && geo.facilityName) {
            try {
              await addDealEvent({
                deal_id: existing.id,
                event_date: today(),
                description: `Location resolved to facility: ${geo.facilityName}`,
                source_id: null,
              });
            } catch { /* non-fatal */ }
          }
        }
      }
    }
    for (const sponsorId of sponsorIds) {
      try { await linkDealSponsor(existing.id, sponsorId); } catch { /* pre-migration */ }
    }

    // Spatial flags (Phase 4): recompute after any potential location change.
    // The RPC persists them; a flip forces a rescore even with no field changes.
    const flags = (await applySpatialFlags(existing.id, ctx.warnings)) ?? {};
    const spatialChanged = flagsChanged(existing, flags);
    for (const raised of newlyRaisedFlags(existing, flags)) {
      try {
        await addDealEvent({
          deal_id: existing.id,
          event_date: today(),
          description: `Spatial signal raised: ${raised.reason}`,
          source_id: null,
        });
      } catch { /* non-fatal */ }
    }

    // Official-record cross-reference lands once, then sticks.
    const xrefNew = !existing.xref_cn_ref && xref ? xref : null;
    if (xrefNew) {
      try {
        await addDealEvent({
          deal_id: existing.id,
          event_date: today(),
          description: `Corroborated by official record: AidData project ${xrefNew.ref} — "${xrefNew.title.slice(0, 100)}"`,
          source_id: null,
        });
      } catch { /* non-fatal */ }
    }

    if (!hasFieldChanges && newlyLinked === 0 && !spatialChanged && !xrefNew) {
      return geoUpgraded ? 'updated' : 'skipped';
    }

    // Targeted re-enrichment: a NEW article about a deal missing key facts is
    // worth one read — fill value/sponsors from the body, not just the title.
    let mergedAll = merged;
    let enrichmentDetails: EnrichmentDetails | null = null;
    let enrichLabel: string | null = null;
    const needsFacts =
      !existing.rom_value_usd || (existing.financial_sponsors?.length ?? 0) === 0 || !existing.enrichment_details;
    if (newlyLinked > 0 && needsFacts && ctx.generateSummaries !== false) {
      try {
        const freshRef = sources.find((s) => !alreadyLinked.has(s.id) && /^https?:/i.test(s.url));
        if (freshRef) {
          const text = freshRef.excerpt ?? (await fetchArticleText(freshRef.url));
          if (text) {
            if (!freshRef.excerpt) await updateSourceExcerpt(freshRef.id, text);
            const facts = await extractDealFacts(existing.title, [{ url: freshRef.url, text: text.slice(0, 5000) }]);
            if (facts) {
              const factCandidate = normalizeCandidate({
                ...facts, title: existing.title, sector: existing.sector,
              } as DealCandidate);
              const merged2 = mergeCandidateIntoDeal({ ...existing, ...merged } as Deal, factCandidate);
              mergedAll = { ...merged, ...merged2 };
              enrichmentDetails = buildEnrichmentDetails(facts, existing.enrichment_details);
              enrichLabel = sourceLabel(freshRef);
            }
          }
        }
      } catch { /* re-enrichment is best-effort */ }
    }

    // Independence, provenance, quality grade.
    const allUrls = [...(existing.sources ?? []).map((s) => s.url), ...sources.map((s) => s.url)];
    const independent = Math.max(1, countIndependentSources(allUrls));
    const newRef = sources.find((s) => !alreadyLinked.has(s.id));
    const provLabel = enrichLabel ?? (newRef ? sourceLabel(newRef) : 'update');
    const provenance: Provenance = stampProvenance(
      existing.provenance,
      Object.keys(mergedAll).filter((k) => !k.endsWith('_reasoning') && !k.endsWith('_inferred_at')),
      provLabel,
      today()
    );
    const gradeInput = {
      ...existing, ...mergedAll, ...flags,
      xref_cn_ref: xrefNew?.ref ?? existing.xref_cn_ref,
      location_precision: geoUpgraded && geo ? geo.precision : existing.location_precision,
      source_confidence_tier: existing.source_confidence_tier,
    };
    const { grade, components } = computeQualityGrade(gradeInput, independent);

    const newSourceCount = existing.source_count + newlyLinked;
    const nextState = {
      ...gradeInput,
      source_count: newSourceCount,
      independent_source_count: independent,
    };
    const { composite, breakdown } = await scoreDeal(nextState);

    await upsertDealSafe({
      id: existing.id,
      ...mergedAll,
      composite_score: composite,
      score_breakdown: breakdown,
      score_calculated_at: new Date().toISOString(),
      source_count: newSourceCount,
    }, {
      independent_source_count: independent,
      provenance,
      data_quality_grade: grade,
      quality_components: components,
      ...(enrichmentDetails ? { enrichment_details: enrichmentDetails } : {}),
      ...(xrefNew ? { xref_cn_ref: xrefNew.ref, xref_note: xrefNew.note } : {}),
      ...(newlyLinked > 0 ? { last_corroborated_at: new Date().toISOString() } : {}),
    });

    await logChangeEvents(existing, mergedAll, newlyLinked);

    return 'updated';
  }

  // ─── New deal ────────────────────────────────────────────────────────────────
  // Independence, provenance, quality grade, and the review gate — all computed
  // BEFORE insert so a thin single-source rumor lands in the review queue
  // instead of the main table.
  const tier = ctx.sourceConfidenceTier ?? 2;
  const independent = Math.max(1, countIndependentSources(sources.map((s) => s.url)));
  const initialLabel = sources[0] ? sourceLabel(sources[0]) : 'initial report';
  const initialFields = (
    ['sponsoring_state', 'host_country', 'sector', 'subsector', 'lifecycle_stage', 'rom_value_usd', 'financial_sponsors'] as const
  ).filter((f) => {
    const v = candidate[f as keyof DealCandidate];
    return Array.isArray(v) ? v.length > 0 : v != null;
  });
  let provenance: Provenance = stampProvenance({}, [...initialFields], initialLabel, today());

  const { grade, components } = computeQualityGrade(
    {
      ...(candidate as Partial<Deal>),
      location_precision: geo?.precision,
      source_confidence_tier: tier as ConfidenceTier,
      xref_cn_ref: xref?.ref ?? null,
    },
    independent
  );
  const reviewStatus = autoReviewStatus(grade, tier, independent, candidate.is_confirmed ?? false);

  // Score against the SAME source_count that gets stored — cited-but-unresolved
  // URLs must not inflate the score, or the next merge silently rescores lower.
  const { composite, breakdown } = await scoreDeal({
    ...(candidate as Partial<Deal>),
    source_count: sources.length || 1,
    independent_source_count: independent,
    source_confidence_tier: tier as ConfidenceTier,
    xref_cn_ref: xref?.ref ?? null,
  });

  const newDeal = await upsertDealSafe({
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
    source_confidence_tier: tier as ConfidenceTier,
    status: 'active',
  }, {
    independent_source_count: independent,
    provenance,
    data_quality_grade: grade,
    quality_components: components,
    review_status: reviewStatus,
    ...(xref ? { xref_cn_ref: xref.ref, xref_note: xref.note, last_corroborated_at: new Date().toISOString() } : {}),
  });

  if (xref) {
    try {
      await addDealEvent({
        deal_id: newDeal.id,
        event_date: today(),
        description: `Corroborated by official record: AidData project ${xref.ref} — "${xref.title.slice(0, 100)}"`,
        source_id: null,
      });
    } catch { /* non-fatal */ }
  }

  for (const ref of sources) {
    await linkSourceToDeal(newDeal.id, ref.id);
  }

  // Location + canonical sponsor links (best-effort; no-ops before migration).
  if (geo) {
    const ok = await applyDealLocation(newDeal.id, geo, ctx.warnings);
    if (ok && geo.precision === 'facility' && geo.facilityName) {
      try {
        await addDealEvent({
          deal_id: newDeal.id,
          event_date: today(),
          description: `Location resolved to facility: ${geo.facilityName}`,
          source_id: null,
        });
      } catch { /* non-fatal */ }
    }
  }
  for (const sponsorId of sponsorIds) {
    try { await linkDealSponsor(newDeal.id, sponsorId); } catch { /* pre-migration */ }
  }

  // Spatial flags (Phase 4): computed after the location lands; a raised flag
  // reshapes the score, so rescore with the flags included.
  const newFlags = (await applySpatialFlags(newDeal.id, ctx.warnings)) ?? {};
  if (anyFlagSet(newFlags)) {
    const rescored = await scoreDeal({ ...newDeal, ...newFlags });
    await upsertDeal({
      id: newDeal.id,
      composite_score: rescored.composite,
      score_breakdown: rescored.breakdown,
      score_calculated_at: new Date().toISOString(),
    });
    for (const raised of newlyRaisedFlags({}, newFlags)) {
      try {
        await addDealEvent({
          deal_id: newDeal.id,
          event_date: today(),
          description: `Spatial signal raised: ${raised.reason}`,
          source_id: null,
        });
      } catch { /* non-fatal */ }
    }
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

  // ─── Enrichment: read the article BODIES, not just headlines ────────────────
  // News candidates are extracted from titles alone, which produces records
  // with no sponsors, values, or countries even when the article names them.
  // Fetch up to two source articles, extract concrete facts, and merge them
  // through the standard monotonic-merge path. Best-effort — a paywalled or
  // unreachable article just skips this step.
  let enrichedDeal: Deal = newDeal;
  if (ctx.generateSummaries !== false) {
    try {
      const fetched: Array<{ ref: IngestSourceRef; text: string }> = [];
      for (const ref of sources.filter((s) => /^https?:/i.test(s.url)).slice(0, 2)) {
        const text = ref.excerpt ?? (await fetchArticleText(ref.url));
        if (text) {
          fetched.push({ ref, text });
          if (!ref.excerpt) {
            ref.excerpt = text; // reuse for the summary below
            await updateSourceExcerpt(ref.id, text);
          }
        }
      }

      if (fetched.length > 0) {
        const facts = await extractDealFacts(
          newDeal.title,
          fetched.map((f) => ({ url: f.ref.url, text: f.text.slice(0, 5000) }))
        );
        if (facts) {
          const factCandidate = normalizeCandidate({
            ...facts,
            title: newDeal.title,
            sector: candidate.sector,
          } as DealCandidate);
          const merged = mergeCandidateIntoDeal(newDeal, factCandidate);
          const details = buildEnrichmentDetails(facts, null);

          // Verification gate: the article body says this ISN'T a real
          // state-backed cross-border deal → quarantine for human review.
          const v = facts.verification;
          const failsVerification =
            v?.is_genuine_deal === false && (v.confidence ?? 0) >= 0.6 && tier !== 1;

          const enrichSource = sourceLabel(fetched[0].ref);
          provenance = stampProvenance(
            provenance,
            Object.keys(merged).filter((k) => !k.endsWith('_reasoning') && !k.endsWith('_inferred_at')),
            enrichSource,
            today()
          );
          const regrade = computeQualityGrade(
            {
              ...newDeal, ...merged, ...newFlags,
              location_precision: geo?.precision ?? newDeal.location_precision,
              xref_cn_ref: xref?.ref ?? null,
            },
            independent
          );

          if (Object.keys(merged).length > 0 || details || failsVerification) {
            // Include the spatial flags so the enrichment rescore doesn't lose them.
            const { composite, breakdown } = await scoreDeal({ ...newDeal, ...newFlags, ...merged });
            enrichedDeal = (await upsertDealSafe({
              id: newDeal.id,
              ...merged,
              composite_score: composite,
              score_breakdown: breakdown,
              score_calculated_at: new Date().toISOString(),
            }, {
              provenance,
              data_quality_grade: regrade.grade,
              quality_components: regrade.components,
              ...(details ? { enrichment_details: details } : {}),
              ...(failsVerification
                ? { review_status: 'pending', review_note: `AI verification: ${v?.note ?? 'not a genuine deal'}` }
                : {}),
            })) as Deal;
          }
          for (const evt of factCandidate.key_dates) {
            try {
              await addDealEvent({
                deal_id: newDeal.id,
                event_date: evt.date,
                description: evt.description,
                source_id: fetched[0]?.ref.id ?? null,
              });
            } catch {
              // non-fatal
            }
          }
        }
      }
    } catch {
      // enrichment must never kill deal creation
    }
  }

  // Generate summary + diplomatic context if we have evidence and a host country.
  const hostCountry = enrichedDeal.host_country ?? candidate.host_country;
  if (ctx.generateSummaries !== false && sources.length > 0 && hostCountry) {
    const summaries = await generateDealSummary(
      enrichedDeal.title,
      hostCountry,
      enrichedDeal.sponsoring_state ?? candidate.sponsoring_state,
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

// Collapse the enrichment extras into the stored JSONB shape, preserving
// previously-known details when the new pass returned nothing for a section.
function buildEnrichmentDetails(
  facts: DealFacts,
  previous: EnrichmentDetails | null | undefined
): EnrichmentDetails | null {
  const details: EnrichmentDetails = { ...(previous ?? {}) };
  if (facts.financing_structure?.type || facts.financing_structure?.details) {
    details.financing_structure = facts.financing_structure;
  }
  if (facts.counterparties && facts.counterparties.length > 0) {
    const known = new Set((details.counterparties ?? []).map((c) => c.name.toLowerCase()));
    details.counterparties = [
      ...(details.counterparties ?? []),
      ...facts.counterparties.filter((c) => c.name && !known.has(c.name.toLowerCase())),
    ];
  }
  if (facts.verification) details.verification = facts.verification;
  return Object.keys(details).length > 0 ? details : null;
}

// Upsert that tolerates a pre-migration database: if the quality columns from
// quality.sql don't exist yet, retry with just the base payload so scans keep
// working before the user has run the migration.
async function upsertDealSafe(
  base: Partial<Deal>,
  qualityFields: Record<string, unknown>
): Promise<Deal> {
  try {
    return await upsertDeal({ ...base, ...qualityFields } as Partial<Deal>);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/column|schema cache/i.test(msg)) {
      return upsertDeal(base);
    }
    throw err;
  }
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
      (merged.lifecycle_stage === 'cancelled'
        ? `Deal reported cancelled (was ${existing.lifecycle_stage})`
        : `Stage advanced: ${existing.lifecycle_stage} → ${merged.lifecycle_stage}`) +
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
