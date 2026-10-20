import opportunitiesData from '../data/opportunities.json'
import stakeholdersData from '../data/stakeholders.json'
import { describe, expect, it } from 'vitest'
import { migrateOpportunity } from './migrate'
import type { Opportunity, OpportunityV2, PowerRole, Stage, Stakeholder } from '../types'

const opportunities = opportunitiesData as unknown as Opportunity[]
const stakeholders = stakeholdersData as unknown as Stakeholder[]
const legacyStages: Array<[Stage, string, OpportunityV2['status']]> = [
  ['Identified', '1-disco-scheduled', 'open'],
  ['Discovery', '2-engage', 'open'],
  ['Qualified', '3-qualify', 'open'],
  ['Proposal', '4-evaluate', 'open'],
  ['Negotiation', '7-negotiate', 'open'],
  ['Closed Won', 'closed-won', 'won'],
  ['Closed Lost', 'closed-lost', 'lost'],
]

describe('migrateOpportunity', () => {
  it.each(legacyStages)('maps legacy stage %s', (stage, stageId, status) => {
    const migrated = migrateOpportunity({ ...opportunities[0], stage }, stakeholders)
    expect(migrated.stageId).toBe(stageId)
    expect(migrated.status).toBe(status)
  })

  it('migrates all five bundled opportunities without invented amounts or dates', () => {
    expect(opportunities).toHaveLength(5)
    const migrated = opportunities.map((opportunity) => migrateOpportunity(opportunity, stakeholders))
    expect(migrated).toHaveLength(5)
    expect(migrated.every((opportunity) => opportunity.amount === null)).toBe(true)
    expect(migrated.every((opportunity) => opportunity.closeDate === null)).toBe(true)
    expect(migrated.every((opportunity) => opportunity.stageId === '1-disco-scheduled')).toBe(true)

    for (const [index, opportunity] of opportunities.entries()) {
      const result = migrated[index]
      const expectedIds = new Set([
        ...opportunity.stakeholderIds,
        opportunity.championId,
        opportunity.economicBuyerId,
      ].filter((id): id is string => Boolean(id)))
      expect(new Set(result.people.map((person) => person.stakeholderId))).toEqual(expectedIds)

      for (const person of result.people) {
        const stakeholder = stakeholders.find((candidate) => candidate.id === person.stakeholderId)
        const role = stakeholder?.powerRole as PowerRole | undefined
        expect(person.confirmed).toBe(Boolean(role && role !== 'Unknown' && stakeholder?.roleIsHypothesis !== true))
      }
    }
  })
})
