import synthetic from './__fixtures__/synthetic.json'
import { compGross, prp, salesNeededForGross } from './engine'
import type { CompPlan, OpportunityV2, PrpQuarterResult, PrpResult } from '../types'
import { describe, expect, it } from 'vitest'

type FixtureQuarter = Partial<PrpQuarterResult> & Pick<PrpQuarterResult, 'q'>
type FixtureOpportunity = Pick<
  OpportunityV2,
  'id' | 'status' | 'amount' | 'currency' | 'closeDate' | 'forecastCategory' | 'countsForQuota' | 'commissionType'
> & { stage: string }
type FixtureExpected = Omit<PrpResult, 'year' | 'quarters'> & {
  today: string
  quarters: FixtureQuarter[]
  compGrossAt: Record<string, number>
  salesNeededForNetNoRenewal: Record<string, number>
}
type Fixture = {
  plan: CompPlan
  stageProbabilities: Record<string, number>
  opportunities: FixtureOpportunity[]
  expected: FixtureExpected
}

const fixture = synthetic as unknown as Fixture
const moneyFields = new Set([
  'annualQuota',
  'closedWonQuota',
  'renewalClosed',
  'gapToQuota',
  'grossCommissionNeeded',
  'personalTargetSales',
  'gapToPersonal',
  'pipelineTotal',
  'pipelineWeighted',
  'forecastCommit',
  'forecastBestCase',
  'pipelineRequiredQuota',
  'pipelineGapQuota',
  'pipelineRequiredPersonal',
  'pipelineGapPersonal',
  'weeklyPipelinePacePersonal',
  'commissionGrossClosed',
  'commissionNetClosed',
  'commissionGrossCommit',
])
const quarterMoneyFields = new Set(['quota', 'closedWonQuota', 'personalTarget', 'pipelineTotal'])

describe('PRP engine', () => {
  it('matches every field in the authoritative synthetic fixture', () => {
    const { expected } = fixture
    const opportunities = fixture.opportunities.map(({ stage, ...opportunity }) => ({
      ...opportunity,
      stageId: stage,
    })) as unknown as OpportunityV2[]
    const result = prp(opportunities, fixture.plan, fixture.stageProbabilities, expected.today)
    expect(result.year).toBe(fixture.plan.fiscalYear)

    for (const [key, value] of Object.entries(expected)) {
      if (key === 'today') {
        expect(expected.today).toBe(value)
      } else if (key === 'compGrossAt') {
        for (const [sales, gross] of Object.entries(expected.compGrossAt)) {
          expect(compGross(Number(sales), fixture.plan)).toBeCloseTo(gross, 2)
        }
      } else if (key === 'salesNeededForNetNoRenewal') {
        for (const [netTarget, sales] of Object.entries(expected.salesNeededForNetNoRenewal)) {
          expect(salesNeededForGross(Number(netTarget) / fixture.plan.taxFactor, fixture.plan))
            .toBeCloseTo(sales, 2)
        }
      } else if (key === 'quarters') {
        expect(result.quarters).toHaveLength(4)
        expected.quarters.forEach((quarter, index) => {
          const actual = result.quarters[index]
          for (const [field, quarterValue] of Object.entries(quarter)) {
            const actualValue = actual[field as keyof PrpQuarterResult]
            if (typeof quarterValue === 'number' && quarterMoneyFields.has(field)) {
              expect(actualValue).toBeCloseTo(quarterValue, 2)
            } else {
              expect(actualValue).toEqual(quarterValue)
            }
          }
          if (quarter.pipelineTotal === undefined) {
            expect(actual.pipelineTotal).toBeCloseTo(0, 2)
          }
        })
      } else if (key === 'weeksRemaining') {
        expect(result.weeksRemaining).toBeCloseTo(expected.weeksRemaining, 4)
      } else if (moneyFields.has(key)) {
        expect((result as unknown as Record<string, number>)[key]).toBeCloseTo(
          (expected as unknown as Record<string, number>)[key],
          2,
        )
      } else {
        expect((result as unknown as Record<string, unknown>)[key]).toEqual(value)
      }
    }
  })

  it.each([0, 1000, 43750, 92578.125, 200000])(
    'inverts commission gross for %s',
    (gross) => {
      expect(compGross(salesNeededForGross(gross, fixture.plan), fixture.plan)).toBeCloseTo(gross, 2)
    },
  )
})
