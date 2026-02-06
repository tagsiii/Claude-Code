import { CrewPosition } from './aircrew';
import { ACTCLevel } from './qualifications';

export type AircraftType =
  | 'P-8A' | 'FA-18E' | 'FA-18F' | 'EA-18G'
  | 'MH-60R' | 'MH-60S' | 'E-2D' | 'C-2A' | 'CMV-22B' | 'MQ-25A';

export type AviationCommunity =
  | 'VP' | 'VFA' | 'VAQ' | 'HSM' | 'HSC' | 'VAW' | 'VRC' | 'VUP';

export type FRTPPhase =
  | 'MAINTENANCE' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'SUSTAIN' | 'DEPLOYED';

export interface CrewCompositionRequirement {
  position: CrewPosition;
  minCount: number;
  minACTCLevel: ACTCLevel;
  instructorRequired: boolean;
}

export interface ReadinessRequirement {
  actcLevel: ACTCLevel;
  minCrews: number;
  targetPercentage: number;
}

export interface Squadron {
  id: string;
  designation: string;
  nickname: string;
  aircraftType: AircraftType;
  community: AviationCommunity;
  homeBase: string;
  frtpPhase: FRTPPhase;
  rPlusMonth: number;
  assignedAircraft: number;
  monthlyFlightHourAllocation: number;
  standardCrewComposition: CrewCompositionRequirement[];
  readinessRequirements: ReadinessRequirement[];
}
