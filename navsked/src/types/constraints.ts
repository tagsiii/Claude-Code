export type ConstraintType =
  | 'LEAVE'
  | 'DUTY'
  | 'MEDICAL'
  | 'TRAINING_GROUND'
  | 'COLLATERAL_DUTY'
  | 'PRT'
  | 'SIM'
  | 'PERSONAL'
  | 'TAD'
  | 'ALERT'
  | 'NO_FLY_DAY';

export interface PersonalConstraint {
  id: string;
  aircrewId: string;
  type: ConstraintType;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  notes?: string;
  approved: boolean;
}

export type RuleCategory =
  | 'CREW_REST'
  | 'QUALIFICATION'
  | 'CREW_COMPOSITION'
  | 'CURRENCY'
  | 'AVAILABILITY'
  | 'FAIRNESS'
  | 'TRAINING_PRIORITY'
  | 'FLIGHT_HOUR_BUDGET'
  | 'MAINTENANCE'
  | 'SAFETY';

export interface SchedulingRule {
  id: string;
  name: string;
  description: string;
  type: 'HARD' | 'SOFT';
  weight: number;
  category: RuleCategory;
  enabled: boolean;
}
