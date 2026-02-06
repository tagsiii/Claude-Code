import { CrewPosition } from './aircrew';

export type ACTCLevel = 100 | 200 | 300 | 400 | 500;

export type NATOPSStatus = 'CURRENT' | 'DUE' | 'EXPIRED' | 'INITIAL';

export type CurrencyCategory =
  | 'LANDING'
  | 'INSTRUMENT'
  | 'NVG'
  | 'TACTICAL'
  | 'EMERGENCY'
  | 'CRM';

export interface CurrencyItem {
  id: string;
  name: string;
  category: CurrencyCategory;
  requiredCount: number;
  windowDays: number;
  currentCount: number;
  lastEventDate: string | null;
  isCurrent: boolean;
  expiryDate: string | null;
}

export interface PositionalQual {
  position: CrewPosition;
  dateQualified: string;
  actcLevel: ACTCLevel;
}

export type InstructorDesignation =
  | 'NATOPS_INSTRUCTOR'
  | 'NATOPS_EVALUATOR'
  | 'CRM_FACILITATOR'
  | 'CRM_INSTRUCTOR'
  | 'FRS_INSTRUCTOR'
  | 'WTI';

export interface QualificationRecord {
  aircrewId: string;
  actcLevel: ACTCLevel;
  positionalQuals: PositionalQual[];
  instructorDesignations: InstructorDesignation[];
  currencies: CurrencyItem[];
}
