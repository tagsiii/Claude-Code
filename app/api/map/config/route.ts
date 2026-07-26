// Tells the map client where the static reference layers live (the public
// `map-layers` Supabase Storage bucket). Served from an API route so the
// Supabase URL doesn't need a NEXT_PUBLIC_ env duplicate.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = process.env.SUPABASE_URL;
  if (!url) return NextResponse.json({ error: 'SUPABASE_URL not configured' }, { status: 500 });

  return NextResponse.json({
    layersBase: `${url.replace(/\/$/, '')}/storage/v1/object/public/map-layers`,
  });
}
