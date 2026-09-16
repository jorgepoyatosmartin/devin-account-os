export type Category = 'FACT' | 'SOURCE-BASED INTERPRETATION' | 'SALES HYPOTHESIS' | 'UNKNOWN';
export type Confidence = 'High' | 'Medium' | 'Low';
export type ValidationStatus = 'Confirmed' | 'Partially validated' | 'Hypothesis' | 'Validated';
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
  evidence: Evidence[];
  cognitionRelevance: string;
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
  buyingRole: string; // Economic Buyer, Champion, Influencer, Technical evaluator, Blocker, Unknown
  sources: Evidence[];
}

export interface ValidationRow {
  status: ValidationStatus;
  evidence: string;
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

export interface Dataset {
  accounts: Account[];
  stakeholders: Stakeholder[];
  signals: Signal[];
  opportunities: Opportunity[];
  cockpitActions: CockpitAction[];
}
