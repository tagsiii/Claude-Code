import { NextRequest, NextResponse } from 'next/server';
import { getSquadron, updateSquadron } from '@/lib/store';

export async function GET() {
  return NextResponse.json(getSquadron());
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const updated = updateSquadron(body);
  return NextResponse.json(updated);
}
