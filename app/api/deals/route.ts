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
    search: sp.get('search') ?? undefined,
    sort_by: (sp.get('sort_by') as DashboardFilters['sort_by']) ?? 'composite_score',
    sort_dir: (sp.get('sort_dir') as 'asc' | 'desc') ?? 'desc',
  };

  const minScore = sp.get('min_score');
  if (minScore) filters.min_score = Number(minScore);

  const deals = await getDeals(filters);
  return NextResponse.json({ deals });
}
