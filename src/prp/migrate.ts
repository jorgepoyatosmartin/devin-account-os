import type { Opportunity, OpportunityPerson, OpportunityV2, PowerRole, Stage, Stakeholder } from '../types'

const LEGACY_STAGE: Record<Stage, { stageId: string; status: OpportunityV2['status'] }> = {
  Identified: { stageId: '1-disco-scheduled', status: 'open' },
  Discovery: { stageId: '2-engage', status: 'open' },
  Qualified: { stageId: '3-qualify', status: 'open' },
  Proposal: { stageId: '4-evaluate', status: 'open' },
  Negotiation: { stageId: '7-negotiate', status: 'open' },
  'Closed Won': { stageId: 'closed-won', status: 'won' },
  'Closed Lost': { stageId: 'closed-lost', status: 'lost' },
}

function toOpportunityPerson(
  stakeholderId: string,
  legacy: Opportunity,
  stakeholder?: Stakeholder,
): OpportunityPerson {
  const stakeholderRole = stakeholder?.powerRole
  const hasConfirmedRole = Boolean(
    stakeholderRole && stakeholderRole !== 'Unknown' && stakeholder.roleIsHypothesis !== true,
  )
  const role: PowerRole = hasConfirmedRole
    ? stakeholderRole!
    : legacy.economicBuyerId === stakeholderId
      ? 'Economic Buyer'
      : legacy.championId === stakeholderId
        ? 'Champion'
        : stakeholderRole ?? 'Unknown'

  return { stakeholderId, role, confirmed: hasConfirmedRole }
}

export function migrateOpportunity(legacy: Opportunity, stakeholders: Stakeholder[]): OpportunityV2 {
  const stage = LEGACY_STAGE[legacy.stage]
  const stakeholdersById = new Map(stakeholders.map((stakeholder) => [stakeholder.id, stakeholder]))
  const personIds = [...new Set([
    ...legacy.stakeholderIds,
    legacy.championId,
    legacy.economicBuyerId,
  ].filter((id): id is string => Boolean(id)))]

  return {
    ...legacy,
    amount: null,
    currency: 'EUR',
    closeDate: null,
    stageId: stage.stageId,
    status: stage.status,
    forecastCategory: stage.status === 'open' ? 'Pipeline' : 'Closed',
    countsForQuota: true,
    commissionType: 'new',
    stageHistory: [],
    exitChecks: {},
    people: personIds.map((id) => toOpportunityPerson(id, legacy, stakeholdersById.get(id))),
    engagement: [],
    origin: { signalIds: [] },
    productIds: [],
  }
}
