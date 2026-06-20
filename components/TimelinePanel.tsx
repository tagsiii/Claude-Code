import type { DealEvent } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

export function TimelinePanel({ events }: { events: DealEvent[] }) {
  const sorted = [...events].sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Transaction Timeline
      </div>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-800" />
        <div className="space-y-4">
          {sorted.map((evt, i) => (
            <div key={evt.id ?? i} className="flex gap-4 pl-5 relative">
              <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-slate-900" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 font-mono-numbers mb-0.5">
                  {evt.event_date ? formatDate(evt.event_date) : 'Date unknown'}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{evt.description}</p>
                {evt.source_url && (
                  <a
                    href={evt.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-400 mt-0.5 block truncate"
                  >
                    {evt.source_title ?? evt.source_url}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
