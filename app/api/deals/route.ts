import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDeals } from '@/lib/db/queries';
import type { DashboardFilters } from '@/lib/types';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams: sp } = req.nextUrl;

  const filters: DashboardFilters = {
    sector: (sp.get('sector') as DashboardFilters['sector']) ?? 'all',
    sponsoring_state: sp.get('sponsoring_state') ?? 'all',
    lifecycle_stage: (sp.get('lifecycle_stage') as DashboardFilters['lifecycle_stage']) ?? 'all',
    host_region: sp.get('host_region') ?? 'all',
    host_country: sp.get('host_country') ?? 'all',
    source_tier: sp.get('source_tier') ?? 'all',
    triage: (sp.get('triage') as DashboardFilters['triage']) ?? undefined,
    search: sp.get('search') ?? undefined,
    updated_after: sp.get('updated_after') ?? undefined,
    updated_before: sp.get('updated_before') ?? undefined,
    seen_after: sp.get('seen_after') ?? undefined,
    seen_before: sp.get('seen_before') ?? undefined,
    sort_by: (sp.get('sort_by') as DashboardFilters['sort_by']) ?? 'composite_score',
    // No default here — resolveSort applies the per-column default (tier sorts
    // ascending, everything else descending).
    sort_dir: (sp.get('sort_dir') as 'asc' | 'desc') ?? undefined,
  };

  const minScoreRaw = sp.get('min_score');
  if (minScoreRaw && Number.isFinite(Number(minScoreRaw))) {
    filters.min_score = Number(minScoreRaw);
  }

  const deals = await getDeals(filters);
  return NextResponse.json({ deals });
}
