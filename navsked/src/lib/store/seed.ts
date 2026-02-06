import { v4 as uuid } from 'uuid';
import { Aircrew, CrewPosition, PayGrade } from '@/types/aircrew';
import { QualificationRecord, CurrencyItem, ACTCLevel } from '@/types/qualifications';
import { TREventDefinition, TrainingEventRecord } from '@/types/training';
import { ScheduledFlight } from '@/types/schedule';
import { PersonalConstraint } from '@/types/constraints';
import { SchedulingRule } from '@/types/constraints';
import { Squadron } from '@/types/squadron';
import { FlightSchedule } from '@/types/schedule';
import { DataStore } from './index';
import { addDays, format } from 'date-fns';

function today() {
  return new Date();
}

function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function isoDateTime(d: Date): string {
  return d.toISOString();
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Squadron ---
function createSquadron(): Squadron {
  return {
    id: 'sq-vp10',
    designation: 'VP-10',
    nickname: 'Red Lancers',
    aircraftType: 'P-8A',
    community: 'VP',
    homeBase: 'NAS Jacksonville',
    frtpPhase: 'INTERMEDIATE',
    rPlusMonth: 8,
    assignedAircraft: 12,
    monthlyFlightHourAllocation: 180,
    standardCrewComposition: [
      { position: 'PPC', minCount: 1, minACTCLevel: 300, instructorRequired: false },
      { position: 'PP2P', minCount: 1, minACTCLevel: 200, instructorRequired: false },
      { position: 'TACCO', minCount: 1, minACTCLevel: 200, instructorRequired: false },
      { position: 'NAV_COMM', minCount: 1, minACTCLevel: 200, instructorRequired: false },
      { position: 'SS1', minCount: 1, minACTCLevel: 100, instructorRequired: false },
      { position: 'SS2', minCount: 1, minACTCLevel: 100, instructorRequired: false },
      { position: 'SS3', minCount: 1, minACTCLevel: 100, instructorRequired: false },
      { position: 'IFT', minCount: 1, minACTCLevel: 100, instructorRequired: false },
      { position: 'ORDNANCEMAN', minCount: 1, minACTCLevel: 100, instructorRequired: false },
    ],
    readinessRequirements: [
      { actcLevel: 500, minCrews: 2, targetPercentage: 10 },
      { actcLevel: 400, minCrews: 4, targetPercentage: 20 },
      { actcLevel: 300, minCrews: 8, targetPercentage: 40 },
      { actcLevel: 200, minCrews: 12, targetPercentage: 25 },
      { actcLevel: 100, minCrews: 15, targetPercentage: 5 },
    ],
  };
}

// --- Aircrew roster ---
interface CrewSeed {
  last: string; first: string; callsign: string;
  grade: PayGrade; des: 'PILOT' | 'NFO' | 'NAC';
  positions: CrewPosition[]; actc: number;
  instructor: boolean; evaluator: boolean;
}

const pilots: CrewSeed[] = [
  { last: 'Henderson', first: 'James', callsign: 'Hondo', grade: 'O-5', des: 'PILOT', positions: ['PPC'], actc: 500, instructor: true, evaluator: true },
  { last: 'Mitchell', first: 'Sarah', callsign: 'Torch', grade: 'O-4', des: 'PILOT', positions: ['PPC'], actc: 400, instructor: true, evaluator: false },
  { last: 'Reyes', first: 'Carlos', callsign: 'Viper', grade: 'O-4', des: 'PILOT', positions: ['PPC'], actc: 400, instructor: true, evaluator: false },
  { last: 'Chen', first: 'David', callsign: 'Slider', grade: 'O-4', des: 'PILOT', positions: ['PPC'], actc: 300, instructor: false, evaluator: false },
  { last: 'O\'Brien', first: 'Patrick', callsign: 'Shamrock', grade: 'O-3', des: 'PILOT', positions: ['PPC'], actc: 300, instructor: false, evaluator: false },
  { last: 'Walker', first: 'Emily', callsign: 'Strafe', grade: 'O-3', des: 'PILOT', positions: ['PPC', 'PP2P'], actc: 300, instructor: false, evaluator: false },
  { last: 'Brooks', first: 'Tyler', callsign: 'Brooksie', grade: 'O-3', des: 'PILOT', positions: ['PP2P'], actc: 200, instructor: false, evaluator: false },
  { last: 'Nakamura', first: 'Kenji', callsign: 'Ronin', grade: 'O-3', des: 'PILOT', positions: ['PP2P'], actc: 200, instructor: false, evaluator: false },
  { last: 'Patel', first: 'Priya', callsign: 'Flash', grade: 'O-2', des: 'PILOT', positions: ['PP2P', 'PP3P'], actc: 200, instructor: false, evaluator: false },
  { last: 'Kowalski', first: 'Adam', callsign: 'Ski', grade: 'O-2', des: 'PILOT', positions: ['PP2P', 'PP3P'], actc: 100, instructor: false, evaluator: false },
  { last: 'Davis', first: 'Marcus', callsign: 'Radar', grade: 'O-2', des: 'PILOT', positions: ['PP3P'], actc: 100, instructor: false, evaluator: false },
  { last: 'Thompson', first: 'Rachel', callsign: 'Tomcat', grade: 'O-2', des: 'PILOT', positions: ['PP3P'], actc: 100, instructor: false, evaluator: false },
];

const nfos: CrewSeed[] = [
  { last: 'Martinez', first: 'Roberto', callsign: 'Merlin', grade: 'O-4', des: 'NFO', positions: ['TACCO'], actc: 500, instructor: true, evaluator: true },
  { last: 'Kim', first: 'Jennifer', callsign: 'Jester', grade: 'O-4', des: 'NFO', positions: ['TACCO'], actc: 400, instructor: true, evaluator: false },
  { last: 'Sullivan', first: 'Brian', callsign: 'Sully', grade: 'O-3', des: 'NFO', positions: ['TACCO'], actc: 300, instructor: false, evaluator: false },
  { last: 'Nguyen', first: 'Thi', callsign: 'Phoenix', grade: 'O-3', des: 'NFO', positions: ['NAV_COMM', 'TACCO'], actc: 300, instructor: false, evaluator: false },
  { last: 'Wright', first: 'Daniel', callsign: 'Orion', grade: 'O-3', des: 'NFO', positions: ['NAV_COMM'], actc: 300, instructor: false, evaluator: false },
  { last: 'Jackson', first: 'Lisa', callsign: 'Sparks', grade: 'O-3', des: 'NFO', positions: ['NAV_COMM'], actc: 200, instructor: false, evaluator: false },
  { last: 'Anderson', first: 'Kyle', callsign: 'Ghost', grade: 'O-2', des: 'NFO', positions: ['NAV_COMM'], actc: 200, instructor: false, evaluator: false },
  { last: 'Garcia', first: 'Maria', callsign: 'Cipher', grade: 'O-2', des: 'NFO', positions: ['NAV_COMM'], actc: 100, instructor: false, evaluator: false },
];

const enlisted: CrewSeed[] = [
  { last: 'Johnson', first: 'Michael', callsign: '', grade: 'E-7', des: 'NAC', positions: ['SS1'], actc: 400, instructor: true, evaluator: false },
  { last: 'Williams', first: 'Robert', callsign: '', grade: 'E-6', des: 'NAC', positions: ['SS1', 'SS2'], actc: 300, instructor: false, evaluator: false },
  { last: 'Brown', first: 'Jessica', callsign: '', grade: 'E-6', des: 'NAC', positions: ['SS1', 'SS2'], actc: 300, instructor: false, evaluator: false },
  { last: 'Jones', first: 'Christopher', callsign: '', grade: 'E-5', des: 'NAC', positions: ['SS2', 'SS3'], actc: 200, instructor: false, evaluator: false },
  { last: 'Miller', first: 'Ashley', callsign: '', grade: 'E-5', des: 'NAC', positions: ['SS2', 'SS3'], actc: 200, instructor: false, evaluator: false },
  { last: 'Wilson', first: 'Brandon', callsign: '', grade: 'E-5', des: 'NAC', positions: ['SS3'], actc: 200, instructor: false, evaluator: false },
  { last: 'Moore', first: 'Danielle', callsign: '', grade: 'E-4', des: 'NAC', positions: ['SS3'], actc: 100, instructor: false, evaluator: false },
  { last: 'Taylor', first: 'Kevin', callsign: '', grade: 'E-6', des: 'NAC', positions: ['IFT'], actc: 300, instructor: true, evaluator: false },
  { last: 'Thomas', first: 'Amanda', callsign: '', grade: 'E-5', des: 'NAC', positions: ['IFT'], actc: 200, instructor: false, evaluator: false },
  { last: 'Harris', first: 'Jason', callsign: '', grade: 'E-4', des: 'NAC', positions: ['IFT'], actc: 100, instructor: false, evaluator: false },
  { last: 'Clark', first: 'Nicole', callsign: '', grade: 'E-5', des: 'NAC', positions: ['ORDNANCEMAN'], actc: 300, instructor: false, evaluator: false },
  { last: 'Lewis', first: 'Steven', callsign: '', grade: 'E-4', des: 'NAC', positions: ['ORDNANCEMAN'], actc: 200, instructor: false, evaluator: false },
  { last: 'Robinson', first: 'Kimberly', callsign: '', grade: 'E-4', des: 'NAC', positions: ['ORDNANCEMAN'], actc: 100, instructor: false, evaluator: false },
];

function buildAircrew(seed: CrewSeed): Aircrew {
  const id = uuid();
  const natopsBase = addDays(today(), -randomInt(30, 300));
  const natopsExpiry = addDays(natopsBase, 365);
  const natopsStatus = (() => {
    const daysLeft = Math.round((natopsExpiry.getTime() - today().getTime()) / 86400000);
    if (daysLeft < 0) return 'EXPIRED' as const;
    if (daysLeft < 30) return 'DUE' as const;
    return 'CURRENT' as const;
  })();

  return {
    id,
    lastName: seed.last,
    firstName: seed.first,
    callsign: seed.callsign,
    payGrade: seed.grade,
    designator: seed.des,
    qualifiedPositions: seed.positions,
    actcLevel: seed.actc,
    natopsStatus,
    lastNatopsCheck: isoDate(natopsBase),
    natopsExpiry: isoDate(natopsExpiry),
    flightHours: {
      totalCareer: randomInt(500, 4000),
      totalType: randomInt(200, 2000),
      last30Days: randomInt(5, 40),
      last90Days: randomInt(20, 100),
      last180Days: randomInt(50, 200),
      nightHours90Days: randomInt(2, 20),
      instrumentHours90Days: randomInt(3, 25),
    },
    isInstructor: seed.instructor,
    isNatopsEvaluator: seed.evaluator,
    squadronId: 'sq-vp10',
    dateAssigned: isoDate(addDays(today(), -randomInt(90, 900))),
    flightStatus: 'FLY',
  };
}

// --- Training Event Definitions (VP community) ---
function createTRDefinitions(): TREventDefinition[] {
  return [
    // CAT I - Safe for Flight
    { id: 'tr-cat1-1000', eventCode: 'CAT-I-1000', name: 'Preflight / Postflight', description: 'Aircraft preflight and postflight procedures', phase: 'CAT_I', targetACTCLevel: 100, minimumPerPeriod: 1, periodDays: 90, simSubstitutable: false, simPercentage: 0, prerequisites: [], requiredPositions: ['PPC', 'PP2P'], minCrewSize: 2, requiresInstructor: false, plannedDuration: 1, metMapping: ['MET-1.1'], timeOfDay: 'EITHER' },
    { id: 'tr-cat1-1010', eventCode: 'CAT-I-1010', name: 'Normal Procedures', description: 'Normal flight procedures including takeoff, flight, and landing', phase: 'CAT_I', targetACTCLevel: 100, minimumPerPeriod: 2, periodDays: 90, simSubstitutable: true, simPercentage: 50, prerequisites: ['CAT-I-1000'], requiredPositions: ['PPC', 'PP2P'], minCrewSize: 2, requiresInstructor: false, plannedDuration: 3, metMapping: ['MET-1.1'], timeOfDay: 'EITHER' },
    { id: 'tr-cat1-1020', eventCode: 'CAT-I-1020', name: 'Emergency Procedures', description: 'Engine failure, fire, hydraulic failure, electrical emergency', phase: 'CAT_I', targetACTCLevel: 100, minimumPerPeriod: 1, periodDays: 180, simSubstitutable: true, simPercentage: 100, prerequisites: ['CAT-I-1010'], requiredPositions: ['PPC', 'PP2P'], minCrewSize: 2, requiresInstructor: true, plannedDuration: 2, metMapping: ['MET-1.2'], timeOfDay: 'EITHER' },
    { id: 'tr-cat1-1030', eventCode: 'CAT-I-1030', name: 'Instrument Procedures', description: 'IFR flight, approaches, holds', phase: 'CAT_I', targetACTCLevel: 100, minimumPerPeriod: 2, periodDays: 90, simSubstitutable: true, simPercentage: 50, prerequisites: ['CAT-I-1010'], requiredPositions: ['PPC', 'PP2P'], minCrewSize: 2, requiresInstructor: false, plannedDuration: 3, metMapping: ['MET-1.3'], timeOfDay: 'EITHER' },
    { id: 'tr-cat1-1040', eventCode: 'CAT-I-1040', name: 'Night Operations', description: 'Night takeoff, flight, and landing', phase: 'CAT_I', targetACTCLevel: 100, minimumPerPeriod: 1, periodDays: 90, simSubstitutable: false, simPercentage: 0, prerequisites: ['CAT-I-1010'], requiredPositions: ['PPC', 'PP2P'], minCrewSize: 2, requiresInstructor: false, plannedDuration: 3, metMapping: ['MET-1.4'], timeOfDay: 'NIGHT' },
    // CAT II - Basic Mission
    { id: 'tr-cat2-2010', eventCode: 'CAT-II-2010', name: 'Surface Search', description: 'Radar and visual surface search operations', phase: 'CAT_II', targetACTCLevel: 200, minimumPerPeriod: 2, periodDays: 180, simSubstitutable: true, simPercentage: 50, prerequisites: ['CAT-I-1010'], requiredPositions: ['PPC', 'PP2P', 'TACCO', 'SS1'], minCrewSize: 5, requiresInstructor: false, plannedDuration: 4, metMapping: ['MET-2.1'], timeOfDay: 'EITHER' },
    { id: 'tr-cat2-2020', eventCode: 'CAT-II-2020', name: 'ASW - Passive Acoustics', description: 'Sonobuoy deployment and passive acoustic search', phase: 'CAT_II', targetACTCLevel: 200, minimumPerPeriod: 2, periodDays: 180, simSubstitutable: true, simPercentage: 50, prerequisites: ['CAT-I-1010'], requiredPositions: ['PPC', 'PP2P', 'TACCO', 'NAV_COMM', 'SS1', 'SS2'], minCrewSize: 7, requiresInstructor: false, plannedDuration: 5, metMapping: ['MET-2.2'], timeOfDay: 'EITHER' },
    { id: 'tr-cat2-2030', eventCode: 'CAT-II-2030', name: 'ASW - Active Acoustics', description: 'Active sonobuoy prosecution', phase: 'CAT_II', targetACTCLevel: 200, minimumPerPeriod: 1, periodDays: 180, simSubstitutable: true, simPercentage: 50, prerequisites: ['CAT-II-2020'], requiredPositions: ['PPC', 'PP2P', 'TACCO', 'NAV_COMM', 'SS1', 'SS2'], minCrewSize: 7, requiresInstructor: false, plannedDuration: 5, metMapping: ['MET-2.2'], timeOfDay: 'EITHER' },
    { id: 'tr-cat2-2040', eventCode: 'CAT-II-2040', name: 'ISR Operations', description: 'Intelligence, Surveillance, Reconnaissance flight', phase: 'CAT_II', targetACTCLevel: 200, minimumPerPeriod: 1, periodDays: 180, simSubstitutable: false, simPercentage: 0, prerequisites: ['CAT-II-2010'], requiredPositions: ['PPC', 'PP2P', 'TACCO', 'NAV_COMM', 'SS1', 'SS2', 'SS3'], minCrewSize: 8, requiresInstructor: false, plannedDuration: 5, metMapping: ['MET-2.3'], timeOfDay: 'EITHER' },
    { id: 'tr-cat2-2050', eventCode: 'CAT-II-2050', name: 'Communications Procedures', description: 'SATCOM, Link-16, UHF/VHF/HF procedures', phase: 'CAT_II', targetACTCLevel: 200, minimumPerPeriod: 1, periodDays: 180, simSubstitutable: true, simPercentage: 100, prerequisites: ['CAT-I-1010'], requiredPositions: ['NAV_COMM'], minCrewSize: 2, requiresInstructor: false, plannedDuration: 3, metMapping: ['MET-2.4'], timeOfDay: 'EITHER' },
    // CAT III - Advanced Mission
    { id: 'tr-cat3-3010', eventCode: 'CAT-III-3010', name: 'ASW - Multi-Static', description: 'Multi-static active coherent sonobuoy operations', phase: 'CAT_III', targetACTCLevel: 300, minimumPerPeriod: 1, periodDays: 180, simSubstitutable: true, simPercentage: 25, prerequisites: ['CAT-II-2030'], requiredPositions: ['PPC', 'PP2P', 'TACCO', 'NAV_COMM', 'SS1', 'SS2', 'SS3'], minCrewSize: 8, requiresInstructor: true, plannedDuration: 5, metMapping: ['MET-3.1'], timeOfDay: 'EITHER' },
    { id: 'tr-cat3-3020', eventCode: 'CAT-III-3020', name: 'ASUW - Harpoon Employment', description: 'Simulated AGM-84 Harpoon employment procedures', phase: 'CAT_III', targetACTCLevel: 300, minimumPerPeriod: 1, periodDays: 365, simSubstitutable: true, simPercentage: 75, prerequisites: ['CAT-II-2010'], requiredPositions: ['PPC', 'PP2P', 'TACCO', 'NAV_COMM', 'ORDNANCEMAN'], minCrewSize: 6, requiresInstructor: true, plannedDuration: 4, metMapping: ['MET-3.2'], timeOfDay: 'EITHER' },
    { id: 'tr-cat3-3030', eventCode: 'CAT-III-3030', name: 'Mining Operations', description: 'Simulated mine laying operations', phase: 'CAT_III', targetACTCLevel: 300, minimumPerPeriod: 1, periodDays: 365, simSubstitutable: true, simPercentage: 50, prerequisites: ['CAT-II-2010'], requiredPositions: ['PPC', 'PP2P', 'TACCO', 'NAV_COMM', 'ORDNANCEMAN'], minCrewSize: 6, requiresInstructor: true, plannedDuration: 4, metMapping: ['MET-3.3'], timeOfDay: 'EITHER' },
    { id: 'tr-cat3-3040', eventCode: 'CAT-III-3040', name: 'Low-Level Operations', description: 'Tactical low-level flight profiles', phase: 'CAT_III', targetACTCLevel: 300, minimumPerPeriod: 1, periodDays: 180, simSubstitutable: false, simPercentage: 0, prerequisites: ['CAT-I-1010'], requiredPositions: ['PPC', 'PP2P'], minCrewSize: 3, requiresInstructor: true, plannedDuration: 3, metMapping: ['MET-3.4'], timeOfDay: 'DAY' },
    // CAT IV - Integrated
    { id: 'tr-cat4-4010', eventCode: 'CAT-IV-4010', name: 'Integrated ASW Exercise', description: 'Full crew coordinated ASW prosecution with other assets', phase: 'CAT_IV', targetACTCLevel: 300, minimumPerPeriod: 1, periodDays: 365, simSubstitutable: false, simPercentage: 0, prerequisites: ['CAT-III-3010'], requiredPositions: ['PPC', 'PP2P', 'TACCO', 'NAV_COMM', 'SS1', 'SS2', 'SS3', 'IFT', 'ORDNANCEMAN'], minCrewSize: 9, requiresInstructor: false, plannedDuration: 6, metMapping: ['MET-4.1'], timeOfDay: 'EITHER' },
    { id: 'tr-cat4-4020', eventCode: 'CAT-IV-4020', name: 'Multi-Mission Sortie', description: 'Combined ISR/ASW/ASUW mission profile', phase: 'CAT_IV', targetACTCLevel: 300, minimumPerPeriod: 1, periodDays: 365, simSubstitutable: false, simPercentage: 0, prerequisites: ['CAT-II-2040', 'CAT-III-3010'], requiredPositions: ['PPC', 'PP2P', 'TACCO', 'NAV_COMM', 'SS1', 'SS2', 'SS3', 'IFT', 'ORDNANCEMAN'], minCrewSize: 9, requiresInstructor: false, plannedDuration: 6, metMapping: ['MET-4.2'], timeOfDay: 'EITHER' },
  ];
}

// --- Currencies for a VP aircrew member ---
function createCurrencies(des: 'PILOT' | 'NFO' | 'NAC'): CurrencyItem[] {
  const base: CurrencyItem[] = [
    {
      id: uuid(), name: 'Day Landing Currency', category: 'LANDING',
      requiredCount: 3, windowDays: 90,
      currentCount: randomInt(1, 6),
      lastEventDate: isoDate(addDays(today(), -randomInt(1, 60))),
      isCurrent: true, expiryDate: isoDate(addDays(today(), randomInt(10, 80))),
    },
    {
      id: uuid(), name: 'Night Landing Currency', category: 'LANDING',
      requiredCount: 1, windowDays: 90,
      currentCount: randomInt(0, 3),
      lastEventDate: isoDate(addDays(today(), -randomInt(5, 80))),
      isCurrent: true, expiryDate: isoDate(addDays(today(), randomInt(5, 85))),
    },
    {
      id: uuid(), name: 'CRM Currency', category: 'CRM',
      requiredCount: 1, windowDays: 365,
      currentCount: 1,
      lastEventDate: isoDate(addDays(today(), -randomInt(30, 300))),
      isCurrent: true, expiryDate: isoDate(addDays(today(), randomInt(30, 335))),
    },
  ];

  if (des === 'PILOT') {
    base.push({
      id: uuid(), name: 'Instrument Currency', category: 'INSTRUMENT',
      requiredCount: 6, windowDays: 180,
      currentCount: randomInt(2, 10),
      lastEventDate: isoDate(addDays(today(), -randomInt(3, 40))),
      isCurrent: true, expiryDate: isoDate(addDays(today(), randomInt(20, 150))),
    });
  }

  if (des === 'PILOT' || des === 'NFO') {
    base.push({
      id: uuid(), name: 'NVG Currency', category: 'NVG',
      requiredCount: 1, windowDays: 90,
      currentCount: randomInt(0, 2),
      lastEventDate: isoDate(addDays(today(), -randomInt(10, 80))),
      isCurrent: true, expiryDate: isoDate(addDays(today(), randomInt(5, 80))),
    });
  }

  if (des === 'NAC') {
    base.push({
      id: uuid(), name: 'Tactical Currency', category: 'TACTICAL',
      requiredCount: 1, windowDays: 90,
      currentCount: randomInt(0, 2),
      lastEventDate: isoDate(addDays(today(), -randomInt(5, 60))),
      isCurrent: true, expiryDate: isoDate(addDays(today(), randomInt(10, 80))),
    });
  }

  // Fix currency status
  for (const c of base) {
    c.isCurrent = c.currentCount >= c.requiredCount;
    if (!c.isCurrent && c.expiryDate) {
      // Already expired or will expire soon
      const daysLeft = Math.round((new Date(c.expiryDate).getTime() - today().getTime()) / 86400000);
      if (daysLeft < 0) {
        c.isCurrent = false;
      }
    }
  }

  return base;
}

// --- Scheduling Rules ---
function createSchedulingRules(): SchedulingRule[] {
  return [
    { id: 'rule-1', name: 'NATOPS Currency', description: 'Aircrew must have current NATOPS qualification to fly', type: 'HARD', weight: 100, category: 'QUALIFICATION', enabled: true },
    { id: 'rule-2', name: 'Crew Rest', description: 'Minimum 12 hours between end of duty day and next brief time', type: 'HARD', weight: 100, category: 'CREW_REST', enabled: true },
    { id: 'rule-3', name: 'Flight Duty Period', description: 'Max 16 hours from brief to debrief complete', type: 'HARD', weight: 100, category: 'CREW_REST', enabled: true },
    { id: 'rule-4', name: 'Personal Availability', description: 'Aircrew not on leave, DNIF, or TAD', type: 'HARD', weight: 100, category: 'AVAILABILITY', enabled: true },
    { id: 'rule-5', name: 'Position Qualification', description: 'Aircrew must be qualified for assigned seat', type: 'HARD', weight: 100, category: 'QUALIFICATION', enabled: true },
    { id: 'rule-6', name: 'Crew Composition', description: 'All required positions must be filled per T/M/S', type: 'HARD', weight: 100, category: 'CREW_COMPOSITION', enabled: true },
    { id: 'rule-7', name: 'Instructor for Training', description: 'Training flights require qualified instructor aboard', type: 'HARD', weight: 100, category: 'CREW_COMPOSITION', enabled: true },
    { id: 'rule-8', name: 'Flight Hour Fairness', description: 'Distribute flight hours equitably across the roster', type: 'SOFT', weight: 70, category: 'FAIRNESS', enabled: true },
    { id: 'rule-9', name: 'Training Priority', description: 'Prioritize aircrew with expiring currencies or near upgrade', type: 'SOFT', weight: 80, category: 'TRAINING_PRIORITY', enabled: true },
    { id: 'rule-10', name: 'Flight Hour Budget', description: 'Stay within monthly flight hour allocation', type: 'SOFT', weight: 60, category: 'FLIGHT_HOUR_BUDGET', enabled: true },
    { id: 'rule-11', name: 'Experience Mix', description: 'Each crew should have a mix of experience levels', type: 'SOFT', weight: 50, category: 'SAFETY', enabled: true },
  ];
}

// --- Build sample flights for this week ---
function createSampleFlights(aircrewList: Aircrew[]): ScheduledFlight[] {
  const flights: ScheduledFlight[] = [];
  const ppcs = aircrewList.filter((a) => a.qualifiedPositions.includes('PPC'));
  const copilots = aircrewList.filter((a) => a.qualifiedPositions.includes('PP2P'));
  const taccos = aircrewList.filter((a) => a.qualifiedPositions.includes('TACCO'));
  const navcomms = aircrewList.filter((a) => a.qualifiedPositions.includes('NAV_COMM'));
  const ss1s = aircrewList.filter((a) => a.qualifiedPositions.includes('SS1'));
  const ss2s = aircrewList.filter((a) => a.qualifiedPositions.includes('SS2'));
  const ss3s = aircrewList.filter((a) => a.qualifiedPositions.includes('SS3'));
  const ifts = aircrewList.filter((a) => a.qualifiedPositions.includes('IFT'));
  const ords = aircrewList.filter((a) => a.qualifiedPositions.includes('ORDNANCEMAN'));

  const flightNames = ['LANCER', 'RED', 'HUNTER', 'TRIDENT', 'SHADOW'];

  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const flightsPerDay = randomInt(2, 3);
    for (let fi = 0; fi < flightsPerDay; fi++) {
      const flightDay = addDays(today(), dayOffset);
      const briefHour = fi === 0 ? 6 : fi === 1 ? 11 : 17;
      const briefTime = new Date(flightDay);
      briefTime.setHours(briefHour, 0, 0, 0);
      const takeoffTime = new Date(briefTime);
      takeoffTime.setHours(briefHour + 1);
      const duration = randomInt(3, 6);
      const landTime = new Date(takeoffTime);
      landTime.setHours(takeoffTime.getHours() + duration);
      const debriefTime = new Date(landTime);
      debriefTime.setHours(landTime.getHours() + 1);

      const isNight = briefHour >= 17;
      const sideNum = `LL-${String(randomInt(700, 712)).padStart(3, '0')}`;
      const flightNum = `${pick(flightNames)} ${(dayOffset + 1) * 100 + fi + 1}`;

      const flight: ScheduledFlight = {
        id: uuid(),
        flightDesignator: flightNum,
        aircraftSideNumber: sideNum,
        scheduledBrief: isoDateTime(briefTime),
        scheduledTakeoff: isoDateTime(takeoffTime),
        scheduledLand: isoDateTime(landTime),
        scheduledDebrief: isoDateTime(debriefTime),
        plannedDuration: duration,
        crewAssignments: [
          { aircrewId: ppcs[dayOffset % ppcs.length].id, position: 'PPC', role: 'PRIMARY', isPIC: true },
          { aircrewId: copilots[(dayOffset + fi) % copilots.length].id, position: 'PP2P', role: fi === 0 ? 'STUDENT' : 'PRIMARY', isPIC: false },
          { aircrewId: taccos[(dayOffset + fi) % taccos.length].id, position: 'TACCO', role: 'PRIMARY', isPIC: false },
          { aircrewId: navcomms[(dayOffset + fi) % navcomms.length].id, position: 'NAV_COMM', role: 'PRIMARY', isPIC: false },
          { aircrewId: ss1s[dayOffset % ss1s.length].id, position: 'SS1', role: 'PRIMARY', isPIC: false },
          { aircrewId: ss2s[(dayOffset + fi) % ss2s.length].id, position: 'SS2', role: 'PRIMARY', isPIC: false },
          { aircrewId: ss3s[(dayOffset + fi) % ss3s.length].id, position: 'SS3', role: 'PRIMARY', isPIC: false },
          { aircrewId: ifts[dayOffset % ifts.length].id, position: 'IFT', role: 'PRIMARY', isPIC: false },
          { aircrewId: ords[dayOffset % ords.length].id, position: 'ORDNANCEMAN', role: 'PRIMARY', isPIC: false },
        ],
        plannedEvents: [],
        flightArea: pick(['W-168', 'W-174', 'JAX OPAREA', 'W-497', 'CHOCTAW']),
        flightType: pick(['TRAINING', 'TRAINING', 'CURRENCY', 'MISSION']),
        timeOfDay: isNight ? 'NIGHT' : 'DAY',
        status: dayOffset < 0 ? 'COMPLETED' : 'SCHEDULED',
        notes: fi === 0 ? 'ASW focused sortie' : undefined,
      };

      flights.push(flight);
    }
  }

  return flights;
}

