import type { Source } from '@/lib/types';
import { formatDate, tierColorClass } from '@/lib/utils/format';

export function SourcesPanel({ sources }: { sources: Source[] }) {
  const sorted = [...sources].sort((a, b) => a.confidence_tier - b.confidence_tier);

  const tierLabel = (t: number) =>
    t === 1 ? 'Primary/Official' : t === 2 ? 'Established Press' : 'Secondary';

  return (
    <div className="card p-5">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Sources ({sources.length})
      </div>
      <div className="space-y-2">
        {sorted.map((src) => (
          <div key={src.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
            <span className={`text-[10px] font-semibold uppercase shrink-0 mt-0.5 ${tierColorClass(src.confidence_tier)}`}>
              T{src.confidence_tier}
            </span>
            <div className="min-w-0 flex-1">
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline leading-snug block truncate"
              >
                {src.title ?? src.url}
              </a>
              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>{src.connector}</span>
                {src.published_at && <span>Published {formatDate(src.published_at)}</span>}
                <span>Retrieved {formatDate(src.retrieved_at)}</span>
                <span className={tierColorClass(src.confidence_tier)}>{tierLabel(src.confidence_tier)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
