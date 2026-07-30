// One-page briefing memo download for a single deal (Word or PDF).

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDealById } from '@/lib/db/queries';
import { buildMemoDocx, buildMemoPdf } from '@/lib/export/memo';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const deal = await getDealById(params.id);
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const format = req.nextUrl.searchParams.get('format') === 'pdf' ? 'pdf' : 'docx';

  try {
    const buffer = format === 'pdf' ? await buildMemoPdf(deal) : await buildMemoDocx(deal);
    const slug = deal.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'deal';
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="memo-${slug}.${format}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
