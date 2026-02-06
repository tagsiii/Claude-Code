import { v4 as uuid } from 'uuid';
import { Aircrew, CrewPosition } from '@/types/aircrew';
import { QualificationRecord } from '@/types/qualifications';
import { TREventDefinition, TrainingEventRecord } from '@/types/training';
import {
  FlightSchedule,
  ScheduledFlight,
  CrewAssignment,
  ValidationResult,
  ConstraintViolation,
} from '@/types/schedule';
import { PersonalConstraint } from '@/types/constraints';
import { Squadron } from '@/types/squadron';
import { checkHardConstraints, isEligible } from './rules';
import { calculateTrainingPriority } from './scoring';
import { addDays, addHours, format } from 'date-fns';

interface ScheduleGenerationOptions {
  startDate: string;
  endDate: string;
  squadronId: string;
  maxFlightsPerDay?: number;
  flightHourBudget?: number;
  prioritizeTraining?: boolean;
  lockedFlightIds?: string[];
}

interface GenerationContext {
  squadron: Squadron;
  aircrew: Map<string, Aircrew>;
  qualifications: Map<string, QualificationRecord>;
  constraints: Map<string, PersonalConstraint[]>;
  trainingDefs: TREventDefinition[];
  trainingRecords: Map<string, TrainingEventRecord[]>;
}

/**
 * Generate a flight schedule for the given date range.
 */
export function generateSchedule(
  options: ScheduleGenerationOptions,
  ctx: GenerationContext
): FlightSchedule {
  const {
    startDate,
    endDate,
    squadronId,
    maxFlightsPerDay = 3,
    flightHourBudget,
  } = options;

  const budget = flightHourBudget || ctx.squadron.monthlyFlightHourAllocation / 4;
  const flights: ScheduledFlight[] = [];
  let totalHours = 0;

  // Calculate priority scores for all available aircrew
  const availableAircrew = Array.from(ctx.aircrew.values()).filter(
    (a) => a.flightStatus === 'FLY' && a.squadronId === squadronId
  );

  const avgHours30d =
    availableAircrew.reduce((s, a) => s + a.flightHours.last30Days, 0) /
    Math.max(1, availableAircrew.length);

  const priorities = new Map<string, number>();
  for (const member of availableAircrew) {
    const quals = ctx.qualifications.get(member.id);
    if (!quals) continue;
    const records = ctx.trainingRecords.get(member.id) || [];
    const priority = calculateTrainingPriority(
      member,
      quals,
      records,
      ctx.trainingDefs,
      avgHours30d
    );
    priorities.set(member.id, priority.overallScore);
  }

  // Generate flights for each day
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = start;
  const flightNames = ['LANCER', 'RED', 'HUNTER', 'TRIDENT', 'SHADOW'];
  let flightCounter = 1;

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Skip weekends (reduced ops)
    const flightsThisDay = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : maxFlightsPerDay;

    for (let fi = 0; fi < flightsThisDay && totalHours < budget; fi++) {
      const briefHour = fi === 0 ? 6 : fi === 1 ? 11 : 17;
      const briefTime = new Date(current);
      briefTime.setHours(briefHour, 0, 0, 0);

      const takeoffTime = addHours(briefTime, 1);
      const duration = fi === 2 ? 3 : 5; // Night flights shorter
      const landTime = addHours(takeoffTime, duration);
      const debriefTime = addHours(landTime, 1);

      const dateStr = format(current, 'yyyy-MM-dd');
      const isNight = briefHour >= 17;

      // Assign crew using greedy algorithm
      const crewAssignments = assignCrew(
        dateStr,
        briefTime.toISOString(),
        availableAircrew,
        ctx,
        priorities,
        flights
      );

      if (crewAssignments.length === 0) continue; // Couldn't fill crew

      const flight: ScheduledFlight = {
        id: uuid(),
        flightDesignator: `${flightNames[flightCounter % flightNames.length]} ${flightCounter}`,
        aircraftSideNumber: `LL-${String(700 + (flightCounter % 12)).padStart(3, '0')}`,
        scheduledBrief: briefTime.toISOString(),
        scheduledTakeoff: takeoffTime.toISOString(),
        scheduledLand: landTime.toISOString(),
        scheduledDebrief: debriefTime.toISOString(),
        plannedDuration: duration,
        crewAssignments,
        plannedEvents: [],
        flightArea: ['W-168', 'W-174', 'JAX OPAREA'][fi % 3],
        flightType: 'TRAINING',
        timeOfDay: isNight ? 'NIGHT' : 'DAY',
        status: 'SCHEDULED',
      };

      flights.push(flight);
      totalHours += duration;
      flightCounter++;
    }

    current = addDays(current, 1);
  }

  const schedule: FlightSchedule = {
    id: uuid(),
    squadronId,
    startDate,
    endDate,
    status: 'DRAFT',
    flights,
    createdBy: 'AUTO_SCHEDULER',
    totalFlightHours: totalHours,
    allocatedFlightHours: budget,
  };

  // Run validation
  schedule.validationResult = validateSchedule(schedule, ctx);

  return schedule;
}

/**
 * Greedy crew assignment for a single flight.
 */
