import { Suspense } from 'react';
import Link from 'next/link';
import { DashboardControls } from '@/components/DashboardControls';
import { MapClient } from '@/components/map/MapClient';

export const dynamic = 'force-dynamic';

// The map shares the deals table's filter state through URL params — the same
// DashboardControls component drives both, and "Open in table" carries the
// current filters back to /dashboard.
export default function MapPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const sp: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) sp[key] = first;
  }
  const qs = new URLSearchParams(sp).toString();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Map</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tracked deals against Chinese state-backed finance, US positioning, and strategic
            infrastructure
          </p>
        </div>
        <Link
          href={`/dashboard${qs ? `?${qs}` : ''}`}
          className="text-sm text-primary hover:underline font-medium"
        >
          Open in table →
        </Link>
      </div>

      <DashboardControls currentFilters={sp} />

      <Suspense fallback={<div className="card h-[68vh] min-h-[440px] animate-pulse" />}>
        <MapClient />
      </Suspense>
    </div>
  );
}
