import { NextRequest, NextResponse } from 'next/server';
import { getAllAircrew, createAircrew } from '@/lib/store';
import { v4 as uuid } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as 'FLY' | 'DNIF' | 'TAD' | 'LEAVE' | 'GROUNDED' | undefined;
  const designator = searchParams.get('designator') || undefined;
  const position = searchParams.get('position') || undefined;

  const aircrew = getAllAircrew({
    status: status || undefined,
    designator,
    position,
  });

  return NextResponse.json(aircrew);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const aircrew = createAircrew({ ...body, id: body.id || uuid() });
  return NextResponse.json(aircrew, { status: 201 });
}
