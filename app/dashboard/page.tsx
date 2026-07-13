import { Suspense } from 'react';
import Link from 'next/link';
import { getDeals, getLatestSuccessfulIngest } from '@/lib/db/queries';
import { TimeAgo } from '@/components/TimeAgo';
import { DealTable } from '@/components/DealTable';
import { DashboardControls } from '@/components/DashboardControls';
import { IngestPanel } from '@/components/IngestPanel';
import { ExportDialog } from '@/components/ExportDialog';
import { isLlmAvailable } from '@/lib/llm/client';
import { isEmailAvailable } from '@/lib/email/client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Next.js delivers repeated URL params as arrays — flatten to first value so
  // filters/sorting always receive plain strings.
  const sp: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) sp[key] = first;
  }

  const [deals, lastIngest] = await Promise.all([
    getDeals({
      sector: (sp.sector as never) || 'all',
      sponsoring_state: sp.sponsoring_state || 'all',
      lifecycle_stage: (sp.lifecycle_stage as never) || 'all',
      host_region: sp.host_region || 'all',
      source_tier: sp.source_tier || 'all',
      search: sp.search,
      sort_by: (sp.sort_by as never) || 'composite_score',
      sort_dir: (sp.sort_dir as 'asc' | 'desc') || 'desc',
      min_score: sp.min_score ? Number(sp.min_score) : undefined,
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
            {lastIngest?.completed_at ? (
              <>
                {' '}· Last scan <TimeAgo iso={lastIngest.completed_at} /> ·{' '}
                <Link href="/dashboard/activity" className="text-primary hover:underline">
                  View results
                </Link>
              </>
            ) : (
              <span> · No scans yet</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDialog filters={sp} dealCount={deals.length} />
          <IngestPanel />
        </div>
      </div>

      {/* Filters */}
      <DashboardControls currentFilters={sp} />

      {/* Deal table */}
      <Suspense fallback={<TableSkeleton />}>
        {deals.length === 0 ? (
          <EmptyState hasFilters={Object.keys(sp).length > 0} />
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
