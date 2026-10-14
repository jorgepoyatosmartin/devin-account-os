import { load as yamlLoad } from 'js-yaml'
import accountsJson from '../data/accounts.json'
import type { Account } from '../types'
import type { Attitude, Role, SalesPlay, Stakeholder as ChartStakeholder } from '../powerchart/model'

type AccountYaml = Partial<Account> & { country?: string | null }
export type TerritoryPlan = {
  tier: string | null
  potentialEur: number | null
  effortPct: number | null
  effortReason: string
  segment: string | null
  priority: number | null
  rationale: string
  evidence: string[]
}
type StakeholderYaml = {
  id: string
  name: string
  title: string
  level: ChartStakeholder['level']
  unit: string
  business_unit?: string
  country?: string | null
  responsibilities?: string
  priorities?: string
  sales_play?: SalesPlay
  role: Role
  attitude: Attitude
  influence: ChartStakeholder['influence']
  status: ChartStakeholder['status']
  owner?: string
  last_touch?: string | null
  reports_to?: string | null
  reports_to_confidence?: ChartStakeholder['reportsToConfidence']
  influences?: string[]
  notes?: string
  source?: 'research' | 'account-plan' | 'import'
  departed?: boolean
}
type StakeholderDocument = { account?: string; stakeholders?: StakeholderYaml[] }
type AccountFiles = Record<string, string>
export type AccountPartner = {
  id: string
  name: string
  type: 'SI' | 'hyperscaler' | 'reseller' | 'ISV' | 'other'
  relationship: string
  projects: string[]
  doorOpenerStakeholderId?: string | null
  notes: string
  source: string
  verifiedAt: string | null
}
type PartnerDocument = { partners?: AccountPartner[] }
export type RegisteredAccount = {
  account: Account
  territory: TerritoryPlan
  stakeholders: ChartStakeholder[]
  partners: AccountPartner[]
  stakeholdersYaml: string
  sourceVersion: string
}

export const accountYamlFiles = import.meta.glob('/accounts/*/account.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as AccountFiles
export const stakeholderYamlFiles = import.meta.glob('/accounts/*/stakeholders.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as AccountFiles
export const territoryYamlFiles = import.meta.glob('/accounts/*/territory.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as AccountFiles
export const partnerYamlFiles = import.meta.glob('/accounts/*/partners.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as AccountFiles

function accountIdFromPath(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 2] ?? ''
}

function hashRaw(raw: string): string {
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) | 0
  return hash.toString(16)
}

function emptyAccount(id: string, yaml: AccountYaml): Account {
  return {
    id,
    name: yaml.name ?? id,
    sector: yaml.sector ?? '',
    headquarters: yaml.headquarters ?? '',
    overview: '',
    revenue: '',
    employees: '',
    geographicFootprint: '',
    businessUnits: yaml.businessUnits ?? [],
    productsServices: [],
    strategicPriorities: [],
    financialPerformance: '',
    growthPriorities: [],
    costRestructuringInitiatives: [],
    mnaActivity: [],
    companyEvidence: [],
    initiatives: [],
    useCases: [],
    whitespace: [],
    country: yaml.country ?? null,
  } as Account
}

function parseTerritory(raw?: string): TerritoryPlan {
  const source = raw ? (yamlLoad(raw) as Partial<TerritoryPlan>) : {}
  return {
    tier: source.tier ?? null,
    potentialEur: source.potentialEur ?? null,
    effortPct: source.effortPct ?? null,
    effortReason: source.effortReason ?? '',
    segment: source.segment ?? null,
    priority: source.priority ?? null,
    rationale: source.rationale ?? '',
    evidence: source.evidence ?? [],
  }
}

export function buildAccountRegistry(
  legacyAccounts: Account[],
  accountFiles: AccountFiles,
  stakeholderFiles: AccountFiles,
  territoryFiles: AccountFiles = {},
  partnerFiles: AccountFiles = {},
): RegisteredAccount[] {
  const accountDocs = new Map<string, AccountYaml>()
  const stakeholderDocs = new Map<string, { raw: string; document: StakeholderDocument }>()
  const territoryDocs = new Map<string, string>()
  const partnerDocs = new Map<string, string>()
  for (const [path, raw] of Object.entries(accountFiles)) {
    const id = accountIdFromPath(path)
    if (id !== '_template') accountDocs.set(id, (yamlLoad(raw) as AccountYaml) ?? {})
  }
  for (const [path, raw] of Object.entries(stakeholderFiles)) {
    const id = accountIdFromPath(path)
    if (id !== '_template') stakeholderDocs.set(id, { raw, document: (yamlLoad(raw) as StakeholderDocument) ?? {} })
  }
  for (const [path, raw] of Object.entries(territoryFiles)) {
    const id = accountIdFromPath(path)
    if (id !== '_template') territoryDocs.set(id, raw)
  }
  for (const [path, raw] of Object.entries(partnerFiles)) {
    const id = accountIdFromPath(path)
    if (id !== '_template') partnerDocs.set(id, raw)
  }

  const ids = new Set([
    ...legacyAccounts.map((account) => account.id),
    ...accountDocs.keys(),
    ...stakeholderDocs.keys(),
  ])
  const legacyById = new Map(legacyAccounts.map((account) => [account.id, account]))
  return [...ids].map((id) => {
    const base = legacyById.get(id) ?? emptyAccount(id, accountDocs.get(id) ?? {})
    const yaml = accountDocs.get(id) ?? {}
    const stakeholderFile = stakeholderDocs.get(id)
    const stakeholders = (stakeholderFile?.document.stakeholders ?? []).map((person) => ({
      id: person.id,
      name: person.name,
      title: person.title,
      level: person.level,
      unit: person.unit,
      businessUnit: person.business_unit ?? person.unit,
      country: person.country ?? null,
      responsibilities: person.responsibilities ?? '',
      priorities: person.priorities ?? '',
      salesPlay: person.sales_play ?? 'Agentic Readiness',
      role: person.role,
      attitude: person.attitude,
      influence: person.influence,
      status: person.status,
      owner: person.owner ?? '',
      lastTouch: person.last_touch ?? null,
      reportsTo: person.reports_to ?? null,
      reportsToConfidence: person.reports_to_confidence ?? 'hypothesis',
      influences: person.influences ?? [],
      notes: person.notes ?? '',
      external: person.source === 'research',
      source: person.source,
      departed: person.departed === true,
    }))
    const account = {
      ...base,
      ...yaml,
      id,
      businessUnits: yaml.businessUnits ?? base.businessUnits,
      country: yaml.country ?? (base as Account & { country?: string | null }).country ?? null,
    } as Account
    const territory = parseTerritory(territoryDocs.get(id))
    const partnerRaw = partnerDocs.get(id)
    const partners = partnerRaw ? (yamlLoad(partnerRaw) as PartnerDocument)?.partners ?? [] : []
    return {
      account: { ...account, territory } as Account,
      territory,
      stakeholders,
      partners,
      stakeholdersYaml: stakeholderFile?.raw ?? '',
      sourceVersion: stakeholderFile ? hashRaw(stakeholderFile.raw) : '',
    }
  })
}

export const registeredAccounts = buildAccountRegistry(
  accountsJson as Account[],
  accountYamlFiles,
  stakeholderYamlFiles,
  territoryYamlFiles,
  partnerYamlFiles,
)

export function getRegisteredAccount(accountId: string): RegisteredAccount | undefined {
  return registeredAccounts.find(({ account }) => account.id === accountId)
}
