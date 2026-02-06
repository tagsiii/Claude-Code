import { NextRequest, NextResponse } from 'next/server';
import { getStore, saveSchedule } from '@/lib/store';
import { generateSchedule } from '@/lib/scheduling/engine';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { startDate, endDate, squadronId, options } = body;

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate are required' },
      { status: 400 }
    );
  }

  const store = getStore();

  const schedule = generateSchedule(
    {
      startDate,
      endDate,
      squadronId: squadronId || store.squadron.id,
      maxFlightsPerDay: options?.maxFlightsPerDay,
      flightHourBudget: options?.flightHourBudget,
      prioritizeTraining: options?.prioritizeTraining,
      lockedFlightIds: options?.lockedFlightIds,
    },
    {
      squadron: store.squadron,
      aircrew: store.aircrew,
      qualifications: store.qualifications,
      constraints: store.constraints,
      trainingDefs: store.trainingDefinitions,
      trainingRecords: store.trainingRecords,
    }
  );

  saveSchedule(schedule);

  return NextResponse.json(schedule, { status: 201 });
}
