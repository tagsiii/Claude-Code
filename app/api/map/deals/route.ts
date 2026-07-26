// Deal points for the map, honoring the SAME filters as the deals table.
// Two-step: getDeals(filters) resolves which deals match (reusing the
// existing filter/whitelist logic), then deals_geo supplies coordinates for
// those ids. Deal counts are small (hundreds), so this stays fast — the heavy
// reference layers never come through this route (they're static Storage files).

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDeals } from '@/lib/db/queries';
import { db } from '@/lib/db/client';
import { dealsToFeatureCollection, type DealGeoRow } from '@/lib/geo/mapStyle';
import type { DashboardFilters } from '@/lib/types';

export const dynamic = 'force-dynamic';

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
    search: sp.get('search') ?? undefined,
  };
  const minScoreRaw = sp.get('min_score');
  if (minScoreRaw && Number.isFinite(Number(minScoreRaw))) {
    filters.min_score = Number(minScoreRaw);
  }

  const deals = await getDeals(filters);
  const total = deals.length;
  if (total === 0) {
    return NextResponse.json({ geojson: dealsToFeatureCollection([]), total: 0, located: 0 });
  }

  const ids = deals.map((d) => d.id);
  const rows: DealGeoRow[] = [];
  // .in() lists are URL-encoded — chunk to keep requests comfortably sized.
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from('deals_geo')
      .select('*')
      .in('id', ids.slice(i, i + 200));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...((data ?? []) as DealGeoRow[]));
  }

  return NextResponse.json({
    geojson: dealsToFeatureCollection(rows),
    total,
    located: rows.length,
  });
}
