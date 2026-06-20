import Link from 'next/link';
import type { Deal } from '@/lib/types';
import {
  formatSector, formatStage, formatRom, formatRelativeTime,
  sectorColorClass, stageColorClass, scoreColorClass,
} from '@/lib/utils/format';

export function DealCard({ deal }: { deal: Deal }) {
  const scoreColor = scoreColorClass(deal.composite_score);
  const hasScore = deal.composite_score != null;

  return (
    <Link href={`/dashboard/deals/${deal.id}`} className="block group">
      <article className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full transition-all duration-150 hover:border-slate-600 hover:bg-slate-900/80 group-hover:shadow-lg group-hover:shadow-black/40">

        {/* Score bar on left + header */}
        <div className="flex">
          {/* Score accent stripe */}
          <div className={`w-1 flex-shrink-0 ${
            hasScore && deal.composite_score! >= 70 ? 'bg-red-500' :
            hasScore && deal.composite_score! >= 50 ? 'bg-orange-500' :
            hasScore && deal.composite_score! >= 30 ? 'bg-yellow-500' :
            'bg-slate-700'
          }`} />

          <div className="flex-1 p-4 pb-3">
            {/* Meta badges */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {deal.sponsoring_state && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-900 uppercase tracking-wider">
                  {deal.sponsoring_state}
                </span>
              )}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${sectorColorClass(deal.sector)}`}>
                {formatSector(deal.sector)}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${stageColorClass(deal.lifecycle_stage)}`}>
                {formatStage(deal.lifecycle_stage)}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-slate-200 leading-snug line-clamp-2 mb-1 group-hover:text-slate-100">
              {deal.title}
            </h3>

            {/* Country */}
            {deal.host_country && (
              <p className="text-xs text-slate-500">
                {deal.host_country}
                {deal.host_region && <span className="text-slate-600"> · {deal.host_region}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Score + key data row */}
        <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Composite score */}
            <div>
              <div className={`text-2xl font-black font-mono-numbers leading-none ${scoreColor}`}>
                {hasScore ? deal.composite_score!.toFixed(0) : '—'}
              </div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5">Score</div>
            </div>

            {/* ROM */}
            {deal.rom_value_usd && (
              <div>
                <div className="text-sm font-semibold text-slate-300 font-mono-numbers">
                  {formatRom(deal.rom_value_usd, deal.rom_value_min, deal.rom_value_max)}
                </div>
                <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5">ROM</div>
              </div>
            )}
          </div>

          {/* Sub-score mini-bars */}
          {deal.score_breakdown && (
            <div className="hidden sm:flex flex-col gap-1 items-end">
              {(['likelihood', 'actionability', 'financing'] as const).map((dim) => {
                const sub = deal.score_breakdown![dim];
                return (
                  <div key={dim} className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-600 w-16 text-right capitalize">
                      {dim.slice(0, 6)}
                    </span>
                    <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${scoreColor.replace('text-', 'bg-')}`}
                        style={{ width: `${sub.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary excerpt */}
        {deal.executive_summary && (
          <div className="border-t border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
              {deal.executive_summary}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-600">
            {deal.source_count} source{deal.source_count !== 1 ? 's' : ''}
            {' · '}
            {deal.is_confirmed ? (
              <span className="text-green-600">Confirmed</span>
            ) : (
              <span className="text-slate-600">Unconfirmed</span>
            )}
          </span>
          <span className="text-[10px] text-slate-600">{formatRelativeTime(deal.last_updated_at)}</span>
        </div>
      </article>
    </Link>
  );
}
