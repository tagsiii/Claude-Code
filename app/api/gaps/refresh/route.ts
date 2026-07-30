// On-demand refresh of the gap materialized views — the "Refresh now" button
// on the Gaps page. (They also refresh automatically after every scan.)

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db/client';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await db.rpc('refresh_gap_views', {});
  if (error) {
    const setup = /does not exist|schema cache/i.test(error.message);
    return NextResponse.json(
      { error: setup ? 'Run lib/db/geo4.sql in the Supabase SQL editor first.' : error.message },
      { status: setup ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true, refreshed_at: new Date().toISOString() });
}
