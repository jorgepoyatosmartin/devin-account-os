import { describe, expect, it } from 'vitest'
import { buildToday, buildTodayPgScoreTargetActions, type TodayData } from './today'

const today = '2026-10-12'

describe('buildToday', () => {
  it('lists overdue tasks and open opportunities with a past close date', () => {
    const data: TodayData = {
      opportunities: [{ id: 'opp-past', accountId: 'account-a', status: 'open', amount: 100, closeDate: '2026-10-10' }],
      tasks: [{ id: 'task-late', title: 'Send proposal', accountId: 'account-a', opportunityId: 'opp-past', due: '2026-10-11', status: 'Open' }],
      stakeholders: [],
      signals: [],
      pg: [],
    }

    expect(buildToday(data, today).map((item) => item.kind)).toEqual([
      'overdue-next-step',
      'overdue-close-date',
    ])
  })

  it('lists open opportunities missing amount or close date', () => {
    const data: TodayData = {
      opportunities: [
        { id: 'opp-no-amount', accountId: 'account-a', status: 'open', amount: null, closeDate: '2026-12-01' },
        { id: 'opp-no-date', accountId: 'account-b', status: 'open', amount: 100, closeDate: null },
        { id: 'opp-complete', accountId: 'account-a', status: 'open', amount: 100, closeDate: '2026-12-01' },
      ],
      tasks: [],
      stakeholders: [],
      signals: [],
      pg: [],
    }

    expect(buildToday(data, today).filter((item) => item.kind === 'missing-prp-data').map((item) => item.id)).toEqual([
      'missing-prp:opp-no-amount',
      'missing-prp:opp-no-date',
    ])
  })

  it('includes high-score PG targets and hypotheses only when untouched', () => {
    const data: TodayData = {
      opportunities: [], tasks: [], stakeholders: [], signals: [],
      pg: [
        { id: 'target-a', accountId: 'account-a', signalIds: ['signal-high'], status: 'TARGET', touches: [] },
        { id: 'target-touched', accountId: 'account-a', signalIds: ['signal-high'], status: 'TARGET', touches: [{ date: today }] },
      ],
      hypotheses: [{ id: 'hyp-a', accountId: 'account-b', signalIds: ['signal-high'], status: 'validated' }],
      signalScores: [{ id: 'signal-high', score: 75 }],
    }
    expect(buildTodayPgScoreTargetActions(data).map((action) => action.id)).toEqual([
      'pg-score:target-a',
      'pg-score-hypothesis:hyp-a',
    ])
  })

  it('lists champions and economic buyers without a touch in the last 30 days', () => {
    const data: TodayData = {
      opportunities: [],
      tasks: [],
      stakeholders: [
        { id: 'champion-stale', accountId: 'account-a', name: 'Champion', relationshipStatus: 'Champion', buyingRole: 'Champion', lastTouch: '2026-09-01' },
        { id: 'buyer-stale', accountId: 'account-a', name: 'Buyer', relationshipStatus: 'Engaged', buyingRole: 'Economic Buyer', lastTouch: null },
        { id: 'champion-recent', accountId: 'account-a', name: 'Recent', relationshipStatus: 'Champion', buyingRole: 'Champion', lastTouch: '2026-10-01' },
      ],
      signals: [],
      pg: [],
    }

    expect(buildToday(data, today).map((item) => item.id)).toEqual([
      'stale-touch:champion-stale',
      'stale-touch:buyer-stale',
    ])
  })

  it('lists recent signals not linked to an active PG target', () => {
    const data: TodayData = {
      opportunities: [],
      tasks: [],
      stakeholders: [],
      signals: [
        { id: 'signal-recent', accountId: 'account-a', date: '2026-10-02', signal: 'Recent' },
        { id: 'signal-linked', accountId: 'account-a', date: '2026-10-02', signal: 'Linked' },
        { id: 'signal-old', accountId: 'account-a', date: '2026-09-20', signal: 'Old' },
      ],
      pg: [{ id: 'target-a', accountId: 'account-a', signalIds: ['signal-linked'], status: 'TARGET' }],
    }

    expect(buildToday(data, today).map((item) => item.id)).toEqual(['unlinked-signal:signal-recent'])
  })
})
