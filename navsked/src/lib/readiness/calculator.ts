import { Aircrew } from '@/types/aircrew';
import { QualificationRecord, ACTCLevel } from '@/types/qualifications';
import { SquadronReadiness, CrewMemberReadiness, METReadiness } from '@/types/readiness';
import { TREventDefinition, TrainingEventRecord } from '@/types/training';
import { Squadron } from '@/types/squadron';
import { differenceInDays } from 'date-fns';

/**
 * Calculate individual crew member readiness status.
 */
export function calculateCrewReadiness(
  aircrew: Aircrew,
  quals: QualificationRecord,
  trainingRecords: TrainingEventRecord[],
  trainingDefs: TREventDefinition[]
): CrewMemberReadiness {
  const now = new Date();

  // Check currency status
  let allCurrent = true;
  let someExpiring = false;
  let someExpired = false;
  let minDaysToExpiry = 999;

  for (const currency of quals.currencies) {
    if (!currency.isCurrent) {
      someExpired = true;
      allCurrent = false;
    } else if (currency.expiryDate) {
      const daysLeft = differenceInDays(new Date(currency.expiryDate), now);
      minDaysToExpiry = Math.min(minDaysToExpiry, daysLeft);
      if (daysLeft < 30) {
        someExpiring = true;
      }
    }
  }

  const currencyStatus = someExpired
    ? 'SOME_EXPIRED' as const
    : someExpiring
      ? 'SOME_EXPIRING' as const
      : 'ALL_CURRENT' as const;

  // Calculate events needed for next ACTC level
  const currentLevel = quals.actcLevel;
  const nextLevel = getNextACTCLevel(currentLevel);
  let eventsToNextLevel = 0;

  if (nextLevel) {
    const requiredEvents = trainingDefs.filter(
      (d) => d.targetACTCLevel === nextLevel
    );
    for (const evt of requiredEvents) {
      const completions = trainingRecords.filter(
        (r) => r.eventCode === evt.eventCode && r.grade !== 'U'
      );
      if (completions.length < evt.minimumPerPeriod) {
        eventsToNextLevel++;
      }
    }
  }

  // Mission capable = ACTC 300+ and all currencies current
  const missionCapable =
    currentLevel >= 300 && !someExpired && aircrew.flightStatus === 'FLY';

  // Overall status
  let status: 'GREEN' | 'AMBER' | 'RED';
  if (missionCapable && !someExpiring) {
    status = 'GREEN';
  } else if (someExpired || aircrew.flightStatus !== 'FLY') {
    status = 'RED';
  } else {
    status = 'AMBER';
  }

  return {
    aircrewId: aircrew.id,
    actcLevel: currentLevel as ACTCLevel,
    missionCapable,
    currencyStatus,
    daysToNextExpiry: minDaysToExpiry === 999 ? 365 : minDaysToExpiry,
    eventsToNextLevel,
    status,
  };
}

/**
 * Calculate squadron-level readiness.
 */
