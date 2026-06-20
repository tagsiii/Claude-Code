import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDealById } from '@/lib/db/queries';

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
