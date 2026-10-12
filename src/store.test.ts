import { describe, expect, it, vi } from 'vitest'
import { dataset } from './data'
import {
  HYPOTHESES_KEY,
  migrateOpportunitySnapshot,
  OPPORTUNITIES_V2_SNAPSHOT_VERSION,
  persistHypothesisUpdate,
} from './store'
import type { Hypothesis } from './types'

describe('migrateOpportunitySnapshot', () => {
  it('migrates legacy and custom opportunities and overlays saved edits after a schema bump', () => {
    const customOpportunity = { ...dataset.opportunities[0], id: 'custom-opportunity' }
    const initial = migrateOpportunitySnapshot(
      dataset.opportunities,
      [customOpportunity],
      dataset.stakeholders,
      null,
    )
    const editedOpportunity = {
      ...initial.items[0],
      amount: 12345,
      closeDate: '2027-08-12',
      productIds: ['devin-cloud'],
      businessCase: {
        levers: [{ id: 'lever-a', label: 'Synthetic lever', formula: 'a × b', valueEur: 10, source: 'test', type: 'customer' as const }],
        notes: 'Business case note',
      },
      technicalValidation: {
        pocPlan: 'Synthetic POC',
        criteria: [{ id: 'criterion-a', criterion: 'Checks pass', owner: 'QA', result: 'pass' as const, evidence: 'test' }],
        acceptedAt: '2027-08-12',
      },
      decisionPlan: {
        steps: [{ id: 'step-a', step: 'Review', owner: 'EB', date: '2027-08-15', done: false }],
        partnerIds: ['partner-a'],
      },
    }
    const remigrated = migrateOpportunitySnapshot(
      dataset.opportunities,
      [customOpportunity],
      dataset.stakeholders,
      { version: OPPORTUNITIES_V2_SNAPSHOT_VERSION, items: [editedOpportunity] },
      OPPORTUNITIES_V2_SNAPSHOT_VERSION + 1,
    )

    expect(initial.items).toHaveLength(dataset.opportunities.length + 1)
    expect(remigrated.version).toBe(OPPORTUNITIES_V2_SNAPSHOT_VERSION + 1)
    expect(remigrated.items[0]).toMatchObject({
      id: editedOpportunity.id,
      amount: 12345,
      closeDate: '2027-08-12',
      productIds: ['devin-cloud'],
      businessCase: editedOpportunity.businessCase,
      technicalValidation: editedOpportunity.technicalValidation,
      decisionPlan: editedOpportunity.decisionPlan,
    })
  })
})

describe('persistHypothesisUpdate', () => {
  it('persists the converted status in the hypotheses store', () => {
    let storedValue = ''
    vi.stubGlobal('localStorage', { setItem: (_key: string, value: string) => { storedValue = value } })
    try {
      const hypothesis: Hypothesis = {
        id: 'hyp-store-test',
        accountId: 'acciona',
        title: 'Synthetic hypothesis',
        whyChange: '',
        whyNow: '',
        whyUs: '',
        valueEstimate: { amount: null, assumptions: '' },
        stakeholderIds: [],
        routeToMarket: 'direct',
        nextBestAction: '',
        status: 'converted',
        signalIds: [],
        source: 'test',
        verifiedAt: null,
        productIds: [],
      }
      const result = persistHypothesisUpdate([], hypothesis)

      expect(result).toEqual([hypothesis])
      expect(JSON.parse(storedValue)).toMatchObject([{ id: hypothesis.id, status: 'converted' }])
      expect(HYPOTHESES_KEY).toBe('cognition-pipeline-hypotheses')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
