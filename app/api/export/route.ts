import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDeals } from '@/lib/db/queries';
import { buildExport } from '@/lib/export/build';
import { DEFAULT_COLUMNS } from '@/lib/export/fields';
import type { DashboardFilters, ExportConfig, ExportFormat } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const FORMATS: ExportFormat[] = ['xlsx', 'docx', 'pdf'];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rawConfig = (body.config ?? {}) as Partial<ExportConfig>;
  const filters = (body.filters ?? {}) as DashboardFilters;

  const format = FORMATS.includes(rawConfig.format as ExportFormat)
    ? (rawConfig.format as ExportFormat)
    : 'xlsx';
  const columns =
    Array.isArray(rawConfig.columns) && rawConfig.columns.length > 0
      ? rawConfig.columns
      : DEFAULT_COLUMNS;

  const config: ExportConfig = {
    format,
    columns,
    includeSummary: !!rawConfig.includeSummary,
    includeDiplomatic: !!rawConfig.includeDiplomatic,
    includeScoreBreakdown: !!rawConfig.includeScoreBreakdown,
    title: typeof rawConfig.title === 'string' ? rawConfig.title : undefined,
  };

  try {
    const deals = await getDeals(filters);
    const { buffer, contentType, extension } = await buildExport(deals, config);

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `economic-statecraft-${stamp}.${extension}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
