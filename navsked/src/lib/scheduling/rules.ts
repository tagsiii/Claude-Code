import { Aircrew } from '@/types/aircrew';
import { ScheduledFlight, ConstraintViolation } from '@/types/schedule';
import { PersonalConstraint } from '@/types/constraints';
import { QualificationRecord } from '@/types/qualifications';
import { differenceInHours, parseISO } from 'date-fns';

/**
 * Check all hard constraints for a flight. Returns violations.
 */
export function checkHardConstraints(
  flight: ScheduledFlight,
  allAircrew: Map<string, Aircrew>,
  allQuals: Map<string, QualificationRecord>,
  allConstraints: Map<string, PersonalConstraint[]>,
  allFlights: ScheduledFlight[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const assignment of flight.crewAssignments) {
    const member = allAircrew.get(assignment.aircrewId);
    if (!member) {
      violations.push({
        ruleId: 'rule-5',
        ruleName: 'Unknown Aircrew',
        severity: 'HARD',
        flightId: flight.id,
        aircrewId: assignment.aircrewId,
        message: `Aircrew ${assignment.aircrewId} not found in roster`,
      });
      continue;
    }

    // NATOPS currency check
    if (member.natopsStatus === 'EXPIRED') {
      violations.push({
        ruleId: 'rule-1',
        ruleName: 'NATOPS Currency',
        severity: 'HARD',
        flightId: flight.id,
        aircrewId: member.id,
        message: `${member.lastName}, ${member.firstName} has expired NATOPS qualification`,
        suggestion: 'Schedule a NATOPS check ride or assign a different crew member',
      });
    }

    // Position qualification check
    if (!member.qualifiedPositions.includes(assignment.position)) {
      violations.push({
        ruleId: 'rule-5',
        ruleName: 'Position Qualification',
        severity: 'HARD',
        flightId: flight.id,
        aircrewId: member.id,
        message: `${member.lastName} is not qualified for ${assignment.position}`,
        suggestion: `Assign a ${assignment.position}-qualified crew member`,
      });
    }

    // Availability check (leave, DNIF, TAD)
    if (member.flightStatus !== 'FLY') {
      violations.push({
        ruleId: 'rule-4',
        ruleName: 'Personal Availability',
        severity: 'HARD',
        flightId: flight.id,
        aircrewId: member.id,
        message: `${member.lastName} is ${member.flightStatus} and not available to fly`,
        suggestion: `Assign an available crew member`,
      });
    }

    // Check personal constraints
    const constraints = allConstraints.get(member.id) || [];
    for (const c of constraints) {
      if (c.approved) {
        const flightDate = flight.scheduledTakeoff.split('T')[0];
        if (flightDate >= c.startDate && flightDate <= c.endDate) {
          violations.push({
            ruleId: 'rule-4',
            ruleName: 'Personal Availability',
            severity: 'HARD',
            flightId: flight.id,
            aircrewId: member.id,
            message: `${member.lastName} has a ${c.type} constraint on ${flightDate}`,
            suggestion: `Reschedule or assign different crew`,
          });
        }
      }
    }

    // Crew rest check - 12 hours between flights
    const briefTime = parseISO(flight.scheduledBrief);
    for (const otherFlight of allFlights) {
      if (otherFlight.id === flight.id) continue;
      const isOnOtherFlight = otherFlight.crewAssignments.some(
        (a) => a.aircrewId === member.id
      );
      if (!isOnOtherFlight) continue;

      const otherDebrief = parseISO(otherFlight.scheduledDebrief);
      const hoursBetween = differenceInHours(briefTime, otherDebrief);

      if (hoursBetween > 0 && hoursBetween < 12) {
        violations.push({
          ruleId: 'rule-2',
          ruleName: 'Crew Rest',
          severity: 'HARD',
          flightId: flight.id,
          aircrewId: member.id,
          message: `${member.lastName} has only ${hoursBetween}hrs between flights (min 12)`,
          suggestion: `Move flight time or assign different crew`,
        });
      }
    }
  }

  // Instructor check for training flights
  if (flight.flightType === 'TRAINING' && flight.plannedEvents.length > 0) {
    const hasInstructor = flight.crewAssignments.some(
      (a) => {
        const member = allAircrew.get(a.aircrewId);
        return member?.isInstructor && (a.role === 'INSTRUCTOR' || a.role === 'PRIMARY');
      }
    );
    if (!hasInstructor) {
      violations.push({
        ruleId: 'rule-7',
        ruleName: 'Instructor for Training',
        severity: 'HARD',
        flightId: flight.id,
        message: 'Training flight requires a qualified instructor aboard',
        suggestion: 'Add an instructor-qualified crew member',
      });
    }
  }

  return violations;
}

/**
 * Check if a crew member is eligible for a specific flight slot.
 */
export function isEligible(
  aircrew: Aircrew,
  quals: QualificationRecord | undefined,
  position: string,
  flightDate: string,
  constraints: PersonalConstraint[],
  existingFlights: ScheduledFlight[],
  briefTime: string
): boolean {
  // Must be on flight status
  if (aircrew.flightStatus !== 'FLY') return false;

  // Must have current NATOPS
  if (aircrew.natopsStatus === 'EXPIRED') return false;

  // Must be qualified for position
  if (!aircrew.qualifiedPositions.includes(position as Aircrew['qualifiedPositions'][number])) {
    return false;
  }

  // Check constraints
  for (const c of constraints) {
    if (c.approved && flightDate >= c.startDate && flightDate <= c.endDate) {
      return false;
    }
  }

  // Check crew rest
  const briefTimeParsed = parseISO(briefTime);
  for (const f of existingFlights) {
    const isOnFlight = f.crewAssignments.some((a) => a.aircrewId === aircrew.id);
    if (!isOnFlight) continue;
    const debriefTime = parseISO(f.scheduledDebrief);
    const hours = differenceInHours(briefTimeParsed, debriefTime);
    if (hours > 0 && hours < 12) return false;
  }

  return true;
}
