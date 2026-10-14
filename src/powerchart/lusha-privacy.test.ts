import { describe, expect, it } from 'vitest'
import { planStakeholderImport } from '../import/dedupe'
import { getImportPreset } from '../import/providers'
import type { Stakeholder } from './model'
import { buildRepoSavePrompt } from './repoSave'
import { toYamlRecord } from './yaml'

describe('Lusha enrichment privacy', () => {
  it('keeps enriched email and phone out of the public YAML record', () => {
    const person: Stakeholder = {
      id: 'synthetic-ada',
      name: 'Ada Example',
      title: '',
      level: '3rd',
      unit: '',
      businessUnit: '',
      country: null,
      responsibilities: '',
      priorities: '',
      salesPlay: 'Unassigned',
      role: 'None',
      attitude: 'unknown',
      influence: 1,
      status: 'No contact',
      owner: '',
      lastTouch: null,
      reportsTo: null,
      reportsToConfidence: 'hypothesis',
      influences: [],
      notes: '',
    }
    const plan = planStakeholderImport([{
      'Full Name': person.name,
      'Job Title': 'Synthetic Director',
      Email: 'ada@example.invalid',
      Phone: '+10000000000',
      'LinkedIn URL': 'https://linkedin.com/in/synthetic-ada',
      Country: 'ZZ',
    }], getImportPreset('lusha', 'stakeholders'), 'synthetic', [person])
    const enriched = { ...person, ...plan.updates[0].patch }
    const record = toYamlRecord(enriched)
    expect(enriched.email).toBe('ada@example.invalid')
    expect(enriched.phone).toBe('+10000000000')
    expect(record).not.toHaveProperty('email')
    expect(record).not.toHaveProperty('phone')
    expect(JSON.stringify(record)).not.toContain('ada@example.invalid')
    expect(JSON.stringify(record)).not.toContain('+10000000000')
    const prompt = buildRepoSavePrompt('synthetic', [enriched], 'synthetic enrichment')
    expect(prompt).not.toContain('ada@example.invalid')
    expect(prompt).not.toContain('+10000000000')
  })
})
