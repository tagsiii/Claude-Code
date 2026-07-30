'use client';

import { useRouter } from 'next/navigation';
import type { Deal } from '@/lib/types';
import { TimeAgo } from './TimeAgo';
import {
  formatSector,
  formatStage,
  formatRom,
  sectorColorClass,
  stageColorClass,
  scorePillClass,
  tierColorClass,
} from '@/lib/utils/format';

// Data-quality letter grade tint: A/B earn confidence colors, C/D warn.
function gradeClass(grade: string): string {
  if (grade === 'A') return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300';
  if (grade === 'B') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
  if (grade === 'C') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
}

export function DealTable({ deals }: { deals: Deal[] }) {
  const router = useRouter();

  async function review(id: string, status: 'approved' | 'rejected') {
    await fetch(`/api/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status: status }),
    });
    router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-muted-foreground border-b border-border">
              <th className="px-4 py-3 font-medium">Transaction</th>
              <th className="px-3 py-3 font-medium hidden md:table-cell">Sponsor</th>
              <th className="px-3 py-3 font-medium hidden lg:table-cell">Sector</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 font-medium text-right hidden sm:table-cell">Value</th>
              <th className="px-3 py-3 font-medium text-center hidden lg:table-cell">Sources</th>
              <th className="px-3 py-3 font-medium text-right">Score</th>
              <th className="px-4 py-3 font-medium text-right hidden lg:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr
                key={deal.id}
                onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                className="border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-secondary/60"
              >
                {/* Transaction */}
                <td className="px-4 py-3 max-w-[26rem]">
                  <a
                    href={`/dashboard/deals/${deal.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-foreground hover:text-primary line-clamp-2 leading-snug"
                  >
                    {deal.title}
                  </a>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {deal.host_country && (
                      <span>
                        {deal.host_country}
                        {deal.host_region && <span> · {deal.host_region}</span>}
                      </span>
                    )}
                    {deal.data_quality_grade && (
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold ${gradeClass(deal.data_quality_grade)}`}
                        title={`Data quality ${deal.data_quality_grade} — evidence completeness (sponsor, value, independent sources, location, official cross-reference)`}
                      >
                        {deal.data_quality_grade}
                      </span>
                    )}
                    {(deal.independent_source_count ?? 2) < 2 && (
                      <span
                        className="text-[10px] font-semibold text-amber-600 dark:text-amber-400"
                        title="Only one independent outlet reports this — treat with caution"
                      >
                        UNCORROBORATED
                      </span>
                    )}
                    {deal.review_status === 'pending' && (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          needs review
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); void review(deal.id, 'approved'); }}
                          className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300 hover:opacity-80"
                          title="Approve onto the main table"
                        >
                          ✓ approve
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); void review(deal.id, 'rejected'); }}
                          className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 hover:opacity-80"
                          title="Reject — hides it and blocks re-reported copies"
                        >
                          ✕ reject
                        </button>
                      </span>
                    )}
                    {deal.xref_cn_ref && (
                      <span
                        className="text-[10px] font-semibold text-[hsl(var(--success))]"
                        title={deal.xref_note ?? 'Matched to an official AidData record'}
                      >
                        ✓ official record
                      </span>
                    )}
                  </div>
                </td>

                {/* Sponsor */}
                <td className="px-3 py-3 hidden md:table-cell whitespace-nowrap">
                  <span className="text-foreground">{deal.sponsoring_state ?? '—'}</span>
                </td>

                {/* Sector */}
                <td className="px-3 py-3 hidden lg:table-cell">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sectorColorClass(deal.sector)}`}>
                    {formatSector(deal.sector)}
                  </span>
                </td>

                {/* Stage */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stageColorClass(deal.lifecycle_stage)}`}>
                    {formatStage(deal.lifecycle_stage)}
                  </span>
                </td>

                {/* Value */}
                <td className="px-3 py-3 text-right hidden sm:table-cell whitespace-nowrap font-mono-numbers text-foreground">
                  {deal.rom_value_usd
                    ? formatRom(deal.rom_value_usd, deal.rom_value_min, deal.rom_value_max)
                    : <span className="text-muted-foreground">—</span>}
                </td>

                {/* Sources: count + best confidence tier + confirmed dot */}
                <td className="px-3 py-3 text-center hidden lg:table-cell whitespace-nowrap">
                  <span className="text-foreground font-mono-numbers">{deal.source_count}</span>
                  <span
                    className={`ml-1.5 text-[10px] font-semibold ${tierColorClass(deal.source_confidence_tier)}`}
                    title={
                      deal.source_confidence_tier === 1
                        ? 'Best source: primary/official'
                        : deal.source_confidence_tier === 2
                          ? 'Best source: established press'
                          : 'Best source: secondary'
                    }
                  >
                    T{deal.source_confidence_tier}
                  </span>
                  <span
                    className={`ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle ${
                      deal.is_confirmed ? 'bg-[hsl(var(--success))]' : 'bg-muted-foreground/40'
                    }`}
                    title={deal.is_confirmed ? 'Confirmed' : 'Unconfirmed'}
                  />
                </td>

                {/* Score */}
                <td className="px-3 py-3 text-right">
                  <span
                    className={`inline-flex items-center justify-center min-w-[2.25rem] px-2 py-1 rounded-lg font-semibold font-mono-numbers ${scorePillClass(deal.composite_score)}`}
                  >
                    {deal.composite_score != null ? deal.composite_score.toFixed(0) : '—'}
                  </span>
                </td>

                {/* Updated */}
                <td className="px-4 py-3 text-right hidden lg:table-cell whitespace-nowrap text-xs text-muted-foreground">
                  <TimeAgo iso={deal.last_updated_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
