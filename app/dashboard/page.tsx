import { Suspense } from 'react';
import { getDeals, getLatestSuccessfulIngest } from '@/lib/db/queries';
import { DealTable } from '@/components/DealTable';
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
    <div className="space-y-6 animate-fade-in">
      {/* Status banners */}
      {!llmAvailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="font-semibold">ANTHROPIC_API_KEY not set</span>
          <span className="opacity-80"> — deal extraction and summaries will be skipped. Add the key to enable AI analysis.</span>
        </div>
      )}
      {!emailAvailable && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          Daily email disabled — set RESEND_API_KEY and EMAIL_TO in environment to enable.
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Transactions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {deals.length} active deal{deals.length !== 1 ? 's' : ''} tracked
            {lastIngest?.completed_at && (
              <span> · Last scan {new Date(lastIngest.completed_at).toLocaleString()}</span>
            )}
          </p>
        </div>
        <IngestPanel />
      </div>

      {/* Filters */}
      <DashboardControls currentFilters={searchParams} />

      {/* Deal table */}
      <Suspense fallback={<TableSkeleton />}>
        {deals.length === 0 ? (
          <EmptyState hasFilters={Object.keys(searchParams).some((k) => searchParams[k])} />
        ) : (
          <DealTable deals={deals} />
        )}
      </Suspense>
    </div>
  );
}

function TableSkeleton() {
  return <div className="card h-96 animate-pulse" />;
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="card text-center py-24">
      <p className="text-lg font-medium text-foreground">
        {hasFilters ? 'No deals match current filters' : 'No deals tracked yet'}
      </p>
      <p className="text-sm mt-2 text-muted-foreground">
        {hasFilters
          ? 'Try clearing filters'
          : 'Run a scan or upload a document to start tracking transactions'}
      </p>
    </div>
  );
}
