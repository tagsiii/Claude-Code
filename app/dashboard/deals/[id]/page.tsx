import { getDealById } from '@/lib/db/queries';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ScoreBreakdownPanel } from '@/components/ScoreBreakdownPanel';
import { TimelinePanel } from '@/components/TimelinePanel';
import { SourcesPanel } from '@/components/SourcesPanel';
import {
  formatSector, formatStage, formatRom, formatDate, formatRelativeTime,
  sectorColorClass, stageColorClass, scoreColorClass, scoreBgClass,
} from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const deal = await getDealById(params.id);
  if (!deal) notFound();

  const scoreColor = scoreColorClass(deal.composite_score);
  const scoreBg = scoreBgClass(deal.composite_score);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
        ← Back to Dashboard
      </Link>

      {/* Header card */}
      <div className={`border rounded-xl overflow-hidden ${scoreBg}`}>
        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-3">
            {deal.sponsoring_state && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-950 text-red-400 border border-red-900">
                {deal.sponsoring_state}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${sectorColorClass(deal.sector)}`}>
              {formatSector(deal.sector)}
              {deal.subsector && ` · ${deal.subsector}`}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${stageColorClass(deal.lifecycle_stage)}`}>
              {formatStage(deal.lifecycle_stage)}
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">
              {deal.host_country ?? 'Country unknown'}
              {deal.host_region && ` · ${deal.host_region}`}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 leading-tight mb-2">{deal.title}</h1>
          <p className="text-slate-500 text-xs">
            First seen {formatDate(deal.first_seen_at)} · Updated {formatRelativeTime(deal.last_updated_at)} ·{' '}
            {deal.source_count} source{deal.source_count !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Score bar */}
        <div className="border-t border-slate-800 px-6 py-4 flex items-center gap-6">
          <div>
            <div className={`text-4xl font-black font-mono-numbers ${scoreColor}`}>
              {deal.composite_score?.toFixed(0) ?? '—'}
            </div>
            <div className="text-slate-600 text-xs">/ 100</div>
          </div>
          <div className="text-slate-400 text-xs">
            <div className="font-semibold text-slate-300 mb-1">Executability Score</div>
            <div>Composite of 5 weighted sub-scores</div>
          </div>
        </div>
      </div>

      {/* ROM */}
      {deal.rom_value_usd && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Transaction Size (ROM)
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono-numbers">
            {formatRom(deal.rom_value_usd, deal.rom_value_min, deal.rom_value_max)}
          </div>
          {deal.rom_basis && (
            <div className="text-slate-500 text-sm mt-1">Basis: {deal.rom_basis}</div>
          )}
        </div>
      )}

      {/* Executive Summary */}
      {deal.executive_summary && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Executive Summary
          </div>
          <p className="text-slate-200 leading-relaxed">{deal.executive_summary}</p>
          <p className="text-slate-600 text-xs mt-3">
            {deal.is_confirmed ? '✓ Confirmed' : '○ Unconfirmed / Reported'} · Confidence tier:{' '}
            {deal.source_confidence_tier === 1 ? 'Primary/Official' : deal.source_confidence_tier === 2 ? 'Established Press' : 'Secondary'}
          </p>
        </div>
      )}

      {/* Lifecycle reasoning */}
      {deal.lifecycle_reasoning && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Lifecycle Stage Inference
          </div>
          <p className="text-slate-300 text-sm">{deal.lifecycle_reasoning}</p>
          {deal.lifecycle_inferred_at && (
            <p className="text-slate-600 text-xs mt-2">Inferred {formatDate(deal.lifecycle_inferred_at)}</p>
          )}
        </div>
      )}

      {/* Score Breakdown */}
      {deal.score_breakdown && <ScoreBreakdownPanel breakdown={deal.score_breakdown} composite={deal.composite_score} />}

      {/* Financial Sponsors */}
      {deal.financial_sponsors && deal.financial_sponsors.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Financial Sponsors
          </div>
          <div className="space-y-2">
            {deal.financial_sponsors.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2.5">
                <div>
                  <span className="text-slate-200 font-medium text-sm">{s.name}</span>
                  <span className="text-slate-500 text-xs ml-2">{s.country} · {s.type.replace('_', ' ')}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                  s.commitment_status === 'signed' ? 'bg-green-950 text-green-300' :
                  s.commitment_status === 'committed' ? 'bg-blue-950 text-blue-300' :
                  s.commitment_status === 'identified' ? 'bg-yellow-950 text-yellow-300' :
                  'bg-slate-700 text-slate-400'
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
        <div className="bg-slate-900 border border-slate-800 border-l-2 border-l-blue-600 rounded-xl p-5">
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">
            US Diplomatic Context — {deal.host_country}
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{deal.us_diplomatic_context}</p>
        </div>
      )}

      {/* Timeline */}
      {deal.events && deal.events.length > 0 && <TimelinePanel events={deal.events} />}

      {/* Sources */}
      {deal.sources && deal.sources.length > 0 && <SourcesPanel sources={deal.sources} />}
    </div>
  );
}
