// Live stats for the data-source catalog: row count + most recent load
// timestamp per dataset. Head-only count queries — cheap even on 400k rows.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { DATASETS } from '@/lib/data/datasets';
import { SOURCE_CATALOG } from '@/lib/data/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stats: Record<string, { rows: number | null; lastLoaded: string | null }> = {};
  await Promise.all(
    Object.values(DATASETS).map(async (d) => {
      try {
        const { count } = await db.from(d.table).select('*', { count: 'exact', head: true });
        let lastLoaded: string | null = null;
        const loadedCol = SOURCE_CATALOG[d.key]?.loadedAtColumn;
        if (loadedCol) {
          const { data } = await db
            .from(d.table)
            .select(loadedCol)
            .order(loadedCol, { ascending: false })
            .limit(1)
            .maybeSingle();
          lastLoaded = ((data as Record<string, unknown> | null)?.[loadedCol] as string) ?? null;
        }
        stats[d.key] = { rows: count ?? 0, lastLoaded };
      } catch {
        stats[d.key] = { rows: null, lastLoaded: null };
      }
    })
  );

  return NextResponse.json({ stats });
}
