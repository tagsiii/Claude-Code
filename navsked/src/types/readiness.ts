import { ACTCLevel } from './qualifications';

export interface SquadronReadiness {
  squadronId: string;
  asOfDate: string;
  tRating: number;
  experienceFactor: number;
  performanceFactor: number;
  actcDistribution: {
    level: ACTCLevel;
    count: number;
    percentage: number;
  }[];
  combatReadyPercentage: number;
  metReadiness: METReadiness[];
  flightHourStatus: {
    allocated: number;
    executed: number;
    remaining: number;
    projectedShortfall: number;
  };
  overallStatus: 'GREEN' | 'AMBER' | 'RED';
}

export interface METReadiness {
  metCode: string;
  metName: string;
  readinessScore: number;
  subEvents: {
    eventCode: string;
    required: number;
    completed: number;
    percentComplete: number;
  }[];
}

export interface CrewMemberReadiness {
  aircrewId: string;
  actcLevel: ACTCLevel;
  missionCapable: boolean;
  currencyStatus: 'ALL_CURRENT' | 'SOME_EXPIRING' | 'SOME_EXPIRED';
  daysToNextExpiry: number;
  eventsToNextLevel: number;
  status: 'GREEN' | 'AMBER' | 'RED';
}
