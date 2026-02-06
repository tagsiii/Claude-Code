import { NextRequest, NextResponse } from 'next/server';
import { getFlight, updateFlight, deleteFlight } from '@/lib/store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const flight = getFlight(id);
  if (!flight) {
    return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
  }
  return NextResponse.json(flight);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const updated = updateFlight(id, body);
  if (!updated) {
    return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteFlight(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
