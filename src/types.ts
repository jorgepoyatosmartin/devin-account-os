export type Category = 'FACT' | 'SOURCE-BASED INTERPRETATION' | 'SALES HYPOTHESIS' | 'UNKNOWN';
export type Confidence = 'High' | 'Medium' | 'Low';
export type ValidationStatus = 'Confirmed' | 'Partially validated' | 'Hypothesis' | 'Validated' | 'Unknown';
export type PowerRole =
  | 'Executive Sponsor'
  | 'Economic Buyer'
  | 'Champion'
  | 'Technical Champion'
  | 'Business Champion'
  | 'Influencer'
  | 'Technical Evaluator'
  | 'Security'
  | 'Procurement'
  | 'Legal'
  | 'Coach'
  | 'Blocker'
  | 'Unknown';
export type Influence = 'High' | 'Medium' | 'Low' | 'Unknown';
export type Level = 'Board / CEO' | 'Executive Committee' | 'Senior Leadership' | 'Director' | 'Manager' | 'Individual Contributor' | 'Unknown';
export type DataOrigin = 'TERRITORY PLAN' | 'ORIGINAL EXCEL DATA' | 'PUBLIC RESEARCH' | 'SALES HYPOTHESIS' | 'UNKNOWN';
export type Relevance = 'HIGH' | 'MEDIUM' | 'LOW / EXPLORATORY' | 'NOT RELEVANT';
export type DevinCategory =
  | 'Feature Development'
  | 'Migrations'
  | 'Code Quality'
  | 'Incident Response'
  | 'Data & Analytics'
  | 'Automations'
  | 'Project Management'
  | 'Integrations'
  | 'API'
  | 'Scheduling'
  | 'Playbooks'
  | 'MCP'
  | 'Advanced workflows';
export type Stage =
  | 'Identified'
  | 'Discovery'
  | 'Qualified'
  | 'Proposal'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost';
export type RelationshipStatus = 'No contact' | 'Identified' | 'Contacted' | 'Engaged' | 'Champion';

export interface Evidence {
  claim: string;
  source: string;
  url?: string;
  date?: string; // ISO date or 'YYYY-MM'
  category: Category;
  confidence: Confidence;
}

export interface Initiative {
  id: string;
  name: string;
  area: string; // AI, Generative AI, Agentic AI, Digital transformation, Cloud, ...
  businessObjective: string;
  currentSituation?: string;
  potentialProblem?: string; // SALES HYPOTHESIS unless evidence says otherwise
  potentialImplication?: string;
  evidence: Evidence[];
  cognitionRelevance: string;
  problemCategory?: Category;
}

export interface Whitespace {
  area: string;
  currentRelationship: string;
  existingUseCases: string;
  untappedAreas: string;
  potentialOpportunity: string;
}

export interface UseCase {
  id: string;
  name: string;
  whyAnything: string;
  whyNow: string;
  whyCognition: string;
  businessOutcome: string;
  opportunityId?: string;
  initiativeId?: string;
  category?: DevinCategory;
  relevance?: Relevance;
  businessProblem?: string;
  targetStakeholderIds?: string[];
  evidenceSummary?: string;
}

export interface TechnologyProfile {
  technologyStrategy: string;
  cloudStrategy: string;
  aiStrategy: string;
  generativeAI: string;
  agenticAI: string;
  softwareEngineering: string;
  developerProductivity: string;
  digitalTransformation: string;
  applicationModernization: string;
  legacyEnvironment: string;
  data: string;
  cybersecurity: string;
}

export interface RelevanceChain {
  customerStrategy: string;
  businessProblem: string;
  potentialCognitionValue: string;
  category: Category;
}

export interface CompetitiveIntel {
  currentTechnology: string;
  potentialCompetitor: string;
  evidence: string;
  category: Category;
  differentiation: string;
  discoveryQuestion: string;
}

export interface Account {
  id: string;
  name: string;
  sector: string;
  headquarters: string;
  overview: string;
  revenue: string;
  employees: string;
  geographicFootprint: string;
  businessUnits: string[];
  productsServices: string[];
  strategicPriorities: string[];
  financialPerformance: string;
  growthPriorities: string[];
  costRestructuringInitiatives: string[];
  mnaActivity: string[];
  companyEvidence: Evidence[];
  initiatives: Initiative[];
  useCases: UseCase[];
  whitespace: Whitespace[];
  keyMarkets?: string[];
  technology?: TechnologyProfile;
  cognitionRelevanceChain?: RelevanceChain[];
  competitiveIntel?: CompetitiveIntel[];
}

