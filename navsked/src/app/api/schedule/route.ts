import { NextRequest, NextResponse } from 'next/server';
import { getScheduleForDateRange } from '@/lib/store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json(
      { error: 'start and end query parameters required' },
      { status: 400 }
    );
  }

  const schedule = getScheduleForDateRange(start, end);
  if (!schedule) {
    return NextResponse.json({ flights: [], message: 'No schedule for this date range' });
  }

  return NextResponse.json(schedule);
}
