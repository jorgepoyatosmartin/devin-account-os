import { commissionByOpportunity } from '../prp/commission'
import type { CompPlan, OpportunityV2 } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export interface TodayAction {
  id: string
  kind: string
  reason: string
  href: string
  accountId: string
}

export interface TodayData {
  opportunities: {
    id: string
    accountId: string
    status: 'open' | 'won' | 'lost'
    amount: number | null
    closeDate: string | null
  }[]
  commissionOpportunities?: OpportunityV2[]
  tasks: {
    id: string
    title: string
    accountId: string
    opportunityId?: string
    due?: string
    status: 'Open' | 'Done'
  }[]
  stakeholders: {
    id: string
    accountId: string
    name: string
    relationshipStatus: string
    buyingRole: string
    powerRole?: string
    lastTouch?: string | null
  }[]
  signals: {
    id: string
    accountId: string
    date: string
    signal: string
  }[]
  pg: {
    id: string
    accountId: string
    signalIds: string[]
    status: string
    touches?: unknown[]
  }[]
  hypotheses?: {
    id: string
    accountId: string
    signalIds: string[]
    status: string
    pgId?: string
  }[]
  signalScores?: { id: string; score: number | null }[]
}

function timestamp(date: string | null | undefined): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const value = Date.parse(`${date}T00:00:00.000Z`)
  return Number.isNaN(value) ? null : value
}

export function buildTodayPgScoreTargetActions(data: Pick<TodayData, 'pg' | 'hypotheses' | 'signalScores'>): TodayAction[] {
  const scores = new Map((data.signalScores || []).map((signal) => [signal.id, signal.score]))
  const actions: TodayAction[] = []
  data.pg.forEach((target) => {
    if (['CONVERTED', 'DISQUALIFIED', 'NURTURE'].includes(target.status) || (target.touches?.length || 0) > 0) return
    const score = Math.max(0, ...target.signalIds.map((signalId) => scores.get(signalId) || 0))
    if (score < 70) return
    actions.push({ id: `pg-score:${target.id}`, kind: 'pg-score-target', reason: `PG target score ${score.toFixed(1)} without touches.`, href: `/pg/${target.id}`, accountId: target.accountId })
  })
  data.hypotheses?.forEach((hypothesis) => {
    if (!['hypothesis', 'validated'].includes(hypothesis.status)) return
    const relatedPg = hypothesis.pgId ? data.pg.find((target) => target.id === hypothesis.pgId) : undefined
    if ((relatedPg?.touches?.length || 0) > 0) return
    const score = Math.max(0, ...hypothesis.signalIds.map((signalId) => scores.get(signalId) || 0))
    if (score < 70) return
    actions.push({ id: `pg-score-hypothesis:${hypothesis.id}`, kind: 'pg-score-hypothesis', reason: `Hypothesis score ${score.toFixed(1)} without touches.`, href: `/pg?hypothesis=${hypothesis.id}`, accountId: hypothesis.accountId })
  })
  return actions
}

export function buildTodayCommissionAccelerateActions(
  opportunities: OpportunityV2[],
  plan: CompPlan,
  today: string,
): TodayAction[] {
  const todayTimestamp = timestamp(today)
  if (todayTimestamp === null) return []
  const commissionById = new Map(
    commissionByOpportunity(opportunities, plan).map((row) => [row.oppId, row]),
  )
  return opportunities
    .filter((opportunity) => {
      const closeTimestamp = timestamp(opportunity.closeDate)
      return opportunity.status === 'open'
        && closeTimestamp !== null
        && closeTimestamp >= todayTimestamp
        && closeTimestamp <= todayTimestamp + 90 * DAY_MS
    })
    .map((opportunity) => ({ opportunity, commission: commissionById.get(opportunity.id) }))
    .filter((item) => item.commission)
    .sort((a, b) => (b.commission?.commissionNet || 0) - (a.commission?.commissionNet || 0))
    .slice(0, 3)
    .map(({ opportunity, commission }) => ({
      id: `accelerate:${opportunity.id}`,
      kind: 'accelerate',
      reason: `Acelerar ${opportunity.name}: +${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(commission!.commissionNet)} € neto si se gana`,
      href: `/opportunities/${opportunity.id}`,
      accountId: opportunity.accountId,
    }))
}