export interface Signal {
  id: string;
  accountId: string;
  date: string;
  type: string; // AI initiative, New executive, M&A, Hiring, Partnership, ...
  signal: string;
  businessRelevance: string;
  cognitionRelevance: string;
  threeWhysImpact: string;
  salesAction: string;
  category: Category;
  source: string;
  url?: string;
}

export interface Stakeholder {
  id: string;
  accountId: string;
  name: string;
  title: string;
  functionArea: string; // CEO, CIO, CTO, AI/Data, Engineering, Cloud, Security, Procurement, ...
  responsibilities: string;
  strategicPriorities: string;
  technologyPriorities: string;
  relevantInitiatives: string[];
  publicStatements: Evidence[];
  recentActivity: string;
  potentialPain: string;
  cognitionRelevance: string;
  relationshipStatus: RelationshipStatus;
  buyingRole: string; // legacy free text; prefer powerRole
  sources: Evidence[];
  // Power chart fields (optional for backwards compatibility)
  powerRole?: PowerRole;
  roleIsHypothesis?: boolean; // true => show 'HYPOTHESIS — VALIDATION REQUIRED'
  level?: Level;
  businessUnit?: string;
  influence?: Influence;
  championPotential?: 'High' | 'Medium' | 'Low' | 'Unknown';
  reportsTo?: string; // stakeholder id, only when sourced
  dataOrigin?: DataOrigin;
  lastUpdated?: string;
  recommendedNextAction?: string;
  useCaseIds?: string[];
  // Original Excel columns (ACCIONA import) — preserved verbatim
  excel?: { person: string; title: string; level: string; businessUnit: string; salesPlay: string; action: string; whyHighTarget: string };
}

export interface ValidationRow {
  status: ValidationStatus;
  evidence: string;
  source?: string;
  lastUpdated?: string;
}

export interface ThreeWhys {
  whyAnything: {
    situation: string;
    problem: string;
    implication: string;
  };
  whyNow: {
    trigger: string;
    timing: string;
    urgency: string;
  };
  whyCognition: {
    customerPain: string;
    cognitionCapability: string;
    businessOutcome: string;
  };
  validation: {
    situation: ValidationRow;
    problem: ValidationRow;
    implication: ValidationRow;
    whyNow: ValidationRow;
    whyCognition: ValidationRow;
  };
  discoveryQuestions: {
    situation: string[];
    problem: string[];
    implication: string[];
    whyNow: string[];
    whyCognition: string[];
  };
}

export interface Meddpicc {
  metrics: string;
  economicBuyer: string;
  decisionCriteria: string;
  decisionProcess: string;
  paperProcess: string;
  identifyPain: string;
  champion: string;
  competition: string;
}

export interface Opportunity {
  id: string;
  accountId: string;
  name: string;
  businessUnit: string;
  initiativeId?: string;
  useCase: string;
  potentialValue: string; // 'TBD — VALIDATION REQUIRED' when unknown
  stage: Stage;
  stakeholderIds: string[];
  championId?: string;
  economicBuyerId?: string;
  competition: string;
  meddpicc: Meddpicc;
  nextAction: string;
  evidence: Evidence[];
  confidence: Confidence;
  threeWhys: ThreeWhys;
}

export interface CockpitAction {
  id: string;
  priority: number;
  accountId: string;
  opportunityId?: string;
  stakeholderId?: string;
  signal: string;
  whyThisMatters: string;
  recommendedAction: string;
  suggestedMessage: string;
  expectedOutcome: string;
}

export interface MeetingNote {
  id: string;
  date: string;
  accountId: string;
  opportunityId?: string;
  rawNotes: string;
  whatWeLearned: string;
  whatChanged: string;
  whatWasValidated: string;
  whatWasDisproved: string;
  whatRemainsUnknown: string;
  nextAction: string;
}

export type TaskStatus = 'Open' | 'Done';
export interface Task {
  id: string;
  title: string;
  accountId: string;
  opportunityId?: string;
  stakeholderId?: string;
  due?: string;
  status: TaskStatus;
  createdAt: string;
  source?: string; // e.g. 'cockpit', 'meeting', 'manual'
}

export interface Dataset {
  accounts: Account[];
  stakeholders: Stakeholder[];
  signals: Signal[];
  opportunities: Opportunity[];
  cockpitActions: CockpitAction[];
}
