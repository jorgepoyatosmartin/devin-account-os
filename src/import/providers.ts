import type { EnrichmentPersonRef, EnrichmentProvider } from '../types'
import { parseCsv } from './csv'

export type ImportKind = 'stakeholders' | 'opportunities'
export type ImportTargetField =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'title'
  | 'companyName'
  | 'email'
  | 'phone'
  | 'linkedinUrl'
  | 'location'
  | 'country'
  | 'department'
  | 'opportunityId'
  | 'opportunityName'
  | 'account'
  | 'amount'
  | 'currency'
  | 'closeDate'
  | 'stage'
  | 'forecastCategory'

export interface ImportPreset {
  id: 'lusha' | 'salesnav' | 'crm-opps' | 'generic'
  kind: ImportKind
  columns: Partial<Record<ImportTargetField, string[]>>
}

const stakeholderGenericColumns: ImportPreset['columns'] = {
  firstName: ['first name', 'firstname'],
  lastName: ['last name', 'lastname', 'surname'],
  fullName: ['full name', 'name', 'contact name'],
  title: ['job title', 'title', 'position'],
  companyName: ['company name', 'company', 'account'],
  email: ['email', 'work email', 'email address'],
  phone: ['phone', 'phone number', 'mobile'],
  linkedinUrl: ['linkedin url', 'linkedin', 'profile url'],
  location: ['location', 'geography', 'city'],
  country: ['country'],
  department: ['department', 'function'],
}

const opportunityGenericColumns: ImportPreset['columns'] = {
  opportunityId: ['opportunity id', 'id', 'opportunityid'],
  opportunityName: ['opportunity name', 'name', 'opportunity'],
  account: ['account', 'account name', 'company'],
  amount: ['amount', 'value', 'opportunity amount'],
  currency: ['currency'],
  closeDate: ['close date', 'closedate', 'expected close date'],
  stage: ['stage', 'sales stage'],
  forecastCategory: ['forecast category', 'forecast'],
}

export const IMPORT_PRESETS: ImportPreset[] = [
  {
    id: 'lusha',
    kind: 'stakeholders',
    columns: {
      ...stakeholderGenericColumns,
      firstName: ['first name'],
      lastName: ['last name'],
      fullName: ['full name'],
      title: ['job title'],
      companyName: ['company name'],
      email: ['email', 'work email'],
      linkedinUrl: ['linkedin url'],
      location: ['location'],
      country: ['country'],
      department: ['department'],
    },
  },
  {
    id: 'salesnav',
    kind: 'stakeholders',
    columns: {
      ...stakeholderGenericColumns,
      firstName: ['first name'],
      lastName: ['last name'],
      title: ['title'],
      companyName: ['company'],
      linkedinUrl: ['linkedin url', 'profile url'],
      location: ['geography'],
    },
  },
  {
    id: 'crm-opps',
    kind: 'opportunities',
    columns: {
      ...opportunityGenericColumns,
      opportunityId: ['opportunity id'],
      opportunityName: ['opportunity name'],
      account: ['account'],
      amount: ['amount'],
      currency: ['currency'],
      closeDate: ['close date'],
      stage: ['stage'],
      forecastCategory: ['forecast category'],
    },
  },
  { id: 'generic', kind: 'stakeholders', columns: stakeholderGenericColumns },
  { id: 'generic', kind: 'opportunities', columns: opportunityGenericColumns },
]

export function normalizeImportHeader(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function getImportPreset(id: ImportPreset['id'], kind: ImportKind): ImportPreset {
  return IMPORT_PRESETS.find((preset) => preset.id === id && preset.kind === kind) ?? IMPORT_PRESETS.find((preset) => preset.kind === kind && preset.id === 'generic')!
}

export function mapCsvRow(row: Record<string, string>, preset: ImportPreset): Partial<Record<ImportTargetField, string>> {
  const headers = new Map(Object.keys(row).map((header) => [normalizeImportHeader(header), row[header]]))
  return Object.fromEntries(Object.entries(preset.columns).flatMap(([target, aliases]) => {
    const value = aliases?.map((alias) => headers.get(normalizeImportHeader(alias))).find((candidate) => candidate !== undefined)
    return value === undefined ? [] : [[target, value]]
  })) as Partial<Record<ImportTargetField, string>>
}

export class CsvImportProvider implements EnrichmentProvider {
  private readonly people: EnrichmentPersonRef[]

  constructor(text: string, preset: ImportPreset, accountId: string) {
    const { rows } = parseCsv(text)
    this.people = rows.map((row, index) => {
      const fields = mapCsvRow(row, preset)
      const name = fields.fullName?.trim() || [fields.firstName, fields.lastName].filter(Boolean).join(' ').trim()
      return {
        id: `csv-${index + 1}`,
        accountId,
        name,
        title: fields.title?.trim() ?? '',
        companyName: fields.companyName?.trim() ?? '',
        email: fields.email?.trim() ?? '',
        phone: fields.phone?.trim() ?? '',
        linkedinUrl: fields.linkedinUrl?.trim() ?? '',
        location: fields.location?.trim() ?? fields.country?.trim() ?? '',
        department: fields.department?.trim() ?? '',
      }
    }).filter((person) => person.name)
  }

  findPeople(accountId: string, query: string): EnrichmentPersonRef[] {
    const needle = normalizeImportHeader(query)
    return this.people.filter((person) => (
      person.accountId === accountId
      && (!needle || normalizeImportHeader(`${person.name} ${person.title} ${person.companyName}`).includes(needle))
    ))
  }

  enrich(personRef: EnrichmentPersonRef): EnrichmentPersonRef | null {
    return this.people.find((person) => person.id === personRef.id && person.accountId === personRef.accountId) ?? null
  }
}
