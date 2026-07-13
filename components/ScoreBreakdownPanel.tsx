import type { ScoreBreakdown } from '@/lib/types';
import { scoreBarClass } from '@/lib/utils/format';

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
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Score Breakdown
        </div>
        <div className="font-mono-numbers font-semibold text-foreground">
          {composite?.toFixed(1) ?? '—'} / 100
        </div>
      </div>

      <div className="space-y-4">
        {dims.map(([key, sub]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-foreground">{DIM_LABELS[key]}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono-numbers">
                  ×{(sub.weight * 100).toFixed(0)}%
                </span>
                <span className="text-sm font-semibold font-mono-numbers text-foreground w-8 text-right">
                  {sub.score}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full rounded-full transition-all ${scoreBarClass(sub.score)}`}
                style={{ width: `${sub.score}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{sub.reasoning}</p>
            <div className="text-right text-xs text-muted-foreground/70 font-mono-numbers">
              contribution: {sub.contribution.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
