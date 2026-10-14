import { describe, expect, it } from 'vitest'
import type { TerritoryEffortConfig } from '../config'
import type { Hypothesis, MeetingNote, PgRecord, Stakeholder } from '../types'
import { actualEffort, coverageFor, effortSum, suggestEffort } from './territoryEffort'

const cfg: TerritoryEffortConfig = {
  tierWeights: { '1': 1, A: 1, '2': 0.6, B: 0.6, '3': 0.3, C: 0.3 },
  defaultTierWeight: 0.5,
  activityWindowDays: 90,
  activityWeights: { touch: 1, meeting: 3 },
  deviationThresholdPp: 10,
  keyRoles: ['Economic Buyer', 'Champion', 'Coach', 'Influencer'],
}

function person(overrides: Partial<Stakeholder> = {}): Stakeholder {
  return {
    id: 'synthetic-person',
    accountId: 'synthetic-account',
    name: 'Synthetic Person',
    title: '',
    functionArea: '',
    responsibilities: '',
    strategicPriorities: '',
    technologyPriorities: '',
    relevantInitiatives: [],
    publicStatements: [],
    recentActivity: '',
    potentialPain: '',
    cognitionRelevance: '',
    relationshipStatus: 'No contact',
    buyingRole: 'Unknown',
    sources: [],
    ...overrides,
  }
}

describe('territory effort', () => {
  it('allocates integer percentages by largest remainder and weighted tier', () => {
    const result = suggestEffort([
      { accountId: 'tier-1', tier: ' 1 ', potentialEur: 1000, pipelineEur: 0 },
      { accountId: 'tier-2', tier: 'b', potentialEur: 1000, pipelineEur: 0 },
      { accountId: 'tier-3', tier: 'C', potentialEur: 1000, pipelineEur: 0 },
    ], cfg)
    expect(Object.values(result).reduce<number>((sum, value) => sum + (value ?? 0), 0)).toBe(100)
    expect(result['tier-1']).toBeGreaterThan(result['tier-2']!)
    expect(result['tier-2']).toBeGreaterThan(result['tier-3']!)
  })

  it('assigns no score to whitespace at or below zero', () => {
    expect(suggestEffort([
      { accountId: 'covered', tier: '1', potentialEur: 100, pipelineEur: 150 },
    ], cfg)).toEqual({ covered: null })
  })

  it('excludes null potential and returns null when all scores are zero', () => {
    expect(suggestEffort([
      { accountId: 'unknown', tier: '1', potentialEur: null, pipelineEur: 0 },
      { accountId: 'full', tier: '1', potentialEur: 100, pipelineEur: 100 },
    ], cfg)).toEqual({ unknown: null, full: null })
  })

  it('counts recent touches and weights meeting channels and notes three times', () => {
    const pg = [{
      accountId: 'a',
      touches: [
        { date: '2024-12-31', channel: 'call', outcome: 'old' },
        { date: 'not-a-date', channel: 'call', outcome: 'invalid' },
        { date: '2025-03-01', channel: 'call', outcome: 'touch' },
        { date: '2025-03-02', channel: 'meeting', outcome: 'meeting' },
      ],
    }] as PgRecord[]
    const boundaryTouches = [{
      accountId: 'c',
      touches: [
        { date: '2025-01-01', channel: 'call', outcome: 'start boundary' },
        { date: '2025-04-01', channel: 'event', outcome: 'today boundary' },
      ],
    }] as PgRecord[]
    const hypotheses = [{
      accountId: 'b',
      touches: [{ date: '2025-03-03', channel: 'meeting', outcome: 'meeting' }],
    }] as Hypothesis[]
    const meetingNotes = [
      { accountId: 'b', date: '2025-03-04' },
      { accountId: 'c', date: 'invalid' },
    ] as MeetingNote[]

    expect(actualEffort(['a', 'b', 'c', 'd'], { pg: [...pg, ...boundaryTouches], hypotheses, meetingNotes }, '2025-04-01', cfg)).toEqual({
      units: { a: 4, b: 6, c: 2, d: 0 },
      pct: { a: 33, b: 50, c: 17, d: null },
    })
  })

  it('returns null percentages when no activities fall in the window', () => {
    expect(actualEffort(['a'], { pg: [], hypotheses: [], meetingNotes: [] }, '2025-04-01', cfg))
      .toEqual({ units: { a: 0 }, pct: { a: null } })
  })

  it('validates manual effort totals', () => {
    expect(effortSum({ a: null, b: null })).toEqual({ sum: 0, anySet: false, ok: true })
    expect(effortSum({ a: 60, b: 30 })).toEqual({ sum: 90, anySet: true, ok: false })
    expect(effortSum({ a: 100, b: null })).toEqual({ sum: 100, anySet: true, ok: true })
  })

  it('excludes departed stakeholders from active coverage and key roles', () => {
    const result = coverageFor([
      person({ id: 'contacted-champion', relationshipStatus: 'Champion', powerRole: 'Champion' }),
      person({ id: 'no-contact', relationshipStatus: 'No contact', powerRole: 'Economic Buyer' }),
      person({ id: 'departed-eb', departed: true, relationshipStatus: 'Contacted', powerRole: 'Economic Buyer' }),
    ], cfg)
    expect(result).toEqual({
      active: 2,
      departed: 1,
      contacted: 1,
      coveragePct: 50,
      keyRolesCovered: ['Champion'],
      keyRolesMissing: ['Economic Buyer', 'Coach', 'Influencer'],
    })
  })

  it('does not count a departed contacted Economic Buyer as coverage', () => {
    const result = coverageFor([
      person({ id: 'departed-eb', departed: true, relationshipStatus: 'Contacted', powerRole: 'Economic Buyer' }),
    ], cfg)
    expect(result.active).toBe(0)
    expect(result.coveragePct).toBe(0)
    expect(result.keyRolesMissing).toContain('Economic Buyer')
  })
})