function assignCrew(
  flightDate: string,
  briefTime: string,
  availableAircrew: Aircrew[],
  ctx: GenerationContext,
  priorities: Map<string, number>,
  existingFlights: ScheduledFlight[]
): CrewAssignment[] {
  const assignments: CrewAssignment[] = [];
  const assigned = new Set<string>();

  // Required positions for P-8A standard crew
  const requiredPositions: { position: CrewPosition; needsInstructor: boolean }[] =
    ctx.squadron.standardCrewComposition.map((r) => ({
      position: r.position,
      needsInstructor: r.instructorRequired,
    }));

  for (const req of requiredPositions) {
    // Find eligible crew sorted by priority (highest first)
    const candidates = availableAircrew
      .filter((a) => {
        if (assigned.has(a.id)) return false;
        const constraints = ctx.constraints.get(a.id) || [];
        return isEligible(
          a,
          ctx.qualifications.get(a.id),
          req.position,
          flightDate,
          constraints,
          existingFlights,
          briefTime
        );
      })
      .sort((a, b) => (priorities.get(b.id) || 0) - (priorities.get(a.id) || 0));

    if (candidates.length === 0) continue;

    const selected = candidates[0];
    assigned.add(selected.id);

    const isPPC = req.position === 'PPC';
    assignments.push({
      aircrewId: selected.id,
      position: req.position,
      role: selected.isInstructor ? 'INSTRUCTOR' : 'PRIMARY',
      isPIC: isPPC,
    });
  }

  return assignments;
}

/**
 * Validate an entire schedule against all constraints.
 */
export function validateSchedule(
  schedule: FlightSchedule,
  ctx: GenerationContext
): ValidationResult {
  const hardViolations: ConstraintViolation[] = [];
  const softViolations: ConstraintViolation[] = [];

  for (const flight of schedule.flights) {
    const violations = checkHardConstraints(
      flight,
      ctx.aircrew,
      ctx.qualifications,
      ctx.constraints,
      schedule.flights
    );
    for (const v of violations) {
      if (v.severity === 'HARD') hardViolations.push(v);
      else softViolations.push(v);
    }
  }

  // Soft constraint checks
  // Flight hour fairness
  const hoursByPerson = new Map<string, number>();
  for (const flight of schedule.flights) {
    for (const a of flight.crewAssignments) {
      hoursByPerson.set(
        a.aircrewId,
        (hoursByPerson.get(a.aircrewId) || 0) + flight.plannedDuration
      );
    }
  }
  const hoursArray = Array.from(hoursByPerson.values());
  const mean = hoursArray.reduce((s, h) => s + h, 0) / Math.max(1, hoursArray.length);
  const variance =
    hoursArray.reduce((s, h) => s + (h - mean) ** 2, 0) / Math.max(1, hoursArray.length);
  const stdDev = Math.sqrt(variance);

  if (stdDev > mean * 0.5) {
    softViolations.push({
      ruleId: 'rule-8',
      ruleName: 'Flight Hour Fairness',
      severity: 'SOFT',
      flightId: '',
      message: `Flight hour distribution has high variance (std dev: ${stdDev.toFixed(1)}hrs)`,
      suggestion: 'Consider redistributing crew assignments for better fairness',
    });
  }

  // Budget check
  if (schedule.totalFlightHours > schedule.allocatedFlightHours) {
    softViolations.push({
      ruleId: 'rule-10',
      ruleName: 'Flight Hour Budget',
      severity: 'SOFT',
      flightId: '',
      message: `Schedule exceeds budget: ${schedule.totalFlightHours}hrs / ${schedule.allocatedFlightHours}hrs allocated`,
      suggestion: 'Reduce number of flights or shorten sortie durations',
    });
  }

  // Crew utilization
  const uniqueCrew = new Set<string>();
  for (const f of schedule.flights) {
    for (const a of f.crewAssignments) uniqueCrew.add(a.aircrewId);
  }
  const totalAvailable = Array.from(ctx.aircrew.values()).filter(
    (a) => a.flightStatus === 'FLY'
  ).length;
  const utilization = totalAvailable > 0 ? (uniqueCrew.size / totalAvailable) * 100 : 0;

  const fitnessScore = calculateFitness(hardViolations, softViolations, utilization);

  return {
    isValid: hardViolations.length === 0,
    hardViolations,
    softViolations,
    fitnessScore,
    summary: {
      totalFlightHours: schedule.totalFlightHours,
      crewUtilization: Math.round(utilization),
      trainingEventsScheduled: schedule.flights.reduce(
        (s, f) => s + f.plannedEvents.length,
        0
      ),
      currenciesAddressed: 0,
      fairnessDeviation: Math.round(stdDev * 10) / 10,
    },
  };
}

function calculateFitness(
  hardViolations: ConstraintViolation[],
  softViolations: ConstraintViolation[],
  utilization: number
): number {
  if (hardViolations.length > 0) return 0;
  let score = 100;
  score -= softViolations.length * 5;
  score -= Math.max(0, 70 - utilization) * 0.5; // Penalize low utilization
  return Math.max(0, Math.round(score));
}
