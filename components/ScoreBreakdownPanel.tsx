import type { ScoreBreakdown } from '@/lib/types';

const DIM_LABELS: Record<keyof ScoreBreakdown, string> = {
  likelihood: 'Likelihood to Close',
  actionability: 'US Actionability Window',
  financing: 'Financing Certainty',
  corroboration: 'Source Corroboration',
  strategic_priority: 'Strategic Priority',
};

export function ScoreBreakdownPanel({
  breakdown,
  composite,
}: {
  breakdown: ScoreBreakdown;
  composite: number | null;
}) {
  const dims = Object.entries(breakdown) as [keyof ScoreBreakdown, ScoreBreakdown[keyof ScoreBreakdown]][];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Score Breakdown
        </div>
        <div className="font-mono-numbers font-black text-slate-200">
          {composite?.toFixed(1) ?? '—'} / 100
        </div>
      </div>

      <div className="space-y-4">
        {dims.map(([key, sub]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-300">{DIM_LABELS[key]}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-mono-numbers">
                  ×{(sub.weight * 100).toFixed(0)}%
                </span>
                <span className="text-sm font-semibold font-mono-numbers text-slate-200 w-8 text-right">
                  {sub.score}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all ${
                  sub.score >= 70 ? 'bg-red-500' :
                  sub.score >= 50 ? 'bg-orange-500' :
                  sub.score >= 30 ? 'bg-yellow-500' :
                  'bg-slate-600'
                }`}
                style={{ width: `${sub.score}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{sub.reasoning}</p>
            <div className="text-right text-xs text-slate-600 font-mono-numbers">
              contribution: {sub.contribution.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
