import { getDealById } from '@/lib/db/queries';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ScoreBreakdownPanel } from '@/components/ScoreBreakdownPanel';
import { TimelinePanel } from '@/components/TimelinePanel';
import { SourcesPanel } from '@/components/SourcesPanel';
import { ReviewPanel } from '@/components/ReviewPanel';
import {
  formatSector, formatStage, formatRom, formatDate, formatRelativeTime, formatUsd,
  sectorColorClass, stageColorClass, scoreColorClass, scoreBgClass,
} from '@/lib/utils/format';
import type { Deal } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const deal = await getDealById(params.id);
  if (!deal) notFound();

  const scoreColor = scoreColorClass(deal.composite_score);
  const scoreBg = scoreBgClass(deal.composite_score);

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Back */}
      <Link href="/dashboard" className="text-muted-foreground hover:text-foreground text-sm transition-colors inline-block">
        ← Back to Dashboard
      </Link>

      {/* Header card */}
      <div className={`border rounded-2xl overflow-hidden shadow-card ${scoreBg}`}>
        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-3">
            {deal.sponsoring_state && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                {deal.sponsoring_state}
              </span>
            )}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sectorColorClass(deal.sector)}`}>
              {formatSector(deal.sector)}
              {deal.subsector && ` · ${deal.subsector}`}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${stageColorClass(deal.lifecycle_stage)}`}>
              {formatStage(deal.lifecycle_stage)}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
              {deal.host_country ?? 'Country unknown'}
              {deal.host_region && ` · ${deal.host_region}`}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground leading-tight mb-2">{deal.title}</h1>
          <p className="text-muted-foreground text-xs">
            First seen {formatDate(deal.first_seen_at)} · Updated {formatRelativeTime(deal.last_updated_at)} ·{' '}
            {deal.source_count} source{deal.source_count !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Score bar */}
        <div className="border-t border-border/60 px-6 py-4 flex items-center gap-6">
          <div>
            <div className={`text-4xl font-bold font-mono-numbers ${scoreColor}`}>
              {deal.composite_score?.toFixed(0) ?? '—'}
            </div>
            <div className="text-muted-foreground text-xs">/ 100</div>
          </div>
          <div className="text-muted-foreground text-xs">
            <div className="font-semibold text-foreground mb-1">Executability Score</div>
            <div>Composite of 5 weighted sub-scores</div>
          </div>
        </div>
      </div>

      {/* Review gate */}
      {deal.review_status === 'pending' && <ReviewPanel dealId={deal.id} note={deal.review_note} />}

      {/* Key facts — every load-bearing fact with its provenance */}
      <KeyFactsPanel deal={deal} />

      {/* ROM */}
      {deal.rom_value_usd && (
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Transaction Size (ROM)
          </div>
          <div className="text-2xl font-semibold text-foreground font-mono-numbers">
            {formatRom(deal.rom_value_usd, deal.rom_value_min, deal.rom_value_max)}
          </div>
          {deal.rom_basis && (
            <div className="text-muted-foreground text-sm mt-1">Basis: {deal.rom_basis}</div>
          )}
          <Provenance deal={deal} field="rom_value_usd" />
        </div>
      )}

      {/* Executive Summary */}
      {deal.executive_summary && (
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Executive Summary
          </div>
          <p className="text-foreground/90 leading-relaxed">{deal.executive_summary}</p>
          <p className="text-muted-foreground text-xs mt-3">
            {deal.is_confirmed ? '✓ Confirmed' : '○ Unconfirmed / Reported'} · Confidence tier:{' '}
            {deal.source_confidence_tier === 1 ? 'Primary/Official' : deal.source_confidence_tier === 2 ? 'Established Press' : 'Secondary'}
          </p>
        </div>
      )}

      {/* Lifecycle reasoning */}
      {deal.lifecycle_reasoning && (
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Lifecycle Stage Inference
          </div>
          <p className="text-foreground/90 text-sm">{deal.lifecycle_reasoning}</p>
          {deal.lifecycle_inferred_at && (
            <p className="text-muted-foreground text-xs mt-2">Inferred {formatDate(deal.lifecycle_inferred_at)}</p>
          )}
        </div>
      )}

      {/* Spatial signals (Phase 4) — deterministic geography-based flags */}
      <SpatialSignals deal={deal} />

      {/* Score Breakdown */}
      {deal.score_breakdown && <ScoreBreakdownPanel breakdown={deal.score_breakdown} composite={deal.composite_score} />}

      {/* Financial Sponsors */}
      {deal.financial_sponsors && deal.financial_sponsors.length > 0 && (
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Financial Sponsors
          </div>
          <div className="space-y-2">
            {deal.financial_sponsors.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-secondary rounded-xl px-4 py-2.5">
                <div>
                  <span className="text-foreground font-medium text-sm">{s.name}</span>
                  <span className="text-muted-foreground text-xs ml-2">{s.country} · {s.type.replace('_', ' ')}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  s.commitment_status === 'signed' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' :
                  s.commitment_status === 'committed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' :
                  s.commitment_status === 'identified' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' :
                  'bg-secondary text-muted-foreground'
                }`}>
                  {s.commitment_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* US Diplomatic Context */}
      {deal.us_diplomatic_context && (
        <div className="card p-5 border-l-2 border-l-primary">
          <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
            US Diplomatic Context — {deal.host_country}
          </div>
          <p className="text-foreground/90 text-sm leading-relaxed">{deal.us_diplomatic_context}</p>
        </div>
      )}

      {/* Timeline */}
      {deal.events && deal.events.length > 0 && <TimelinePanel events={deal.events} />}

      {/* Sources */}
      {deal.sources && deal.sources.length > 0 && <SourcesPanel sources={deal.sources} />}
    </div>
  );
}

// Which outlet asserted a fact, and when — the audit trail under each number.
function Provenance({ deal, field }: { deal: Deal; field: string }) {
  const p = deal.provenance?.[field];
  if (!p) return null;
  return (
    <div className="text-[11px] text-muted-foreground/80 mt-1.5">
      per {p.source} · {p.date}
    </div>
  );
}

// Data-quality + evidence panel: grade, what earned it, independence,
// official cross-reference, financing structure, counterparties, staleness.
function KeyFactsPanel({ deal }: { deal: Deal }) {
  const comp = (deal.quality_components ?? {}) as Record<string, unknown>;
  const details = deal.enrichment_details;
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(deal.last_updated_at).getTime()) / 86_400_000
  );
  const gradeTone =
    deal.data_quality_grade === 'A' ? 'text-green-600 dark:text-green-400'
    : deal.data_quality_grade === 'B' ? 'text-blue-600 dark:text-blue-400'
    : deal.data_quality_grade === 'C' ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  const evidence: Array<{ label: string; ok: boolean }> = [
    { label: 'Named sponsor', ok: comp.has_sponsor === true },
    { label: 'Sourced value', ok: comp.has_value === true },
    { label: '2+ independent outlets', ok: (deal.independent_source_count ?? 1) >= 2 },
    { label: 'Precise location', ok: comp.precise_location === true },
    { label: 'Official record match', ok: comp.official_xref === true },
    { label: 'Confirmed', ok: comp.confirmed === true },
  ];

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Evidence &amp; Key Facts
        </div>
        {deal.data_quality_grade && (
          <div className="text-right">
            <span className={`text-2xl font-bold font-mono-numbers ${gradeTone}`}>{deal.data_quality_grade}</span>
            <div className="text-[10px] text-muted-foreground">data quality</div>
          </div>
        )}
      </div>

      {deal.quality_components != null && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
          {evidence.map((e) => (
            <span key={e.label} className={`text-xs ${e.ok ? 'text-foreground/85' : 'text-muted-foreground/50 line-through'}`}>
              {e.ok ? '✓' : '✗'} {e.label}
            </span>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Independent sources</div>
          <div className="text-foreground font-medium">
            {deal.independent_source_count ?? deal.source_count} outlet{(deal.independent_source_count ?? deal.source_count) !== 1 ? 's' : ''}
            {(deal.independent_source_count ?? 2) < 2 && (
              <span className="ml-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">UNCORROBORATED</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Last corroborated</div>
          <div className={`font-medium ${daysSinceUpdate > 60 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
            {formatDate(deal.last_corroborated_at ?? deal.last_updated_at)}
            {daysSinceUpdate > 60 && ' · stale'}
          </div>
        </div>
        {deal.xref_cn_ref && (
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground">Official record</div>
            <div className="text-foreground font-medium text-[hsl(var(--success))]">✓ {deal.xref_note ?? `AidData ${deal.xref_cn_ref}`}</div>
          </div>
        )}
        {details?.financing_structure && (details.financing_structure.type || details.financing_structure.details) && (
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground">Financing structure</div>
            <div className="text-foreground">
              {details.financing_structure.type && details.financing_structure.type !== 'unknown' && (
                <span className="font-medium capitalize">{details.financing_structure.type}</span>
              )}
              {details.financing_structure.details && (
                <span className="text-foreground/85"> — {details.financing_structure.details}</span>
              )}
            </div>
          </div>
        )}
        {details?.counterparties && details.counterparties.length > 0 && (
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground mb-1">Counterparties</div>
            <div className="flex flex-wrap gap-1.5">
              {details.counterparties.map((c, i) => (
                <span key={i} className="text-xs bg-secondary rounded-full px-2.5 py-1 text-foreground">
                  {c.name}
                  {c.role && <span className="text-muted-foreground"> · {c.role}</span>}
                  {c.country && <span className="text-muted-foreground"> · {c.country}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
        {deal.lifecycle_stage && deal.provenance?.lifecycle_stage && (
          <div>
            <div className="text-xs text-muted-foreground">Stage asserted by</div>
            <div className="text-foreground text-xs">{deal.provenance.lifecycle_stage.source} · {deal.provenance.lifecycle_stage.date}</div>
          </div>
        )}
        {deal.provenance?.financial_sponsors && (
          <div>
            <div className="text-xs text-muted-foreground">Sponsors asserted by</div>
            <div className="text-foreground text-xs">{deal.provenance.financial_sponsors.source} · {deal.provenance.financial_sponsors.date}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// The five deterministic spatial flags with their stored reasons. Only raised
// flags render — a deal with no signals shows nothing.
function SpatialSignals({ deal }: { deal: import('@/lib/types').Deal }) {
  const signals: Array<{ label: string; reason: string | null | undefined; tone: string }> = [
    { label: 'Near cable landing', reason: deal.flag_near_cable_landing ? deal.flag_near_cable_landing_reason : null, tone: 'text-red-600 dark:text-red-400' },
    { label: 'White space', reason: deal.flag_white_space ? deal.flag_white_space_reason : null, tone: 'text-violet-600 dark:text-violet-400' },
    { label: 'Contested asset', reason: deal.flag_contested_asset ? deal.flag_contested_asset_reason : null, tone: 'text-orange-600 dark:text-orange-400' },
    { label: 'US positioning exists', reason: deal.flag_us_positioning ? deal.flag_us_positioning_reason : null, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Unpositioned MDB pipeline', reason: deal.flag_unpositioned_mdb ? deal.flag_unpositioned_mdb_reason : null, tone: 'text-teal-600 dark:text-teal-400' },
  ].filter((s) => s.reason != null);
  if (signals.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Spatial Signals
      </div>
      <div className="space-y-2.5">
        {signals.map((s) => (
          <div key={s.label} className="text-sm">
            <span className={`font-semibold ${s.tone}`}>{s.label}</span>
            <span className="text-foreground/85"> — {s.reason}</span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-[11px] mt-3">
        Computed deterministically from reference geography (no AI) — each signal adds fixed,
        documented points to Strategic Priority or US Actionability.
      </p>
    </div>
  );
}
