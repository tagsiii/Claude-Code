import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDealById, setDealReviewStatus } from '@/lib/db/queries';

// Review verdicts. Rejected deals stay in the database (hidden everywhere) so
// dedup keeps matching re-reported junk against them — a built-in blocklist.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const status = body.review_status;
  if (status !== 'approved' && status !== 'rejected') {
    return NextResponse.json({ error: 'review_status must be approved or rejected' }, { status: 400 });
  }

  try {
    await setDealReviewStatus(params.id, status, typeof body.note === 'string' ? body.note.slice(0, 300) : undefined);
    return NextResponse.json({ ok: true, review_status: status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const deal = await getDealById(params.id);
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ deal });
}
