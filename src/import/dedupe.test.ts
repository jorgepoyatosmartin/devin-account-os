import { describe, expect, it } from 'vitest'
import type { Account, OpportunityV2 } from '../types'
import { toYamlRecord } from '../powerchart/yaml'
import { buildRepoSavePrompt } from '../powerchart/repoSave'
import type { Stakeholder } from '../powerchart/model'
import {
  normalizeLinkedInUrl,
  parseImportAmount,
  parseImportDate,
  planOpportunityImport,
  planStakeholderImport,
} from './dedupe'
import { getImportPreset } from './providers'

const basePerson: Stakeholder = {
  id: 'mapfre-ana',
  name: 'Ana García',
  title: '',
  level: '3rd',
  unit: '',
  businessUnit: '',
  country: null,
  responsibilities: '',
  priorities: '',
  salesPlay: 'Agentic Readiness',
  role: 'Champion',
  attitude: 'positive',
  influence: 3,
  status: 'In process',
  owner: '',
  lastTouch: null,
  reportsTo: null,
  reportsToConfidence: 'confirmed',
  influences: [],
  notes: '',
}

const lusha = getImportPreset('lusha', 'stakeholders')

describe('planStakeholderImport', () => {
  it('matches by normalized email before other identifiers', () => {
    const existing = [{ ...basePerson, email: 'ANA@EXAMPLE.TEST', linkedinUrl: 'linkedin.com/in/other' }]
    const result = planStakeholderImport([{
      'First Name': 'Ana',
      'Last Name': 'Garcia',
      Email: 'ana@example.test',
      'LinkedIn URL': 'https://www.linkedin.com/in/other/',
      'Job Title': 'VP',
      Country: 'ES',
    }], lusha, 'mapfre', existing)
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0]).toMatchObject({ id: 'mapfre-ana', patch: { title: 'VP', country: 'ES' } })
    expect(result.updates[0].patch.role).toBeUndefined()
    expect(result.creates).toHaveLength(0)
  })

  it('matches by normalized LinkedIn URL when email does not match', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/ana-garcia/?trk=old')).toBe('linkedin.com/in/ana-garcia')
    const existing = [{ ...basePerson, email: 'old@example.test', linkedinUrl: 'https://www.linkedin.com/in/ana-garcia/?trk=old' }]
    const result = planStakeholderImport([{
      'Full Name': 'Another Name',
      Email: 'new@example.test',
      'LinkedIn URL': 'linkedin.com/in/ana-garcia',
    }], lusha, 'mapfre', existing)
    expect(result.updates[0]?.id).toBe('mapfre-ana')
    expect(result.creates).toHaveLength(0)
  })

  it('matches names without accents and collapsed spaces', () => {
    const result = planStakeholderImport([{
      'Full Name': '  Ana   Garcia ',
      'Job Title': 'Director',
    }], lusha, 'mapfre', [basePerson])
    expect(result.updates[0]?.id).toBe('mapfre-ana')
    expect(result.updates[0]?.patch.title).toBe('Director')
  })

  it('collapses within-file duplicates and creates a unique local contact record', () => {
    const result = planStakeholderImport([
      { 'Full Name': 'Zoë New', Email: 'zoe@example.test', 'Job Title': 'Director' },
      { 'Full Name': 'Zoe New', Email: 'zoe@example.test', Phone: '+1-555-0100' },
    ], lusha, 'mapfre', [{ ...basePerson, id: 'mapfre-zoe-new' }])
    expect(result.creates).toHaveLength(1)
    expect(result.creates[0]).toMatchObject({
      id: 'mapfre-zoe-new-2',
      source: 'import',
      salesPlay: 'Unassigned',
      status: 'No contact',
      reportsTo: null,
      email: 'zoe@example.test',
      phone: '+1-555-0100',
    })
    expect(result.skipped[0]?.reason).toContain('Duplicado')
  })

  it('only appends a note for a departed match without reactivating it', () => {
    const departed = { ...basePerson, email: 'ana@example.test', departed: true, status: 'No contact' as const }
    const result = planStakeholderImport([{
      'Full Name': 'Ana García',
      Email: 'ana@example.test',
      'Job Title': 'New Title',
    }], lusha, 'mapfre', [departed])
    expect(Object.keys(result.updates[0]?.patch ?? {})).toEqual(['notes'])
    expect(result.updates[0]?.patch.status).toBeUndefined()
    expect(result.updates[0]?.patch.title).toBeUndefined()
  })
})

