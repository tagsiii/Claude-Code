import { Aircrew, FlightStatus } from '@/types/aircrew';
import { QualificationRecord } from '@/types/qualifications';
import { TREventDefinition, TrainingEventRecord } from '@/types/training';
import { ScheduledFlight, FlightSchedule } from '@/types/schedule';
import { PersonalConstraint, SchedulingRule } from '@/types/constraints';
import { Squadron } from '@/types/squadron';
import { seedData } from './seed';

export interface DataStore {
  squadron: Squadron;
  aircrew: Map<string, Aircrew>;
  qualifications: Map<string, QualificationRecord>;
  trainingDefinitions: TREventDefinition[];
  trainingRecords: Map<string, TrainingEventRecord[]>;
  constraints: Map<string, PersonalConstraint[]>;
  flights: Map<string, ScheduledFlight>;
  schedules: Map<string, FlightSchedule>;
  schedulingRules: SchedulingRule[];
}

let store: DataStore | null = null;

export function getStore(): DataStore {
  if (!store) {
    store = seedData();
  }
  return store;
}

// --- Aircrew CRUD ---

export function getAllAircrew(filters?: {
  status?: FlightStatus;
  designator?: string;
  position?: string;
}): Aircrew[] {
  const s = getStore();
  let result = Array.from(s.aircrew.values());

  if (filters?.status) {
    result = result.filter((a) => a.flightStatus === filters.status);
  }
  if (filters?.designator) {
    result = result.filter((a) => a.designator === filters.designator);
  }
  if (filters?.position) {
    result = result.filter((a) =>
      a.qualifiedPositions.includes(filters.position as Aircrew['qualifiedPositions'][number])
    );
  }

  return result.sort((a, b) => a.lastName.localeCompare(b.lastName));
}

export function getAircrew(id: string): Aircrew | undefined {
  return getStore().aircrew.get(id);
}

export function createAircrew(aircrew: Aircrew): Aircrew {
  getStore().aircrew.set(aircrew.id, aircrew);
  return aircrew;
}

export function updateAircrew(id: string, updates: Partial<Aircrew>): Aircrew | undefined {
  const s = getStore();
  const existing = s.aircrew.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, id };
  s.aircrew.set(id, updated);
  return updated;
}

export function deleteAircrew(id: string): boolean {
  return getStore().aircrew.delete(id);
}

// --- Flight CRUD ---

export function getAllFlights(filters?: {
  date?: string;
  status?: string;
}): ScheduledFlight[] {
  const s = getStore();
  let result = Array.from(s.flights.values());

  if (filters?.date) {
    result = result.filter((f) => f.scheduledTakeoff.startsWith(filters.date!));
  }
  if (filters?.status) {
    result = result.filter((f) => f.status === filters.status);
  }

  return result.sort((a, b) => a.scheduledTakeoff.localeCompare(b.scheduledTakeoff));
}

export function getFlight(id: string): ScheduledFlight | undefined {
  return getStore().flights.get(id);
}

export function createFlight(flight: ScheduledFlight): ScheduledFlight {
  getStore().flights.set(flight.id, flight);
  return flight;
}

export function updateFlight(id: string, updates: Partial<ScheduledFlight>): ScheduledFlight | undefined {
  const s = getStore();
  const existing = s.flights.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, id };
  s.flights.set(id, updated);
  return updated;
}

export function deleteFlight(id: string): boolean {
  return getStore().flights.delete(id);
}

// --- Schedules ---

export function getSchedule(id: string): FlightSchedule | undefined {
  return getStore().schedules.get(id);
}

export function getScheduleForDateRange(start: string, end: string): FlightSchedule | undefined {
  const s = getStore();
  for (const schedule of s.schedules.values()) {
    if (schedule.startDate <= end && schedule.endDate >= start) {
      return schedule;
    }
  }
  return undefined;
}

export function saveSchedule(schedule: FlightSchedule): FlightSchedule {
  getStore().schedules.set(schedule.id, schedule);
  // Also save individual flights
  for (const flight of schedule.flights) {
    getStore().flights.set(flight.id, flight);
  }
  return schedule;
}

// --- Constraints ---

export function getConstraints(aircrewId: string): PersonalConstraint[] {
  return getStore().constraints.get(aircrewId) || [];
}

export function getAllConstraints(): PersonalConstraint[] {
  const s = getStore();
  const all: PersonalConstraint[] = [];
  for (const constraints of s.constraints.values()) {
    all.push(...constraints);
  }
  return all;
}

export function addConstraint(constraint: PersonalConstraint): PersonalConstraint {
  const s = getStore();
  const existing = s.constraints.get(constraint.aircrewId) || [];
  existing.push(constraint);
  s.constraints.set(constraint.aircrewId, existing);
  return constraint;
}

export function deleteConstraint(constraintId: string): boolean {
  const s = getStore();
  for (const [aircrewId, constraints] of s.constraints.entries()) {
    const idx = constraints.findIndex((c) => c.id === constraintId);
    if (idx !== -1) {
      constraints.splice(idx, 1);
      s.constraints.set(aircrewId, constraints);
      return true;
    }
  }
  return false;
}

// --- Qualifications ---

export function getQualification(aircrewId: string): QualificationRecord | undefined {
  return getStore().qualifications.get(aircrewId);
}

export function getAllQualifications(): QualificationRecord[] {
  return Array.from(getStore().qualifications.values());
}

// --- Training ---

export function getTrainingDefinitions(): TREventDefinition[] {
  return getStore().trainingDefinitions;
}

export function getTrainingRecords(aircrewId: string): TrainingEventRecord[] {
  return getStore().trainingRecords.get(aircrewId) || [];
}

// --- Squadron ---

export function getSquadron(): Squadron {
  return getStore().squadron;
}

export function updateSquadron(updates: Partial<Squadron>): Squadron {
  const s = getStore();
  s.squadron = { ...s.squadron, ...updates };
  return s.squadron;
}

// --- Scheduling Rules ---

export function getSchedulingRules(): SchedulingRule[] {
  return getStore().schedulingRules;
}
