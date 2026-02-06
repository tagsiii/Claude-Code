export type PayGrade =
  | 'E-1' | 'E-2' | 'E-3' | 'E-4' | 'E-5' | 'E-6' | 'E-7' | 'E-8' | 'E-9'
  | 'O-1' | 'O-2' | 'O-3' | 'O-4' | 'O-5' | 'O-6'
  | 'W-1' | 'W-2' | 'W-3' | 'W-4' | 'W-5';

export type CrewDesignator = 'PILOT' | 'NFO' | 'NAC' | 'OTHER';

export type CrewPosition =
  | 'PPC'        // Patrol Plane Commander
  | 'PP2P'       // Patrol Plane 2nd Pilot
  | 'PP3P'       // Patrol Plane 3rd Pilot
  | 'TACCO'      // Tactical Coordinator (NFO)
  | 'NAV_COMM'   // Navigator/Communicator (NFO)
  | 'SS1' | 'SS2' | 'SS3'  // Sensor Station operators
  | 'IFT'        // In-Flight Technician
  | 'ORDNANCEMAN'
  | 'HAC'        // Helicopter Aircraft Commander
  | 'H2P'        // Helicopter 2nd Pilot
  | 'ATO'        // Airborne Tactical Officer
  | 'SENSO'      // Sensor Operator
  | 'LEAD'       // Section lead (fighters)
  | 'WING'       // Wingman (fighters)
  | 'WSO';       // Weapon Systems Officer

export type FlightStatus = 'FLY' | 'DNIF' | 'TAD' | 'LEAVE' | 'GROUNDED';

export interface FlightHourRecord {
  totalCareer: number;
  totalType: number;
  last30Days: number;
  last90Days: number;
  last180Days: number;
  nightHours90Days: number;
  instrumentHours90Days: number;
}

export interface Aircrew {
  id: string;
  lastName: string;
  firstName: string;
  callsign: string;
  payGrade: PayGrade;
  designator: CrewDesignator;
  qualifiedPositions: CrewPosition[];
  actcLevel: number;
  natopsStatus: 'CURRENT' | 'DUE' | 'EXPIRED' | 'INITIAL';
  lastNatopsCheck: string;
  natopsExpiry: string;
  flightHours: FlightHourRecord;
  isInstructor: boolean;
  isNatopsEvaluator: boolean;
  squadronId: string;
  dateAssigned: string;
  flightStatus: FlightStatus;
}
