// Backs the Data browser grid: paginated, filtered, sorted reads over the
// whitelisted datasets in lib/data/datasets.ts. Also serves ?format=csv for
// exporting the current filtered view (capped, fetched in pages).

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { DATASETS, parseFilterInput } from '@/lib/data/datasets';
import { toCsv } from '@/lib/gaps';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
const CSV_MAX_ROWS = 10_000;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const dataset = DATASETS[sp.get('dataset') ?? ''];
  if (!dataset) return NextResponse.json({ error: 'Unknown dataset' }, { status: 400 });

  const selectCols = [
    ...(dataset.rowLinkKey ? [dataset.rowLinkKey] : []),
    ...dataset.columns.map((c) => c.key),
  ];
  const colByKey = new Map(dataset.columns.map((c) => [c.key, c]));

  // Sort: whitelisted to registry columns marked sortable.
  const sortParam = sp.get('sort');
  const sortCol =
    sortParam && colByKey.get(sortParam)?.sortable !== false && colByKey.has(sortParam)
      ? sortParam
      : dataset.defaultSort;
  const ascending = (sp.get('dir') ?? dataset.defaultDir) === 'asc';

  const buildQuery = () => {
    let q = db.from(dataset.table).select(selectCols.join(','), { count: 'exact' });
    for (const [param, raw] of sp.entries()) {
      if (!param.startsWith('f_') || !raw) continue;
      const key = param.slice(2);
      const colDef = colByKey.get(key);
      if (!colDef || colDef.filterable === false) continue;
      for (const f of parseFilterInput(raw, colDef.type)) {
        if (f.op === 'ilike') q = q.ilike(key, f.value as string);
        else if (f.op === 'eq') q = q.eq(key, f.value);
        else if (f.op === 'gte') q = q.gte(key, f.value);
        else q = q.lte(key, f.value);
      }
    }
    return q.order(sortCol, { ascending, nullsFirst: false });
  };

  if (sp.get('format') === 'csv') {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; from < CSV_MAX_ROWS; from += 1000) {
      const { data, error } = await buildQuery().range(from, Math.min(from + 999, CSV_MAX_ROWS - 1));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
      if (!data || data.length < 1000) break;
    }
    // Arrays (aliases, owners) → readable text
    for (const row of rows) {
      for (const k of Object.keys(row)) {
        if (Array.isArray(row[k])) row[k] = (row[k] as unknown[]).join('; ');
      }
    }
    const csv = toCsv(rows, dataset.columns.map((c) => ({ key: c.key, label: c.label })));
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="${dataset.key}.csv"`,
      },
    });
  }

  const page = Math.max(1, Number(sp.get('page')) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}
