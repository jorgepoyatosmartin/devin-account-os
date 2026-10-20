import synthetic from './__fixtures__/synthetic.json'
import { scenariosConfig, type StageDefinition } from '../config'
import { prp } from './engine'
import { prpScenario } from './scenarios'
import type { CompPlan, OpportunityV2 } from '../types'
import { describe, expect, it } from 'vitest'

type Fixture = {
  plan: CompPlan
  stageProbabilities: Record<string, number>
  opportunities: (Pick<OpportunityV2, 'id' | 'status' | 'amount' | 'currency' | 'closeDate' | 'forecastCategory' | 'countsForQuota' | 'commissionType'> & { stage: string })[]
  expected: { today: string }
}
const fixture = synthetic as unknown as Fixture
const opportunities = fixture.opportunities.map(({ stage, ...opportunity }) => ({
  ...opportunity,
  stageId: stage,
})) as unknown as OpportunityV2[]
const stages = Object.entries(fixture.stageProbabilities).map(([id, probability], index) => ({
  id,
  label: id,
  probability,
  order: index + 1,
  exitCriteria: [],
})) satisfies StageDefinition[]

describe('prpScenario', () => {
  it('matches the base PRP projected sales', () => {
    const base = scenariosConfig.find((scenario) => scenario.id === 'base')!
    const result = prpScenario(opportunities, fixture.plan, stages, fixture.expected.today, base)
    const basePrp = prp(opportunities, fixture.plan, fixture.stageProbabilities, fixture.expected.today)

    expect(result.projectedSales).toBeCloseTo(basePrp.closedWonQuota + basePrp.pipelineWeighted, 2)
  })

  it('slips an early-stage opportunity beyond the fiscal year', () => {
    const base = scenariosConfig.find((scenario) => scenario.id === 'base')!
    const conservative = scenariosConfig.find((scenario) => scenario.id === 'conservative')!
    const earlyStageOpportunity = {
      ...opportunities.find((opportunity) => opportunity.id === 'o3')!,
      closeDate: '2027-12-20',
    }
    const baseResult = prpScenario([earlyStageOpportunity], fixture.plan, stages, fixture.expected.today, base)
    const conservativeResult = prpScenario([earlyStageOpportunity], fixture.plan, stages, fixture.expected.today, conservative)

    expect(baseResult.projectedSales).toBeGreaterThan(0)
    expect(conservativeResult.projectedSales).toBe(0)
  })

  it('caps adjusted stage probabilities at one', () => {
    const ambitious = scenariosConfig.find((scenario) => scenario.id === 'ambitious')!
    const opportunity = {
      ...opportunities[1],
      id: 'cap-test',
      stageId: 'high-probability',
      amount: 1000,
      currency: 'EUR' as const,
      closeDate: '2027-05-10',
    }
    const result = prpScenario(
      [opportunity],
      fixture.plan,
      [{ id: 'high-probability', label: 'Synthetic', probability: 0.9, order: 1, exitCriteria: [] }],
      fixture.expected.today,
      ambitious,
    )

    expect(result.projectedSales).toBeCloseTo(1000, 2)
  })
})
