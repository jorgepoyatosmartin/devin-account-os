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
    signalIds: string[]
    status: string
  }[]
}

function timestamp(date: string | null | undefined): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const value = Date.parse(`${date}T00:00:00.000Z`)
  return Number.isNaN(value) ? null : value
}

export function buildTodayPgScoreTargetActions(): TodayAction[] {
  return []
}

export function buildToday(data: TodayData, today: string): TodayAction[] {
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

  actions.push(...buildTodayPgScoreTargetActions())

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
