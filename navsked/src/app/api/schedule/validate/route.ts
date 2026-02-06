import { NextRequest, NextResponse } from 'next/server';
import { getStore, getSchedule } from '@/lib/store';
import { validateSchedule } from '@/lib/scheduling/engine';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { scheduleId } = body;

  if (!scheduleId) {
    return NextResponse.json(
      { error: 'scheduleId is required' },
      { status: 400 }
    );
  }

  const schedule = getSchedule(scheduleId);
  if (!schedule) {
    return NextResponse.json(
      { error: 'Schedule not found' },
      { status: 404 }
    );
  }

  const store = getStore();
  const result = validateSchedule(schedule, {
    squadron: store.squadron,
    aircrew: store.aircrew,
    qualifications: store.qualifications,
    constraints: store.constraints,
    trainingDefs: store.trainingDefinitions,
    trainingRecords: store.trainingRecords,
  });

  return NextResponse.json(result);
}
