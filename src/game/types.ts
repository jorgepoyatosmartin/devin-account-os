export type Level = 1 | 2 | 3;
export type Tier = 1 | 2 | 3;
export type IndustryId = 'Banking' | 'Telecom' | 'Insurance' | 'Retail' | 'Technology' | 'Automotive';
export type RoleId = 'sdr' | 'ae' | 'se';

export type StakeholderRole =
  | 'Champion' | 'Economic Buyer' | 'Technical Buyer' | 'Engineering Director'
  | 'CTO' | 'CISO' | 'Procurement' | 'CFO';

export type Stage =
  | 'Discovery' | 'Technical' | 'Business Case' | 'Security Review' | 'Procurement' | 'Negotiation' | 'Closing';

export interface CompanyDef {
  id: string;
  name: string;
  industry: IndustryId;
  region: string;
  employees: number;
  tier: Tier;
  acv: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  cycle: 'Short' | 'Medium' | 'Long' | 'Very long';
  expansion: 'Low' | 'Medium' | 'High';
  stakeholders: StakeholderRole[];
  req: {
    rep: number;
    roles?: RoleId[];
    reference?: string[]; // any of these customers
    refTier?: Tier; // any customer of this tier
    partner?: boolean;
    level: Level;
  };
  blurb: string;
}

export interface Stakeholder {
  role: StakeholderRole;
  name: string;
  relationship: number; // 0-100
}

export interface Demand {
  kind: 'discount' | 'terms' | 'services';
  text: string;
  amount: number;
}

export interface Opportunity {
  id: string;
  companyId: string;
  stage: Stage;
  stageIdx: number;
  progress: number; // 0-100 within stage
  value: number;
  baseValue: number;
  termYears: 1 | 2 | 3;
  technical: number; // 0-100 technical confidence
  pain: number; // 0-100 pain clarity
  stakeholders: Stakeholder[];
  demand: Demand | null;
  demandsResolved: number;
  reference: boolean;
  daysOpen: number;
  closeAttempts: number;
  researched: boolean;
  nextMeetingDay: number;
  traded: boolean;
  ownerId: string | null;
  log: string[];
  source: 'Outbound' | 'SDR' | 'Partner';
}

export interface Employee {
  id: string;
  name: string;
  role: RoleId;
  salary: number;
  hiredDay: number;
}

export interface Contract {
  companyId: string;
  acv: number;
  termYears: number;
  signedDay: number;
}

export interface PartnerState {
  id: string;
  invested: number; // 0-100 development
  active: boolean;
}

export interface LogEntry {
  id: number;
  day: number;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'money' | 'unlock';
}

export type ModalKind =
  | { type: 'contract'; companyId: string; acv: number; term: number; unlocked: string[]; rep: number }
  | { type: 'unlock'; companyIds: string[] }
  | { type: 'level'; level: Level }
  | { type: 'complete' }
  | { type: 'away'; days: number; leads: number; meetings: number; pipeline: number; revenue: number }
  | { type: 'lost'; companyId: string; reason: string }
  | { type: 'achievement'; id: string };

export interface AccountState {
  research: number; // 0-100
  status: 'locked' | 'available' | 'customer';
  cooldownUntil: number;
  meetingBooked: boolean;
  announced: boolean;
}

export interface Stats {
  revenue: number;
  won: number;
  lost: number;
  meetings: number;
  biggestDeal: number;
  leads: number;
  accountsOpened: number;
}

export interface GameState {
  version: number;
  companyName: string;
  day: number;
  cash: number;
  reputation: number;
  focus: number;
  focusMax: number;
  level: Level;
  speed: 0 | 1 | 2 | 4;
  employees: Employee[];
  opportunities: Opportunity[];
  contracts: Contract[];
  partners: PartnerState[];
  accounts: Record<string, AccountState>;
  log: LogEntry[];
  logCounter: number;
  stats: Stats;
  achievements: string[];
  modals: ModalKind[];
  quarterClosed: number;
  lastSalaryDay: number;
  sdrTimer: number;
  partnerTimer: number;
  aeTimer: number;
  lastSaved: number; // epoch ms
  completed: boolean;
  continued: boolean;
  seed: number;
}
