import { CrewPosition } from './aircrew';
import { ACTCLevel } from './qualifications';

export type TRPhase = 'CAT_I' | 'CAT_II' | 'CAT_III' | 'CAT_IV';

export interface TREventDefinition {
  id: string;
  eventCode: string;
  name: string;
  description: string;
  phase: TRPhase;
  targetACTCLevel: ACTCLevel;
  minimumPerPeriod: number;
  periodDays: number;
  simSubstitutable: boolean;
  simPercentage: number;
  prerequisites: string[];
  requiredPositions: CrewPosition[];
  minCrewSize: number;
  requiresInstructor: boolean;
  plannedDuration: number;
  metMapping: string[];
  timeOfDay: 'DAY' | 'NIGHT' | 'EITHER';
}

export interface TrainingEventRecord {
  id: string;
  aircrewId: string;
  eventDefinitionId: string;
  eventCode: string;
  dateCompleted: string;
  medium: 'FLIGHT' | 'SIM';
  grade: 'Q' | 'P' | 'NO' | 'U';
  flightId?: string;
  instructorId?: string;
  notes?: string;
}

export interface TrainingPriority {
  aircrewId: string;
  expiringEvents: {
    eventCode: string;
    expiryDate: string;
    daysUntilExpiry: number;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  upgradeEvents: {
    eventCode: string;
    completionsNeeded: number;
  }[];
  overallScore: number;
}
