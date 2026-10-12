import synthetic from './__fixtures__/synthetic.json'
import { compGross, prp } from './engine'
import { commissionByOpportunity } from './commission'
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

function makeOpportunity(
  id: string,
  amount: number,
  status: OpportunityV2['status'],
  closeDate: string,
  commissionType: OpportunityV2['commissionType'] = 'new',
  countsForQuota = true,
): OpportunityV2 {
  return {
    ...opportunities[0],
    id,
    amount,
    currency: 'EUR',
    status,
    closeDate,
    commissionType,
    countsForQuota,
  }
}

describe('commissionByOpportunity', () => {
  it('attributes closed new-business commission to deals by close date and matches PRP', () => {
    const rows = commissionByOpportunity(opportunities, fixture.plan)
    const newWonGross = rows
      .filter((row) => row.status === 'won' && opportunities.find((opportunity) => opportunity.id === row.oppId)?.commissionType !== 'renewal')
      .reduce((sum, row) => sum + row.commissionGross, 0)
    const result = prp(opportunities, fixture.plan, fixture.stageProbabilities, fixture.expected.today)
    const renewalGross = result.renewalClosed * fixture.plan.renewalRate

    expect(newWonGross).toBeCloseTo(result.commissionGrossClosed - renewalGross, 2)
  })

  it('blends the effective rate for a deal that crosses a tier boundary', () => {
    const deals = [
      makeOpportunity('closed-first', 200000, 'won', '2027-02-01'),
      makeOpportunity('closed-crossing', 100000, 'won', '2027-03-01'),
    ]
    const crossing = commissionByOpportunity(deals, fixture.plan).find((row) => row.oppId === 'closed-crossing')!

    expect(crossing.commissionGross).toBeCloseTo(
      compGross(300000, fixture.plan) - compGross(200000, fixture.plan),
      2,
    )
    expect(crossing.effectiveRate).toBeCloseTo(crossing.commissionGross / 100000, 5)
    expect(crossing.effectiveRate).toBeGreaterThan(fixture.plan.tiers[0].rate)
  })

  it('calculates renewals and gives no quota commission to excluded new-business deals', () => {
    const deals = [
      makeOpportunity('renewal', 10000, 'won', '2027-04-01', 'renewal', false),
      makeOpportunity('excluded', 10000, 'won', '2027-04-02', 'new', false),
    ]
    const rows = commissionByOpportunity(deals, fixture.plan)

    expect(rows.find((row) => row.oppId === 'renewal')).toMatchObject({
      quotaCredit: 0,
      commissionGross: 10000 * fixture.plan.renewalRate,
    })
    expect(rows.find((row) => row.oppId === 'excluded')).toMatchObject({
      quotaCredit: 0,
      commissionGross: 0,
      commissionNet: 0,
    })
  })

  it('estimates open commission marginally over total closed new-business sales', () => {
    const deals = [
      makeOpportunity('closed', 100000, 'won', '2027-02-01'),
      makeOpportunity('open', 200000, 'open', '2027-04-01'),
    ]
    const open = commissionByOpportunity(deals, fixture.plan).find((row) => row.oppId === 'open')!

    expect(open.commissionGross).toBeCloseTo(
      compGross(300000, fixture.plan) - compGross(100000, fixture.plan),
      2,
    )
    expect(open.commissionNet).toBeCloseTo(open.commissionGross * fixture.plan.taxFactor, 2)
  })
})
