import { describe, expect, it } from 'vitest'
import type { OpportunityV2, PgRecord } from '../types'
import { pgMetrics } from './metrics'

const records = [
  {
    id: 'pg-a',
    accountId: 'account-a',
    salesPlay: 'Developer Productivity',
    status: 'MEETING',
    opportunityId: 'opp-open',
    touches: [
      { date: '2027-01-01', channel: 'email', outcome: 'replied', response: 'positive' },
      { date: '2027-01-02', channel: 'meeting', outcome: 'held', response: 'neutral' },
    ],
  },
  {
    id: 'pg-b',
    accountId: 'account-a',
    salesPlay: 'Developer Productivity',
    status: 'TARGET',
    touches: [],
  },
] as unknown as PgRecord[]

const opportunities = [
  {
    id: 'opp-open',
    status: 'open',
    amount: 116,
    currency: 'USD',
    origin: { signalIds: [], pgId: 'pg-a' },
  },
  {
    id: 'opp-won',
    status: 'won',
    amount: 200,
    currency: 'EUR',
    origin: { signalIds: [], pgId: 'pg-b' },
  },
] as unknown as OpportunityV2[]

describe('pgMetrics', () => {
  it('aggregates target, touch, meeting and distinct opportunity metrics', () => {
    expect(pgMetrics(records, opportunities, 'account', 1.16)).toEqual([{
      key: 'account-a',
      targets: 2,
      touched: 1,
      touches: 2,
      responses: 2,
      positive: 1,
      meetings: 1,
      opportunities: 2,
      pipelineEur: 100,
      wonEur: 200,
    }])
  })

  it('attributes channel targets and opportunities to first touch (or no channel)', () => {
    const rows = pgMetrics(records, opportunities, 'channel', 1.16)
    expect(rows.find((row) => row.key === 'email')).toMatchObject({
      targets: 1,
      touched: 1,
      touches: 1,
      opportunities: 1,
      pipelineEur: 100,
    })
    expect(rows.find((row) => row.key === 'meeting')).toMatchObject({
      targets: 0,
      touched: 1,
      touches: 1,
      meetings: 1,
    })
    expect(rows.find((row) => row.key === 'none')).toMatchObject({
      targets: 1,
      touched: 0,
      opportunities: 1,
      wonEur: 200,
    })
  })
})
