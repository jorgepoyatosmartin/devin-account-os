import type { TerritoryEffortConfig } from '../config'
import type { Hypothesis, MeetingNote, PgRecord, Stakeholder } from '../types'

type EffortRow = {
  accountId: string
  tier: string | null
  potentialEur: number | null
  pipelineEur: number | null
}

type ActivityData = {
  pg: PgRecord[]
  hypotheses: Hypothesis[]
  meetingNotes: MeetingNote[]
}

function largestRemainder(entries: { accountId: string; score: number }[]): Record<string, number> {
  const total = entries.reduce((sum, entry) => sum + entry.score, 0)
  if (total <= 0) return {}

  const shares = entries.map((entry, index) => ({
    ...entry,
    index,
    exact: entry.score / total * 100,
    percent: Math.floor(entry.score / total * 100),
  }))
  let remaining = 100 - shares.reduce((sum, entry) => sum + entry.percent, 0)
  const ranked = [...shares].sort((a, b) => (
    (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact))
    || a.accountId.localeCompare(b.accountId)
    || a.index - b.index
  ))
  for (const entry of ranked) {
    if (remaining <= 0) break
    entry.percent += 1
    remaining -= 1
  }
  return Object.fromEntries(shares.map(({ accountId, percent }) => [accountId, percent]))
}

function normalizedTierWeight(tier: string | null, cfg: TerritoryEffortConfig): number {
  const normalized = tier?.trim().toLowerCase()
  if (!normalized) return cfg.defaultTierWeight
  const matched = Object.entries(cfg.tierWeights).find(([key]) => key.trim().toLowerCase() === normalized)
  return matched?.[1] ?? cfg.defaultTierWeight
}

export function suggestEffort(rows: EffortRow[], cfg: TerritoryEffortConfig): Record<string, number | null> {
  const result: Record<string, number | null> = Object.fromEntries(rows.map(({ accountId }) => [accountId, null]))
  const scored = rows.flatMap((row) => row.potentialEur === null
    ? []
    : [{
      accountId: row.accountId,
      score: Math.max(row.potentialEur - (row.pipelineEur ?? 0), 0) * normalizedTierWeight(row.tier, cfg),
    }])
  const percentages = largestRemainder(scored)
  if (!Object.keys(percentages).length) return result
  for (const row of scored) result[row.accountId] = percentages[row.accountId] ?? 0
  return result
}

function utcDay(value: string | null | undefined): number | null {
  if (!value) return null
  const day = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const timestamp = Date.parse(`${day}T00:00:00.000Z`)
  if (Number.isNaN(timestamp) || Number.isNaN(Date.parse(value)) || new Date(timestamp).toISOString().slice(0, 10) !== day) return null
  return timestamp
}

export function actualEffort(
  accountIds: string[],
  data: ActivityData,
  today: string,
  cfg: TerritoryEffortConfig,
): { units: Record<string, number>; pct: Record<string, number | null> } {
  const accounts = new Set(accountIds)
  const units: Record<string, number> = Object.fromEntries(accountIds.map((id) => [id, 0]))
  const todayDay = utcDay(today)
  const startDay = todayDay === null ? null : todayDay - cfg.activityWindowDays * 24 * 60 * 60 * 1000
  const add = (accountId: string, date: string, weight: number) => {
    const day = utcDay(date)
    if (!accounts.has(accountId) || day === null || startDay === null || todayDay === null) return
    if (day >= startDay && day <= todayDay) units[accountId] += weight
  }

  for (const record of data.pg) {
    for (const touch of record.touches ?? []) {
      add(record.accountId, touch.date, touch.channel === 'meeting' ? cfg.activityWeights.meeting : cfg.activityWeights.touch)
    }
  }
  for (const hypothesis of data.hypotheses) {
    for (const touch of hypothesis.touches ?? []) {
      add(hypothesis.accountId, touch.date, touch.channel === 'meeting' ? cfg.activityWeights.meeting : cfg.activityWeights.touch)
    }
  }
  for (const note of data.meetingNotes) add(note.accountId, note.date, cfg.activityWeights.meeting)

  const pct: Record<string, number | null> = Object.fromEntries(accountIds.map((id) => [id, null]))
  const percentages = largestRemainder(accountIds
    .filter((accountId) => units[accountId] > 0)
    .map((accountId) => ({ accountId, score: units[accountId] })))
  for (const [accountId, value] of Object.entries(percentages)) pct[accountId] = value
  return { units, pct }
}

export function effortSum(planned: Record<string, number | null>): { sum: number; anySet: boolean; ok: boolean } {
  const values = Object.values(planned).filter((value): value is number => value !== null)
  const sum = values.reduce((total, value) => total + value, 0)
  const anySet = values.length > 0
  return { sum, anySet, ok: !anySet || sum === 100 }
}

export function coverageFor(
  people: Stakeholder[],
  cfg: TerritoryEffortConfig,
): {
  active: number
  departed: number
  contacted: number
  coveragePct: number
  keyRolesCovered: string[]
  keyRolesMissing: string[]
} {
  const activePeople = people.filter((person) => person.departed !== true)
  const contactedPeople = activePeople.filter((person) => ['Contacted', 'Engaged', 'Champion'].includes(person.relationshipStatus))
  const keyRolesCovered = cfg.keyRoles.filter((role) => contactedPeople.some((person) => (person.powerRole || person.buyingRole) === role))
  return {
    active: activePeople.length,
    departed: people.length - activePeople.length,
    contacted: contactedPeople.length,
    coveragePct: activePeople.length ? Math.round(contactedPeople.length / activePeople.length * 100) : 0,
    keyRolesCovered,
    keyRolesMissing: cfg.keyRoles.filter((role) => !keyRolesCovered.includes(role)),
  }
}