export function buildToday(data: TodayData, today: string, compPlan?: CompPlan | null): TodayAction[] {
  const todayTimestamp = timestamp(today)
  if (todayTimestamp === null) return []
  const actions: TodayAction[] = []

  data.tasks.forEach((task) => {
    const due = timestamp(task.due)
    if (task.status !== 'Open' || due === null || due >= todayTimestamp) return
    actions.push({
      id: `overdue-task:${task.id}`,
      kind: 'overdue-next-step',
      reason: `Próximo paso vencido: ${task.title}`,
      href: task.opportunityId ? `/opportunities/${task.opportunityId}?tab=Next%20Actions` : '/tasks',
      accountId: task.accountId,
    })
  })

  data.opportunities.forEach((opportunity) => {
    if (opportunity.status !== 'open') return
    const closeDate = timestamp(opportunity.closeDate)
    if (closeDate !== null && closeDate < todayTimestamp) {
      actions.push({
        id: `overdue-close:${opportunity.id}`,
        kind: 'overdue-close-date',
        reason: `Fecha de cierre vencida: ${opportunity.closeDate}`,
        href: `/opportunities/${opportunity.id}`,
        accountId: opportunity.accountId,
      })
    }
  })

  if (compPlan && data.commissionOpportunities) {
    actions.push(...buildTodayCommissionAccelerateActions(data.commissionOpportunities, compPlan, today))
  }

  data.opportunities.forEach((opportunity) => {
    if (opportunity.status !== 'open') return
    const missing: string[] = []
    if (opportunity.amount === null) missing.push('importe')
    if (timestamp(opportunity.closeDate) === null) missing.push('fecha de cierre')
    if (!missing.length) return
    actions.push({
      id: `missing-prp:${opportunity.id}`,
      kind: 'missing-prp-data',
      reason: `Falta ${missing.join(' y ')}`,
      href: `/opportunities/${opportunity.id}`,
      accountId: opportunity.accountId,
    })
  })

  actions.push(...buildTodayPgScoreTargetActions(data))

  data.stakeholders.forEach((person) => {
    const champion = person.relationshipStatus === 'Champion'
      || person.powerRole?.includes('Champion')
      || person.buyingRole === 'Champion'
    const economicBuyer = person.powerRole === 'Economic Buyer' || person.buyingRole === 'Economic Buyer'
    if (!champion && !economicBuyer) return
    const lastTouch = timestamp(person.lastTouch)
    const daysSinceTouch = lastTouch === null ? null : Math.floor((todayTimestamp - lastTouch) / DAY_MS)
    if (daysSinceTouch !== null && daysSinceTouch <= 30) return
    actions.push({
      id: `stale-touch:${person.id}`,
      kind: 'stakeholder-no-recent-touch',
      reason: daysSinceTouch === null ? 'Sin fecha de último contacto.' : `Sin contacto en ${daysSinceTouch} días.`,
      href: `/stakeholders/${person.id}`,
      accountId: person.accountId,
    })
  })

  const linkedSignalIds = new Set(
    data.pg
      .filter((target) => !['CONVERTED', 'DISQUALIFIED', 'NURTURE'].includes(target.status))
      .flatMap((target) => target.signalIds),
  )
  data.signals.forEach((signal) => {
    const date = timestamp(signal.date)
    if (date === null || linkedSignalIds.has(signal.id)) return
    const ageInDays = Math.floor((todayTimestamp - date) / DAY_MS)
    if (ageInDays < 0 || ageInDays >= 14) return
    actions.push({
      id: `unlinked-signal:${signal.id}`,
      kind: 'recent-signal-unlinked',
      reason: 'Señal reciente sin objetivo PG vinculado.',
      href: '/signals',
      accountId: signal.accountId,
    })
  })

  return actions
}
