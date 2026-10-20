import { stagesConfig } from '../config'
import type { OpportunityV2 } from '../types'
import type { Account } from '../types'
import type { Stakeholder as ChartStakeholder } from '../powerchart/model'
import { mapCsvRow, normalizeImportHeader, type ImportPreset } from './providers'

export type StakeholderImportPlan = {
  creates: ChartStakeholder[]
  updates: { id: string; patch: Partial<ChartStakeholder>; changedFields: string[] }[]
  skipped: { row: Record<string, string>; reason: string }[]
}

export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function normalizeEmail(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function normalizeLinkedInUrl(value: string | undefined): string {
  const input = (value ?? '').trim().toLowerCase()
  if (!input) return ''
  return input
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[?#]/, 1)[0]
    .replace(/\/+$/, '')
}

function matchingStakeholder(
  person: Pick<ChartStakeholder, 'name' | 'email' | 'linkedinUrl'>,
  people: ChartStakeholder[],
): ChartStakeholder | undefined {
  const email = normalizeEmail(person.email)
  if (email) {
    const match = people.find((candidate) => normalizeEmail(candidate.email) === email)
    if (match) return match
  }
  const linkedIn = normalizeLinkedInUrl(person.linkedinUrl)
  if (linkedIn) {
    const match = people.find((candidate) => normalizeLinkedInUrl(candidate.linkedinUrl) === linkedIn)
    if (match) return match
  }
  const name = normalizeName(person.name)
  return name ? people.find((candidate) => normalizeName(candidate.name) === name) : undefined
}

function slug(value: string): string {
  return normalizeName(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'person'
}

function appendNote(current: string, note: string): string {
  return current.includes(note) ? current : [current.trim(), note].filter(Boolean).join('\n')
}

function personPatch(existing: ChartStakeholder, incoming: Partial<ChartStakeholder>): Partial<ChartStakeholder> {
  const patch: Partial<ChartStakeholder> = {}
  const fillable: (keyof ChartStakeholder)[] = [
    'name', 'unit', 'businessUnit', 'email', 'phone', 'linkedinUrl', 'source',
  ]
  fillable.forEach((field) => {
    const value = incoming[field]
    const current = existing[field]
    if (typeof value === 'string' && value.trim() && (typeof current !== 'string' || !current.trim())) {
      ;(patch as Record<string, unknown>)[field] = value
    }
  })
  ;(['title', 'country'] as const).forEach((field) => {
    const value = incoming[field]
    if (value && value !== existing[field]) patch[field] = value
  })
  return patch
}

export function planStakeholderImport(
  rows: Record<string, string>[],
  preset: ImportPreset,
  accountId: string,
  existing: ChartStakeholder[],
): StakeholderImportPlan {
  const creates: ChartStakeholder[] = []
  const updates = new Map<string, Partial<ChartStakeholder>>()
  const skipped: StakeholderImportPlan['skipped'] = []
  const ids = new Set(existing.map((person) => person.id))
  const matchedInFile = new Set<string>()

  rows.forEach((row) => {
    const fields = mapCsvRow(row, preset)
    const name = fields.fullName?.trim() || [fields.firstName, fields.lastName].filter(Boolean).join(' ').trim()
    if (!name) {
      skipped.push({ row, reason: 'Falta el nombre.' })
      return
    }
    const incoming: Partial<ChartStakeholder> = {
      name,
      title: fields.title?.trim() ?? '',
      unit: fields.department?.trim() ?? '',
      businessUnit: fields.department?.trim() ?? '',
      country: fields.country?.trim() || fields.location?.trim() || null,
      email: fields.email?.trim() ?? '',
      phone: fields.phone?.trim() ?? '',
      linkedinUrl: fields.linkedinUrl?.trim() ?? '',
      source: 'import',
    }
    const pool = [...existing, ...creates]
    const match = matchingStakeholder(incoming as Pick<ChartStakeholder, 'name' | 'email' | 'linkedinUrl'>, pool)
    if (!match) {
      const baseId = `${accountId}-${slug(name)}`
      let id = baseId
      let suffix = 2
      while (ids.has(id)) id = `${baseId}-${suffix++}`
      ids.add(id)
      creates.push({
        id,
        name,
        title: incoming.title ?? '',
        level: '4th',
        unit: incoming.unit ?? '',
        businessUnit: incoming.businessUnit ?? incoming.unit ?? '',
        country: incoming.country ?? null,
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
        source: 'import',
        email: incoming.email,
        phone: incoming.phone,
        linkedinUrl: incoming.linkedinUrl,
      })
      matchedInFile.add(id)
      return
    }

    const duplicate = matchedInFile.has(match.id)
    matchedInFile.add(match.id)
    if (match.departed) {
      const patch = { notes: appendNote(match.notes, `CSV import match (${name}); departed record retained.`) }
      if (creates.some((person) => person.id === match.id)) {
        const created = creates.find((person) => person.id === match.id)!
        created.notes = patch.notes
      } else {
        updates.set(match.id, { ...updates.get(match.id), ...patch })
      }
      if (duplicate) skipped.push({ row, reason: 'Duplicado en el archivo; consolidado con la coincidencia existente.' })
      return
    }

    const patch = personPatch(match, incoming)
    if (creates.some((person) => person.id === match.id)) {
      const created = creates.find((person) => person.id === match.id)!
      Object.assign(created, patch)
    } else if (Object.keys(patch).length) {
      updates.set(match.id, { ...updates.get(match.id), ...patch })
    }
    if (duplicate) skipped.push({ row, reason: 'Duplicado en el archivo; consolidado con la coincidencia existente.' })
    else if (!Object.keys(patch).length) skipped.push({ row, reason: 'Sin cambios.' })
  })

  return {
    creates,
    updates: [...updates].map(([id, patch]) => ({ id, patch, changedFields: Object.keys(patch) })),
    skipped,
  }
}

export type ParsedImportAmount = { amount: number; currency: 'EUR' | 'USD' }

function currencyFrom(rawCurrency: string, rawAmount: string, fallback: 'EUR' | 'USD'): 'EUR' | 'USD' | null {
  const currency = normalizeImportHeader(rawCurrency)
  if (/\$|usd|dollar/.test(currency)) return 'USD'
  if (/€|eur|euro/.test(currency)) return 'EUR'
  if (currency) return null
  if (rawAmount.includes('$')) return 'USD'
  if (rawAmount.includes('€')) return 'EUR'
  return fallback
}

function parseNumericAmount(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const negative = /^\(.*\)$/.test(trimmed)
  const value = trimmed.replace(/[^\d,.-]/g, '')
  if (!value || !/\d/.test(value)) return null
  const comma = value.lastIndexOf(',')
  const dot = value.lastIndexOf('.')
  let normalized = value
  if (comma !== -1 && dot !== -1) {
    const decimal = comma > dot ? ',' : '.'
    const grouping = decimal === ',' ? /\./g : /,/g
    normalized = value.replace(grouping, '').replace(decimal, '.')
  } else {
    const separator = comma !== -1 ? ',' : dot !== -1 ? '.' : ''
    if (separator) {
      const parts = value.split(separator)
      const trailing = parts[parts.length - 1]
      const allGroups = parts.slice(1).every((part) => part.length === 3)
      if (parts.length > 2 && allGroups || parts.length === 2 && trailing.length === 3) {
        normalized = parts.join('')
      } else {
        normalized = `${parts.slice(0, -1).join('')}.${trailing}`
      }
    }
  }
  const amount = Number(normalized)
  return Number.isFinite(amount) ? (negative ? -amount : amount) : null
}

export function parseImportAmount(
  raw: string,
  rawCurrency: string,
  fallbackCurrency: 'EUR' | 'USD' = 'EUR',
): ParsedImportAmount | null {
  const amount = parseNumericAmount(raw)
  const currency = currencyFrom(rawCurrency, raw, fallbackCurrency)
  return amount == null || !currency ? null : { amount, currency }
}

export type ParsedImportDate = { date: string | null; reason?: string }

function formatDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

export function parseImportDate(raw: string): ParsedImportDate {
  const value = raw.trim()
  if (!value) return { date: null }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value)
  if (iso) {
    const date = formatDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    return date ? { date } : { date: null, reason: 'Fecha ISO inválida.' }
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (!slash) return { date: null, reason: 'Formato de fecha no reconocido.' }
  const first = Number(slash[1])
  const second = Number(slash[2])
  const year = Number(slash[3])
  if (first <= 12 && second <= 12) return { date: null, reason: 'Fecha ambigua; usa YYYY-MM-DD.' }
  const month = first > 12 ? second : first
  const day = first > 12 ? first : second
  const date = formatDate(year, month, day)
  return date ? { date } : { date: null, reason: 'Fecha inválida.' }
}

export type OpportunityImportPlan = {
  updates: { id: string; patch: Partial<OpportunityV2>; changedFields: string[] }[]
  skipped: { row: Record<string, string>; reason: string }[]
  warnings: { row: Record<string, string>; reason: string }[]
}

function matchAccount(value: string, accounts: Account[]): Account | undefined {
  const key = normalizeName(value)
  return accounts.find((account) => normalizeName(account.id) === key || normalizeName(account.name) === key)
}

export function planOpportunityImport(
  rows: Record<string, string>[],
  preset: ImportPreset,
  opps: OpportunityV2[],
  accounts: Account[],
): OpportunityImportPlan {
  const updates = new Map<string, Partial<OpportunityV2>>()
  const skipped: OpportunityImportPlan['skipped'] = []
  const warnings: OpportunityImportPlan['warnings'] = []

  rows.forEach((row) => {
    const fields = mapCsvRow(row, preset)
    const id = fields.opportunityId?.trim()
    const name = fields.opportunityName?.trim()
    const account = fields.account?.trim()
    const accountMatch = account ? matchAccount(account, accounts) : undefined
    const opportunity = (id ? opps.find((item) => normalizeName(item.id) === normalizeName(id)) : undefined)
      ?? (name && accountMatch
        ? opps.find((item) => item.accountId === accountMatch.id && normalizeName(item.name) === normalizeName(name))
        : undefined)
    if (!opportunity) {
      skipped.push({ row, reason: 'Sin oportunidad coincidente.' })
      return
    }

    const patch: Partial<OpportunityV2> = {}
    const amountValue = fields.amount?.trim()
    const suppliedCurrency = fields.currency?.trim() ?? ''
    if (amountValue) {
      const amount = parseImportAmount(amountValue, suppliedCurrency, opportunity.currency)
      if (!amount) {
        skipped.push({ row, reason: 'Importe o moneda inválidos.' })
        return
      }
      if (amount.amount !== opportunity.amount) patch.amount = amount.amount
      if (amount.currency !== opportunity.currency) patch.currency = amount.currency
    } else if (suppliedCurrency) {
      const currency = currencyFrom(suppliedCurrency, '', opportunity.currency)
      if (!currency) {
        skipped.push({ row, reason: 'Moneda inválida.' })
        return
      }
      if (currency !== opportunity.currency) patch.currency = currency
    }

    const closeDateValue = fields.closeDate?.trim()
    if (closeDateValue) {
      const parsed = parseImportDate(closeDateValue)
      if (parsed.reason) {
        skipped.push({ row, reason: parsed.reason })
        return
      }
      if (parsed.date !== opportunity.closeDate) patch.closeDate = parsed.date
    }

    const stageValue = fields.stage?.trim()
    if (stageValue) {
      const normalizedStage = normalizeName(stageValue)
      const stage = stagesConfig.find((candidate) => (
        normalizeName(candidate.id) === normalizedStage || normalizeName(candidate.label) === normalizedStage
      ))
      if (stage) {
        if (stage.id !== opportunity.stageId) patch.stageId = stage.id
      } else {
        warnings.push({ row, reason: `Etapa desconocida «${stageValue}»; se conserva la etapa actual.` })
      }
    }

    const forecastValue = fields.forecastCategory?.trim()
    if (forecastValue) {
      const category = (['Pipeline', 'Upside', 'Commit', 'Closed'] as const)
        .find((value) => normalizeName(value) === normalizeName(forecastValue))
      if (category) {
        if (category !== opportunity.forecastCategory) patch.forecastCategory = category
      } else {
        warnings.push({ row, reason: `Categoría de forecast desconocida «${forecastValue}»; se conserva la actual.` })
      }
    }

    if (Object.keys(patch).length) {
      updates.set(opportunity.id, { ...updates.get(opportunity.id), ...patch })
    } else if (!warnings.some((warning) => warning.row === row)) {
      skipped.push({ row, reason: 'Sin cambios.' })
    }
  })

  return {
    updates: [...updates].map(([id, patch]) => ({ id, patch, changedFields: Object.keys(patch) })),
    skipped,
    warnings,
  }
}
