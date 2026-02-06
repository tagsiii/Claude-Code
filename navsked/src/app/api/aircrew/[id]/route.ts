import { NextRequest, NextResponse } from 'next/server';
import { getAircrew, updateAircrew, deleteAircrew } from '@/lib/store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const aircrew = getAircrew(id);
  if (!aircrew) {
    return NextResponse.json({ error: 'Aircrew not found' }, { status: 404 });
  }
  return NextResponse.json(aircrew);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const updated = updateAircrew(id, body);
  if (!updated) {
    return NextResponse.json({ error: 'Aircrew not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteAircrew(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Aircrew not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
