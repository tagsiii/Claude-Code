import { Suspense } from 'react';
import { getDeals, getLatestSuccessfulIngest } from '@/lib/db/queries';
import { DealGrid } from '@/components/DealGrid';
import { DashboardControls } from '@/components/DashboardControls';
import { IngestPanel } from '@/components/IngestPanel';
import { isLlmAvailable } from '@/lib/llm/client';
import { isEmailAvailable } from '@/lib/email/client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const [deals, lastIngest] = await Promise.all([
    getDeals({
      sector: (searchParams.sector as never) || 'all',
      sponsoring_state: searchParams.sponsoring_state || 'all',
      lifecycle_stage: (searchParams.lifecycle_stage as never) || 'all',
      host_region: searchParams.host_region || 'all',
      search: searchParams.search,
      sort_by: (searchParams.sort_by as never) || 'composite_score',
      sort_dir: (searchParams.sort_dir as 'asc' | 'desc') || 'desc',
      min_score: searchParams.min_score ? Number(searchParams.min_score) : undefined,
    }),
    getLatestSuccessfulIngest(),
  ]);

  const llmAvailable = isLlmAvailable();
  const emailAvailable = isEmailAvailable();

  return (
    <div className="space-y-6">
      {/* Status banners */}
      {!llmAvailable && (
        <div className="bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-3 text-yellow-300 text-sm flex items-center gap-2">
          <span className="font-semibold">⚠ ANTHROPIC_API_KEY not set</span>
          <span className="text-yellow-500">— Deal extraction and summaries will be skipped. Add the key in your environment to enable AI analysis.</span>
        </div>
      )}
      {!emailAvailable && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-400 text-xs">
          Daily email disabled — set RESEND_API_KEY and EMAIL_TO in environment to enable.
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Economic Statecraft Transactions
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {deals.length} active deal{deals.length !== 1 ? 's' : ''} tracked
            {lastIngest && (
              <span className="text-slate-600">
                {' '}· Last scan {new Date(lastIngest.completed_at!).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <IngestPanel />
      </div>

      {/* Filters */}
      <DashboardControls currentFilters={searchParams} />

      {/* Deal grid */}
      <Suspense fallback={<DealGridSkeleton />}>
        {deals.length === 0 ? (
          <EmptyState hasFilters={Object.keys(searchParams).some((k) => searchParams[k])} />
        ) : (
          <DealGrid deals={deals} />
        )}
      </Suspense>
    </div>
  );
}

function DealGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl h-72 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-24 text-slate-500">
      <div className="text-4xl mb-4">◎</div>
      <p className="text-lg font-medium text-slate-400">
        {hasFilters ? 'No deals match current filters' : 'No deals ingested yet'}
      </p>
      <p className="text-sm mt-2">
        {hasFilters
          ? 'Try clearing filters'
          : 'Click "Run Scan" to pull live data from GDELT and World Bank'}
      </p>
    </div>
  );
}
