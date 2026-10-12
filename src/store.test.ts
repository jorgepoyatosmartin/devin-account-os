import { describe, expect, it } from 'vitest'
import { dataset } from './data'
import {
  migrateOpportunitySnapshot,
  OPPORTUNITIES_V2_SNAPSHOT_VERSION,
} from './store'

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
    })
  })
})