export function calculateSquadronReadiness(
  squadron: Squadron,
  allAircrew: Aircrew[],
  allQuals: Map<string, QualificationRecord>,
  allTrainingRecords: Map<string, TrainingEventRecord[]>,
  trainingDefs: TREventDefinition[],
  executedFlightHours: number
): SquadronReadiness {
  const crewReadiness: CrewMemberReadiness[] = [];

  for (const member of allAircrew) {
    const quals = allQuals.get(member.id);
    if (!quals) continue;
    const records = allTrainingRecords.get(member.id) || [];
    crewReadiness.push(
      calculateCrewReadiness(member, quals, records, trainingDefs)
    );
  }

  // ACTC distribution
  const actcCounts = new Map<number, number>();
  for (const cr of crewReadiness) {
    actcCounts.set(cr.actcLevel, (actcCounts.get(cr.actcLevel) || 0) + 1);
  }
  const total = crewReadiness.length;
  const actcDistribution = ([500, 400, 300, 200, 100] as ACTCLevel[]).map(
    (level) => ({
      level,
      count: actcCounts.get(level) || 0,
      percentage: total > 0 ? ((actcCounts.get(level) || 0) / total) * 100 : 0,
    })
  );

  // Combat ready = ACTC 300+ and mission capable
  const combatReady = crewReadiness.filter((c) => c.missionCapable).length;
  const combatReadyPercentage = total > 0 ? (combatReady / total) * 100 : 0;

  // Experience factor (Ef) - ratio of experienced crew to total
  const experienced = crewReadiness.filter((c) => c.actcLevel >= 300).length;
  const experienceFactor = total > 0 ? experienced / total : 0;

  // Performance factor (Pf) - ratio of green status crew to total
  const greenCount = crewReadiness.filter((c) => c.status === 'GREEN').length;
  const performanceFactor = total > 0 ? greenCount / total : 0;

  // T-Rating = Ef * Pf
  const tRating = experienceFactor * performanceFactor;

  // MET readiness (simplified)
  const metReadiness = calculateMETReadiness(
    allAircrew,
    allTrainingRecords,
    trainingDefs
  );

  // Flight hour status
  const flightHourStatus = {
    allocated: squadron.monthlyFlightHourAllocation,
    executed: executedFlightHours,
    remaining: squadron.monthlyFlightHourAllocation - executedFlightHours,
    projectedShortfall: 0,
  };

  // Overall status
  let overallStatus: 'GREEN' | 'AMBER' | 'RED';
  if (tRating >= 0.6 && combatReadyPercentage >= 60) {
    overallStatus = 'GREEN';
  } else if (tRating >= 0.3 || combatReadyPercentage >= 40) {
    overallStatus = 'AMBER';
  } else {
    overallStatus = 'RED';
  }

  return {
    squadronId: squadron.id,
    asOfDate: new Date().toISOString().split('T')[0],
    tRating: Math.round(tRating * 100) / 100,
    experienceFactor: Math.round(experienceFactor * 100) / 100,
    performanceFactor: Math.round(performanceFactor * 100) / 100,
    actcDistribution,
    combatReadyPercentage: Math.round(combatReadyPercentage),
    metReadiness,
    flightHourStatus,
    overallStatus,
  };
}

function calculateMETReadiness(
  allAircrew: Aircrew[],
  allTrainingRecords: Map<string, TrainingEventRecord[]>,
  trainingDefs: TREventDefinition[]
): METReadiness[] {
  // Group events by MET code
  const metMap = new Map<string, TREventDefinition[]>();
  for (const def of trainingDefs) {
    for (const met of def.metMapping) {
      if (!metMap.has(met)) metMap.set(met, []);
      metMap.get(met)!.push(def);
    }
  }

  const metNames: Record<string, string> = {
    'MET-1.1': 'Safe-for-Flight',
    'MET-1.2': 'Emergency Procedures',
    'MET-1.3': 'Instrument Flight',
    'MET-1.4': 'Night Operations',
    'MET-2.1': 'Surface Search',
    'MET-2.2': 'ASW Operations',
    'MET-2.3': 'ISR Operations',
    'MET-2.4': 'Communications',
    'MET-3.1': 'Advanced ASW',
    'MET-3.2': 'Anti-Surface Warfare',
    'MET-3.3': 'Mine Warfare',
    'MET-3.4': 'Low-Level Operations',
    'MET-4.1': 'Integrated ASW',
    'MET-4.2': 'Multi-Mission',
  };

  const results: METReadiness[] = [];

  for (const [metCode, events] of metMap.entries()) {
    const subEvents = events.map((evt) => {
      // Count how many aircrew have completed this event within its period
      let completed = 0;
      const required = allAircrew.filter((a) => a.flightStatus === 'FLY').length;

      for (const member of allAircrew) {
        const records = allTrainingRecords.get(member.id) || [];
        const matching = records.filter(
          (r) =>
            r.eventCode === evt.eventCode &&
            r.grade !== 'U' &&
            differenceInDays(new Date(), new Date(r.dateCompleted)) <= evt.periodDays
        );
        if (matching.length >= evt.minimumPerPeriod) {
          completed++;
        }
      }

      return {
        eventCode: evt.eventCode,
        required: Math.min(required, 20), // Cap for display
        completed: Math.min(completed, 20),
        percentComplete: required > 0 ? Math.round((completed / required) * 100) : 0,
      };
    });

    const avgCompletion =
      subEvents.length > 0
        ? subEvents.reduce((s, e) => s + e.percentComplete, 0) / subEvents.length
        : 0;

    results.push({
      metCode,
      metName: metNames[metCode] || metCode,
      readinessScore: Math.round(avgCompletion),
      subEvents,
    });
  }

  return results.sort((a, b) => a.metCode.localeCompare(b.metCode));
}

function getNextACTCLevel(current: number): ACTCLevel | null {
  const levels: ACTCLevel[] = [100, 200, 300, 400, 500];
  const idx = levels.indexOf(current as ACTCLevel);
  if (idx === -1 || idx === levels.length - 1) return null;
  return levels[idx + 1];
}
