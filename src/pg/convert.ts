import type { Hypothesis, OpportunityV2, Stakeholder } from '../types'

export interface DiscoveryConversion {
  id: string
  accountId: string
  name: string
  amount: number | null
  valueAssumptions?: string
  stakeholderIds: string[]
  signalIds: string[]
  productIds: string[]
  salesPlayId?: string
  pgId?: string
  hypothesisId?: string
  today: string
}

const emptyValidation = () => ({ status: 'Unknown' as const, evidence: '' })

export function convertDiscoveryToOpportunity(
  source: DiscoveryConversion,
  stakeholders: Stakeholder[],
): OpportunityV2 {
  const people = source.stakeholderIds.map((stakeholderId) => ({
    stakeholderId,
    role: 'Unknown' as const,
    confirmed: false,
  }))
  return {
    id: `opp-${source.hypothesisId || source.pgId || source.id}`,
    accountId: source.accountId,
    name: source.name,
    businessUnit: stakeholders.find((person) => source.stakeholderIds.includes(person.id))?.businessUnit || 'Unassigned',
    useCase: source.name,
    potentialValue: source.amount == null ? 'TBD — VALIDATION REQUIRED' : String(source.amount),
    stage: 'Identified',
    stakeholderIds: source.stakeholderIds,
    competition: 'UNKNOWN — VALIDATION REQUIRED',
    meddpicc: {
      metrics: '', economicBuyer: '', decisionCriteria: '', decisionProcess: '',
      paperProcess: '', identifyPain: '', champion: '', competition: '',
    },
    nextAction: source.valueAssumptions || 'Schedule discovery meeting',
    evidence: [],
    confidence: 'Low',
    threeWhys: {
      whyAnything: { situation: '', problem: '', implication: '' },
      whyNow: { trigger: '', timing: '', urgency: '' },
      whyCognition: { customerPain: '', cognitionCapability: '', businessOutcome: '' },
      validation: {
        situation: emptyValidation(),
        problem: emptyValidation(),
        implication: emptyValidation(),
        whyNow: emptyValidation(),
        whyCognition: emptyValidation(),
      },
      discoveryQuestions: {
        situation: [], problem: [], implication: [], whyNow: [], whyCognition: [],
      },
    },
    amount: source.amount,
    currency: 'EUR',
    closeDate: null,
    stageId: '1-disco-scheduled',
    status: 'open',
    forecastCategory: 'Pipeline',
    countsForQuota: true,
    commissionType: 'new',
    stageHistory: [{ stageId: '1-disco-scheduled', date: source.today }],
    exitChecks: {},
    people,
    engagement: [],
    origin: {
      signalIds: source.signalIds,
      ...(source.pgId ? { pgId: source.pgId } : {}),
      ...(source.hypothesisId ? { hypothesisId: source.hypothesisId } : {}),
    },
    productIds: source.productIds,
    ...(source.salesPlayId ? { salesPlayId: source.salesPlayId } : {}),
  }
}

export function hypothesisConversion(hypothesis: Hypothesis, today: string): DiscoveryConversion {
  return {
    id: hypothesis.id,
    accountId: hypothesis.accountId,
    name: hypothesis.title,
    amount: hypothesis.valueEstimate.amount,
    valueAssumptions: hypothesis.valueEstimate.assumptions,
    stakeholderIds: hypothesis.stakeholderIds,
    signalIds: hypothesis.signalIds,
    productIds: hypothesis.productIds,
    salesPlayId: hypothesis.salesPlayId,
    pgId: hypothesis.pgId,
    hypothesisId: hypothesis.id,
    today,
  }
}
