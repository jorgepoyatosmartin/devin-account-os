import type { OpportunityV2, PgRecord } from '../types'

export interface PgMetricsRow {
  key: string
  targets: number
  touched: number
  touches: number
  responses: number
  positive: number
  meetings: number
  opportunities: number
  pipelineEur: number
  wonEur: number
}

type GroupBy = 'account' | 'salesPlay' | 'channel'
type MetricAccumulator = {
  row: PgMetricsRow
  touchedIds: Set<string>
  meetingIds: Set<string>
  opportunityIds: Set<string>
}

const meetingStatuses = new Set(['MEETING', 'QUALIFIED', 'CONVERTED'])
const responseTypes = new Set(['positive', 'neutral', 'negative'])

function groupFor(record: PgRecord, groupBy: GroupBy): string {
  if (groupBy === 'account') return record.accountId || '—'
  if (groupBy === 'salesPlay') return record.salesPlay || '—'
  return record.touches?.[0]?.channel || 'none'
}

export function pgMetrics(
  pg: PgRecord[],
  opps: OpportunityV2[],
  groupBy: GroupBy,
  fxEurUsd: number,
): PgMetricsRow[] {
  const accumulators = new Map<string, MetricAccumulator>()
  const opportunityById = new Map(opps.map((opportunity) => [opportunity.id, opportunity]))
  const opportunitiesByPg = new Map<string, Set<string>>()
  const getAccumulator = (key: string) => {
    let accumulator = accumulators.get(key)
    if (!accumulator) {
      accumulator = {
        row: { key, targets: 0, touched: 0, touches: 0, responses: 0, positive: 0, meetings: 0, opportunities: 0, pipelineEur: 0, wonEur: 0 },
        touchedIds: new Set(),
        meetingIds: new Set(),
        opportunityIds: new Set(),
      }
      accumulators.set(key, accumulator)
    }
    return accumulator
  }
  const linkOpportunity = (pgId: string, opportunityId: string) => {
    const linked = opportunitiesByPg.get(pgId) ?? new Set<string>()
    linked.add(opportunityId)
    opportunitiesByPg.set(pgId, linked)
  }

  for (const opportunity of opps) {
    if (opportunity.origin?.pgId) linkOpportunity(opportunity.origin.pgId, opportunity.id)
  }
  for (const record of pg) {
    if (record.opportunityId) linkOpportunity(record.id, record.opportunityId)
    const touches = record.touches ?? []
    const firstGroup = groupFor(record, groupBy)
    const targetAccumulator = getAccumulator(firstGroup)
    targetAccumulator.row.targets += 1
    const metricGroups = groupBy === 'channel'
      ? [...new Set(touches.map((touch) => touch.channel))]
      : [firstGroup]
    if (groupBy === 'channel' && metricGroups.length === 0) metricGroups.push(firstGroup)
    for (const key of metricGroups) {
      const accumulator = getAccumulator(key)
      const groupTouches = groupBy === 'channel'
        ? touches.filter((touch) => touch.channel === key)
        : touches
      if (groupTouches.length > 0) accumulator.touchedIds.add(record.id)
      accumulator.row.touches += groupTouches.length
      accumulator.row.responses += groupTouches.filter((touch) => responseTypes.has(touch.response || '')).length
      accumulator.row.positive += groupTouches.filter((touch) => touch.response === 'positive').length
      const hasMeetingTouch = groupTouches.some((touch) => touch.channel === 'meeting')
      const statusMeeting = meetingStatuses.has(record.status)
      if (hasMeetingTouch || (statusMeeting && (!touches.some((touch) => touch.channel === 'meeting') || key === firstGroup))) {
        accumulator.meetingIds.add(record.id)
      }
    }
    const opportunityIds = new Set(opportunitiesByPg.get(record.id) ?? [])
    if (record.opportunityId) opportunityIds.add(record.opportunityId)
    for (const opportunity of opps) {
      if (opportunity.origin?.pgId === record.id) opportunityIds.add(opportunity.id)
    }
    for (const opportunityId of opportunityIds) {
      targetAccumulator.opportunityIds.add(opportunityId)
    }
  }

  return [...accumulators.values()].map(({ row, touchedIds, meetingIds, opportunityIds }) => {
    row.touched = touchedIds.size
    row.meetings = meetingIds.size
    for (const opportunityId of opportunityIds) {
      const opportunity = opportunityById.get(opportunityId)
      if (!opportunity || opportunity.amount === null) continue
      const amountEur = opportunity.currency === 'USD' ? opportunity.amount / fxEurUsd : opportunity.amount
      row.opportunities += 1
      if (opportunity.status === 'open') row.pipelineEur += amountEur
      if (opportunity.status === 'won') row.wonEur += amountEur
    }
    return row
  }).sort((a, b) => a.key.localeCompare(b.key))
}
