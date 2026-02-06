import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { calculateSquadronReadiness } from '@/lib/readiness/calculator';

export async function GET() {
  const store = getStore();

  const allAircrew = Array.from(store.aircrew.values());
  const executedHours = allAircrew.reduce(
    (sum, a) => sum + a.flightHours.last30Days,
    0
  ) / allAircrew.length * 10; // rough estimate

  const readiness = calculateSquadronReadiness(
    store.squadron,
    allAircrew,
    store.qualifications,
    store.trainingRecords,
    store.trainingDefinitions,
    executedHours
  );

  return NextResponse.json(readiness);
}
