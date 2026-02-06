import { NextRequest, NextResponse } from 'next/server';
import { getAllFlights, createFlight } from '@/lib/store';
import { v4 as uuid } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || undefined;
  const status = searchParams.get('status') || undefined;

  const flights = getAllFlights({ date, status });
  return NextResponse.json(flights);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const flight = createFlight({ ...body, id: body.id || uuid() });
  return NextResponse.json(flight, { status: 201 });
}
