import { describe, expect, it } from 'vitest'
import type { Stakeholder as AppStakeholder } from '../types'
import { toAppStakeholder } from './bridge'
import type { Stakeholder as ChartStakeholder } from './model'

const chartPerson: ChartStakeholder = {
  id: 'synthetic-person',
  name: 'Synthetic Person',
  title: 'Synthetic title',
  level: 'C Level',
  unit: 'Synthetic',
  businessUnit: 'Synthetic',
  country: null,
  responsibilities: '',
  priorities: '',
  salesPlay: 'Unassigned',
  role: 'EB',
  attitude: 'neutral',
  influence: 2,
  status: 'In contact',
  owner: '',
  lastTouch: null,
  reportsTo: null,
  reportsToConfidence: 'confirmed',
  influences: [],
  notes: '',
  departed: true,
}

const legacyPerson = {
  id: chartPerson.id,
  accountId: 'synthetic-account',
  name: chartPerson.name,
  title: chartPerson.title,
  functionArea: 'Synthetic',
  responsibilities: ' UNKNOWN ',
  strategicPriorities: 'UnKnOwN',
  technologyPriorities: 'unknown',
  relevantInitiatives: [],
  publicStatements: [],
  recentActivity: '',
  potentialPain: 'UNKNOWN',
  cognitionRelevance: ' UNKNOWN ',
  relationshipStatus: 'Contacted',
  buyingRole: 'Economic Buyer',
  sources: [],
} as AppStakeholder

describe('Power Chart stakeholder bridge', () => {
  it('clears legacy UNKNOWN values and preserves YAML priorities and departed status', () => {
    const emptyYaml = toAppStakeholder(chartPerson, legacyPerson, 'synthetic-account')
    expect(emptyYaml.responsibilities).toBe('')
    expect(emptyYaml.strategicPriorities).toBe('')
    expect(emptyYaml.technologyPriorities).toBe('')
    expect(emptyYaml.potentialPain).toBe('')
    expect(emptyYaml.cognitionRelevance).toBe('')
    expect(emptyYaml.departed).toBe(true)

    const sourcedYaml = toAppStakeholder({ ...chartPerson, priorities: 'YAML strategic priority' }, legacyPerson, 'synthetic-account')
    expect(sourcedYaml.strategicPriorities).toBe('YAML strategic priority')
  })
})
