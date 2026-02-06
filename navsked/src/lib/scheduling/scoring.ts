import { Aircrew } from '@/types/aircrew';
import { QualificationRecord } from '@/types/qualifications';
import { TrainingEventRecord, TrainingPriority, TREventDefinition } from '@/types/training';
import { differenceInDays } from 'date-fns';

/**
 * Calculate training priority score for an aircrew member.
 * Higher score = higher priority for being scheduled.
 */
export function calculateTrainingPriority(
  aircrew: Aircrew,
  quals: QualificationRecord,
  trainingRecords: TrainingEventRecord[],
  trainingDefs: TREventDefinition[],
  squadronAvgFlightHours30d: number
): TrainingPriority {
  const now = new Date();

  // 1. Currency urgency (40% weight)
  const expiringEvents: TrainingPriority['expiringEvents'] = [];
  let currencyScore = 0;

  for (const currency of quals.currencies) {
    if (currency.expiryDate) {
      const daysLeft = differenceInDays(new Date(currency.expiryDate), now);
      let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

      if (daysLeft < 0 || !currency.isCurrent) {
        priority = 'CRITICAL';
        currencyScore += 100;
      } else if (daysLeft < 15) {
        priority = 'CRITICAL';
        currencyScore += 90;
      } else if (daysLeft < 30) {
        priority = 'HIGH';
        currencyScore += 70;
      } else if (daysLeft < 60) {
        priority = 'MEDIUM';
        currencyScore += 40;
      } else {
        priority = 'LOW';
        currencyScore += 10;
      }

      expiringEvents.push({
        eventCode: currency.name,
        expiryDate: currency.expiryDate,
        daysUntilExpiry: Math.max(0, daysLeft),
        priority,
      });
    }
  }
  // Normalize currency score to 0-100
  currencyScore = Math.min(100, currencyScore / Math.max(1, quals.currencies.length));

  // 2. T&R progression (25% weight)
  const upgradeEvents: TrainingPriority['upgradeEvents'] = [];
  let progressionScore = 0;
  const nextLevel = getNextACTCLevel(quals.actcLevel);

  if (nextLevel) {
    const targetDefs = trainingDefs.filter((d) => d.targetACTCLevel === nextLevel);
    let totalNeeded = 0;
    let totalComplete = 0;

    for (const def of targetDefs) {
      const completions = trainingRecords.filter(
        (r) =>
          r.eventCode === def.eventCode &&
          r.grade !== 'U' &&
          differenceInDays(now, new Date(r.dateCompleted)) <= def.periodDays
      ).length;

      const needed = Math.max(0, def.minimumPerPeriod - completions);
      if (needed > 0) {
        upgradeEvents.push({ eventCode: def.eventCode, completionsNeeded: needed });
        totalNeeded += needed;
      }
      totalComplete += Math.min(completions, def.minimumPerPeriod);
    }

    // Higher score when closer to completing upgrade
    if (targetDefs.length > 0) {
      progressionScore = (totalComplete / (totalComplete + totalNeeded)) * 100;
    }
  }

  // 3. Fairness - flight hours compared to average (20% weight)
  let fairnessScore = 0;
  if (squadronAvgFlightHours30d > 0) {
    const ratio = aircrew.flightHours.last30Days / squadronAvgFlightHours30d;
    // Below average = higher priority
    if (ratio < 0.5) fairnessScore = 100;
    else if (ratio < 0.8) fairnessScore = 70;
    else if (ratio < 1.0) fairnessScore = 40;
    else fairnessScore = 10;
  }

  // 4. Time since last flight (15% weight)
  const daysSinceLastFlight = estimateDaysSinceLastFlight(aircrew);
  let recencyScore = 0;
  if (daysSinceLastFlight > 14) recencyScore = 100;
  else if (daysSinceLastFlight > 7) recencyScore = 70;
  else if (daysSinceLastFlight > 3) recencyScore = 40;
  else recencyScore = 10;

  // Weighted overall score
  const overallScore = Math.round(
    currencyScore * 0.4 +
    progressionScore * 0.25 +
    fairnessScore * 0.2 +
    recencyScore * 0.15
  );

  return {
    aircrewId: aircrew.id,
    expiringEvents,
    upgradeEvents,
    overallScore: Math.min(100, overallScore),
  };
}

function estimateDaysSinceLastFlight(aircrew: Aircrew): number {
  // Rough estimate from flight hours
  if (aircrew.flightHours.last30Days > 10) return 2;
  if (aircrew.flightHours.last30Days > 5) return 5;
  if (aircrew.flightHours.last30Days > 0) return 10;
  return 20;
}

function getNextACTCLevel(current: number): number | null {
  const levels = [100, 200, 300, 400, 500];
  const idx = levels.indexOf(current);
  if (idx === -1 || idx === levels.length - 1) return null;
  return levels[idx + 1];
}