describe('opportunity import parsing', () => {
  it.each([
    ['1.234,56', 'EUR', { amount: 1234.56, currency: 'EUR' }],
    ['1,234.56', 'USD', { amount: 1234.56, currency: 'USD' }],
    ['€ 1.234,56', '', { amount: 1234.56, currency: 'EUR' }],
    ['$1,234.56', '', { amount: 1234.56, currency: 'USD' }],
  ])('parses amount %s', (raw, currency, expected) => {
    expect(parseImportAmount(raw, currency)).toEqual(expected)
  })

  it('parses ISO and unambiguous dates but rejects ambiguous dates', () => {
    expect(parseImportDate('2026-04-13')).toEqual({ date: '2026-04-13' })
    expect(parseImportDate('13/04/2026')).toEqual({ date: '2026-04-13' })
    expect(parseImportDate('04/13/2026')).toEqual({ date: '2026-04-13' })
    expect(parseImportDate('03/04/2026').reason).toContain('ambigua')
  })

  it('keeps an unknown stage and returns a warning', () => {
    const opportunity = {
      id: 'opp-1',
      accountId: 'mapfre',
      name: 'Modernization',
      amount: null,
      currency: 'EUR',
      closeDate: null,
      stageId: '1-disco-scheduled',
      forecastCategory: 'Pipeline',
    } as OpportunityV2
    const result = planOpportunityImport([{
      'Opportunity ID': 'opp-1',
      Amount: '1.234,56',
      Currency: 'EUR',
      Stage: 'Unknown stage',
    }], getImportPreset('crm-opps', 'opportunities'), [opportunity], [])
    expect(result.updates[0]?.patch).toMatchObject({ amount: 1234.56 })
    expect(result.updates[0]?.patch.stageId).toBeUndefined()
    expect(result.warnings[0]?.reason).toContain('Etapa desconocida')
  })

  it('matches opportunities by normalized name and account when ID is absent', () => {
    const opportunity = {
      id: 'opp-1',
      accountId: 'mapfre',
      name: 'Modernization',
      amount: null,
      currency: 'EUR',
      closeDate: null,
      stageId: '1-disco-scheduled',
      forecastCategory: 'Pipeline',
    } as OpportunityV2
    const result = planOpportunityImport([{
      'Opportunity Name': '  MODERNIZATION ',
      Account: 'MAPFRÉ',
      Amount: '€ 1.234,56',
    }], getImportPreset('crm-opps', 'opportunities'), [opportunity], [
      { id: 'mapfre', name: 'Mapfré' } as Account,
    ])
    expect(result.updates[0]).toMatchObject({ id: 'opp-1', patch: { amount: 1234.56 } })
  })

  it('skips ambiguous opportunity dates and unmatched opportunities', () => {
    const opportunity = {
      id: 'opp-1',
      accountId: 'mapfre',
      name: 'Modernization',
      amount: null,
      currency: 'EUR',
      closeDate: null,
      stageId: '1-disco-scheduled',
      forecastCategory: 'Pipeline',
    } as OpportunityV2
    const result = planOpportunityImport([
      { 'Opportunity ID': 'opp-1', 'Close Date': '03/04/2026' },
      { 'Opportunity Name': 'Missing', Account: 'MAPFRE' },
    ], getImportPreset('crm-opps', 'opportunities'), [opportunity], [])
    expect(result.skipped.map(({ reason }) => reason)).toEqual([
      'Fecha ambigua; usa YYYY-MM-DD.',
      'Sin oportunidad coincidente.',
    ])
  })

  it('keeps contact fields out of repository YAML and prompt output', () => {
    const person: Stakeholder = { ...basePerson, email: 'private@example.test', phone: '+1-555-0199' }
    expect(toYamlRecord(person)).not.toHaveProperty('email')
    expect(toYamlRecord(person)).not.toHaveProperty('phone')
    const prompt = buildRepoSavePrompt('mapfre', [person], 'synthetic update')
    expect(prompt).not.toContain(person.email)
    expect(prompt).not.toContain(person.phone)
    expect(prompt).not.toContain('email:')
    expect(prompt).not.toContain('phone:')
  })
})
