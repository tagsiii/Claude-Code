import { CrewPosition } from './aircrew';

export type ScheduleStatus = 'DRAFT' | 'PROPOSED' | 'APPROVED' | 'PUBLISHED' | 'EXECUTED';

export type FlightType =
  | 'TRAINING'
  | 'CURRENCY'
  | 'MISSION'
  | 'CHECK_RIDE'
  | 'FUNCTIONAL'
  | 'CROSS_COUNTRY'
  | 'SEARCH_RESCUE';

export type SortieStatus = 'SCHEDULED' | 'BRIEFING' | 'AIRBORNE' | 'COMPLETED' | 'CANCELLED' | 'WEATHER_CANCELLED';

export interface CrewAssignment {
  aircrewId: string;
  position: CrewPosition;
  role: 'PRIMARY' | 'INSTRUCTOR' | 'EVALUATOR' | 'STUDENT' | 'OBSERVER';
  isPIC: boolean;
}

export interface PlannedTrainingEvent {
  eventDefinitionId: string;
  eventCode: string;
  targetAircrewIds: string[];
  instructorId?: string;
}

export interface ScheduledFlight {
  id: string;
  flightDesignator: string;
  aircraftSideNumber?: string;
  scheduledBrief: string;
  scheduledTakeoff: string;
  scheduledLand: string;
  scheduledDebrief: string;
  actualTakeoff?: string;
  actualLand?: string;
  plannedDuration: number;
  crewAssignments: CrewAssignment[];
  plannedEvents: PlannedTrainingEvent[];
  flightArea?: string;
  specialEquipment?: string[];
  flightType: FlightType;
  timeOfDay: 'DAY' | 'NIGHT' | 'MIXED';
  status: SortieStatus;
  notes?: string;
}

export interface ValidationResult {
  isValid: boolean;
  hardViolations: ConstraintViolation[];
  softViolations: ConstraintViolation[];
  fitnessScore: number;
  summary: {
    totalFlightHours: number;
    crewUtilization: number;
    trainingEventsScheduled: number;
    currenciesAddressed: number;
    fairnessDeviation: number;
  };
}

export interface ConstraintViolation {
  ruleId: string;
  ruleName: string;
  severity: 'HARD' | 'SOFT';
  flightId: string;
  aircrewId?: string;
  message: string;
  suggestion?: string;
}

export interface FlightSchedule {
  id: string;
  squadronId: string;
  startDate: string;
  endDate: string;
  status: ScheduleStatus;
  flights: ScheduledFlight[];
  createdBy: string;
  approvedBy?: string;
  validationResult?: ValidationResult;
  totalFlightHours: number;
  allocatedFlightHours: number;
}
