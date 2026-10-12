import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Section } from '../components/ui'
import { stagesConfig } from '../config'
import { useI18n } from '../i18n'
import { buildToday, type TodayAction } from '../lib/today'
import { prp } from '../prp/engine'
import type { CompPlan, Dataset, OpportunityV2, Task } from '../types'
import './today.css'

export default function TodayPage({
  dataset,
  opportunities,
  compPlan,
  tasks,
  addTask,
}: {
  dataset: Dataset
  opportunities: OpportunityV2[]
  compPlan: CompPlan | null
  tasks: Task[]
  addTask: (task: Task) => void
}) {
  const { lang, t } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const data = useMemo(() => ({
    opportunities,
    tasks,
    stakeholders: dataset.stakeholders,
    signals: dataset.signals,
    pg: dataset.pg,
  }), [dataset, opportunities, tasks])
  const actions = useMemo(() => buildToday(data, today), [data, today])
  const forecast = useMemo(() => compPlan
    ? prp(opportunities, compPlan, Object.fromEntries(stagesConfig.map((stage) => [stage.id, stage.probability])), today)
    : null, [compPlan, opportunities, today])
  const money = (value: number) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(value)
  const titleFor = (action: TodayAction) => {
    if (action.kind === 'overdue-next-step') {
      return tasks.find((task) => `overdue-task:${task.id}` === action.id)?.title || action.reason
    }
    if (action.kind === 'stakeholder-no-recent-touch') {
      const personId = action.id.slice('stale-touch:'.length)
      return dataset.stakeholders.find((person) => person.id === personId)?.name || action.reason
    }
    if (action.kind === 'recent-signal-unlinked') {
      const signalId = action.id.slice('unlinked-signal:'.length)
      return dataset.signals.find((signal) => signal.id === signalId)?.signal || action.reason
    }
    return opportunities.find((opportunity) => action.id.endsWith(opportunity.id))?.name || action.reason
  }
  const addActionTask = (action: TodayAction) => {
    const existingTask = action.kind === 'overdue-next-step'
      ? tasks.find((task) => `overdue-task:${task.id}` === action.id)
      : undefined
    const stakeholderId = action.kind === 'stakeholder-no-recent-touch'
      ? action.id.slice('stale-touch:'.length)
      : existingTask?.stakeholderId
    addTask({
      id: `task-${Date.now()}`,
      title: action.reason,
      accountId: action.accountId,
      opportunityId: existingTask?.opportunityId,
      stakeholderId,
      status: 'Open',
      createdAt: new Date().toISOString(),
      source: 'today',
    })
  }

  return <>
    <PageHeader
      eyebrow={t('today.eyebrow')}
      title={t('today.title')}
      subtitle={t('today.subtitle')}
      action={forecast
        ? <div className="today-prp-summary"><span>{t('today.personalGap')}: <strong>{money(forecast.gapToPersonal)}</strong></span><span>{t('today.weeklyPace')}: <strong>{money(forecast.weeklyPipelinePacePersonal)}</strong></span></div>
        : <Link className="button primary" to="/prp">{t('today.goPrp')}</Link>}
    />
    <Section title={t('today.actions')} eyebrow={today}>
      {actions.length ? <div className="today-action-list">{actions.map((action) => (
        <article className="today-action-card" key={action.id}>
          <div><span className="today-action-kind">{t(`today.kind.${action.kind}` as never)}</span><h3>{titleFor(action)}</h3><p>{action.reason}</p><small>{dataset.accounts.find((account) => account.id === action.accountId)?.name || action.accountId}</small></div>
          <div className="today-action-buttons"><Link className="button secondary" to={action.href}>{t('common.open')}</Link><button className="button secondary" onClick={() => addActionTask(action)}>{t('today.addTask')}</button></div>
        </article>
      ))}</div> : <div className="empty-state"><p>{t('today.noActions')}</p></div>}
    </Section>
  </>
}