// --- Build seed data ---
export function seedData(): DataStore {
  const squadron = createSquadron();
  const allSeeds = [...pilots, ...nfos, ...enlisted];
  const aircrewMap = new Map<string, Aircrew>();
  const qualMap = new Map<string, QualificationRecord>();
  const constraintMap = new Map<string, PersonalConstraint[]>();
  const trainingRecordMap = new Map<string, TrainingEventRecord[]>();

  const aircrewList: Aircrew[] = [];

  for (const seed of allSeeds) {
    const member = buildAircrew(seed);
    aircrewMap.set(member.id, member);
    aircrewList.push(member);

    // Build qualification record
    qualMap.set(member.id, {
      aircrewId: member.id,
      actcLevel: member.actcLevel as ACTCLevel,
      positionalQuals: member.qualifiedPositions.map((p) => ({
        position: p,
        dateQualified: isoDate(addDays(today(), -randomInt(90, 700))),
        actcLevel: member.actcLevel as ACTCLevel,
      })),
      instructorDesignations: member.isInstructor ? ['NATOPS_INSTRUCTOR'] : [],
      currencies: createCurrencies(seed.des),
    });

    // Some people on leave or DNIF
    constraintMap.set(member.id, []);
  }

  // Put a few people on leave/DNIF
  const leaveTargets = aircrewList.slice(5, 8);
  for (const lt of leaveTargets) {
    lt.flightStatus = 'LEAVE';
    constraintMap.set(lt.id, [{
      id: uuid(),
      aircrewId: lt.id,
      type: 'LEAVE',
      startDate: isoDate(addDays(today(), -1)),
      endDate: isoDate(addDays(today(), 5)),
      allDay: true,
      approved: true,
      notes: 'Annual leave',
    }]);
  }

  const dnifTarget = aircrewList[20];
  if (dnifTarget) {
    dnifTarget.flightStatus = 'DNIF';
    constraintMap.set(dnifTarget.id, [{
      id: uuid(),
      aircrewId: dnifTarget.id,
      type: 'MEDICAL',
      startDate: isoDate(addDays(today(), -3)),
      endDate: isoDate(addDays(today(), 10)),
      allDay: true,
      approved: true,
      notes: 'DNIF - medical hold',
    }]);
  }

  const trainingDefs = createTRDefinitions();

  // Create some training records
  for (const member of aircrewList) {
    const records: TrainingEventRecord[] = [];
    const numRecords = randomInt(3, 12);
    for (let i = 0; i < numRecords; i++) {
      const def = pick(trainingDefs);
      records.push({
        id: uuid(),
        aircrewId: member.id,
        eventDefinitionId: def.id,
        eventCode: def.eventCode,
        dateCompleted: isoDate(addDays(today(), -randomInt(5, 300))),
        medium: Math.random() > 0.3 ? 'FLIGHT' : 'SIM',
        grade: pick(['Q', 'Q', 'Q', 'P']),
      });
    }
    trainingRecordMap.set(member.id, records);
  }

  // Sample flights
  const sampleFlights = createSampleFlights(aircrewList);
  const flightsMap = new Map<string, ScheduledFlight>();
  for (const f of sampleFlights) {
    flightsMap.set(f.id, f);
  }

  // Create a schedule for this week
  const scheduleId = uuid();
  const weekSchedule: FlightSchedule = {
    id: scheduleId,
    squadronId: squadron.id,
    startDate: isoDate(today()),
    endDate: isoDate(addDays(today(), 6)),
    status: 'DRAFT',
    flights: sampleFlights,
    createdBy: 'OPSO',
    totalFlightHours: sampleFlights.reduce((sum, f) => sum + f.plannedDuration, 0),
    allocatedFlightHours: 45,
  };

  const schedulesMap = new Map<string, FlightSchedule>();
  schedulesMap.set(scheduleId, weekSchedule);

  return {
    squadron,
    aircrew: aircrewMap,
    qualifications: qualMap,
    trainingDefinitions: trainingDefs,
    trainingRecords: trainingRecordMap,
    constraints: constraintMap,
    flights: flightsMap,
    schedules: schedulesMap,
    schedulingRules: createSchedulingRules(),
  };
}
