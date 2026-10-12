import { useState } from 'react'
import { Link } from 'react-router-dom'
import { engagementConfig, stagesConfig } from '../config'
import { useI18n } from '../i18n'
import type { Dataset, Hypothesis, OpportunityPerson, OpportunityV2 } from '../types'
import { Section } from '../components/ui'

type Save = (opportunity: OpportunityV2) => void

export function OpportunityPeopleTab({ opportunity, dataset, save }: { opportunity: OpportunityV2; dataset: Dataset; save: Save }) {
  const { lang } = useI18n()
  const label = (es: string, en: string) => lang === 'es' ? es : en
  const update = (people: OpportunityPerson[]) => save({ ...opportunity, people, stakeholderIds: people.map((person) => person.stakeholderId) })
  const add = (stakeholderId: string) => {
    if (!stakeholderId || opportunity.people.some((person) => person.stakeholderId === stakeholderId)) return
    update([...opportunity.people, { stakeholderId, role: 'Unknown', confirmed: false }])
  }
  return <Section title={label('Personas y roles', 'People and roles')} eyebrow={label('Roles por oportunidad', 'Opportunity-specific roles')}>
    <select value="" onChange={(event) => add(event.target.value)}><option value="">{label('Añadir stakeholder', 'Add stakeholder')}</option>{dataset.stakeholders.filter((person) => person.accountId === opportunity.accountId).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
    <div className="table-wrap"><table><thead><tr><th>{label('Persona', 'Person')}</th><th>{label('Rol Power', 'Power role')}</th><th>{label('Confirmado', 'Confirmed')}</th><th>{label('Evidencia', 'Evidence')}</th><th>{label('Verificado', 'Verified')}</th><th /></tr></thead><tbody>{opportunity.people.map((person, index) => {
      const stakeholder = dataset.stakeholders.find((item) => item.id === person.stakeholderId)
      return <tr key={`${person.stakeholderId}-${index}`}><td>{stakeholder?.name || person.stakeholderId}</td><td><select value={person.role} onChange={(event) => update(opportunity.people.map((item, i) => i === index ? { ...item, role: event.target.value as OpportunityPerson['role'] } : item))}>{['Executive Sponsor', 'Economic Buyer', 'Champion', 'Technical Champion', 'Business Champion', 'Influencer', 'Technical Evaluator', 'Security', 'Procurement', 'Legal', 'Coach', 'Blocker', 'Unknown'].map((role) => <option key={role}>{role}</option>)}</select></td><td><input type="checkbox" checked={person.confirmed} onChange={(event) => update(opportunity.people.map((item, i) => i === index ? { ...item, confirmed: event.target.checked, verifiedAt: event.target.checked ? new Date().toISOString().slice(0, 10) : undefined } : item))} /></td><td><input value={person.evidence || ''} onChange={(event) => update(opportunity.people.map((item, i) => i === index ? { ...item, evidence: event.target.value } : item))} /></td><td>{person.verifiedAt || '—'}</td><td><button onClick={() => update(opportunity.people.filter((_, i) => i !== index))}>×</button></td></tr>
    })}</tbody></table></div>
  </Section>
}

export function OpportunityEngagementTab({ opportunity, save }: { opportunity: OpportunityV2; save: Save }) {
  const { lang } = useI18n()
  const label = (es: string, en: string) => lang === 'es' ? es : en
  const update = (phase: string, field: 'date' | 'evidence', value: string) => {
    const current = opportunity.engagement.find((item) => item.phase === phase) || { phase, date: null, evidence: '' }
    const engagement = [...opportunity.engagement.filter((item) => item.phase !== phase), { ...current, [field]: field === 'date' && !value ? null : value }]
    save({ ...opportunity, engagement: engagementConfig.map((item) => engagement.find((entry) => entry.phase === item.id) || { phase: item.id, date: null, evidence: '' }) })
  }
  return <Section title="Engagement" eyebrow={label('Fases y evidencia', 'Phases and evidence')}><div className="table-wrap"><table><thead><tr><th>{label('Fase', 'Phase')}</th><th>{label('Fecha', 'Date')}</th><th>{label('Evidencia', 'Evidence')}</th></tr></thead><tbody>{engagementConfig.map((phase) => {
    const entry = opportunity.engagement.find((item) => item.phase === phase.id)
    return <tr key={phase.id}><td><strong>{phase.id}</strong><small>{phase.label}</small></td><td><input type="date" value={entry?.date || ''} onChange={(event) => update(phase.id, 'date', event.target.value)} /></td><td><input value={entry?.evidence || ''} onChange={(event) => update(phase.id, 'evidence', event.target.value)} /></td></tr>
  })}</tbody></table></div></Section>
}

export function OpportunityStageGatesTab({ opportunity, save, setLegacyStage }: { opportunity: OpportunityV2; save: Save; setLegacyStage: (stage: string) => void }) {
  const { lang } = useI18n()
  const [warning, setWarning] = useState('')
  const label = (es: string, en: string) => lang === 'es' ? es : en
  const stage = stagesConfig.find((item) => item.id === opportunity.stageId)
  const completed = opportunity.exitChecks[opportunity.stageId] || []
  const advance = (stageId: string) => {
    const pending = (stage?.exitCriteria || []).filter((criterion) => !completed.includes(criterion))
    setWarning(pending.length ? `${label('Criterios pendientes', 'Pending criteria')}: ${pending.join(' · ')}` : '')
    const next = stagesConfig.find((item) => item.id === stageId)
    save({ ...opportunity, stageId, stageHistory: [...opportunity.stageHistory, { stageId, date: new Date().toISOString().slice(0, 10) }] })
    if (next) setLegacyStage(next.label)
  }
  const toggle = (criterion: string, checked: boolean) => {
    const next = checked ? [...completed, criterion] : completed.filter((item) => item !== criterion)
    save({ ...opportunity, exitChecks: { ...opportunity.exitChecks, [opportunity.stageId]: next } })
  }
  return <Section title={label('Stage gates', 'Stage gates')} eyebrow={stage?.label || opportunity.stageId}>
    <label>{label('Etapa', 'Stage')}<select value={opportunity.stageId} onChange={(event) => advance(event.target.value)}>{stagesConfig.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    {warning && <p className="warning">{warning}</p>}
    <div className="checkbox-grid">{(stage?.exitCriteria || []).map((criterion) => <label key={criterion}><input type="checkbox" checked={completed.includes(criterion)} onChange={(event) => toggle(criterion, event.target.checked)} />{criterion}</label>)}</div>
  </Section>
}

export function OpportunityOriginTab({ opportunity, dataset, hypotheses }: { opportunity: OpportunityV2; dataset: Dataset; hypotheses: Hypothesis[] }) {
  const { lang } = useI18n()
  const label = (es: string, en: string) => lang === 'es' ? es : en
  return <Section title={label('Origen', 'Origin')} eyebrow={label('Trazabilidad', 'Traceability')}>
    {opportunity.origin.signalIds.map((signalId) => <p key={signalId}><Link to="/signals">{label('Señal', 'Signal')}: {dataset.signals.find((signal) => signal.id === signalId)?.signal || signalId}</Link></p>)}
    {opportunity.origin.pgId && <p><Link to={`/pg/${opportunity.origin.pgId}`}>{label('Registro PG', 'PG record')} · {opportunity.origin.pgId}</Link></p>}
    {opportunity.origin.hypothesisId && <p><Link to={`/pg?hypothesis=${opportunity.origin.hypothesisId}`}>{label('Hipótesis', 'Hypothesis')}: {hypotheses.find((item) => item.id === opportunity.origin.hypothesisId)?.title || opportunity.origin.hypothesisId}</Link></p>}
    {!opportunity.origin.signalIds.length && !opportunity.origin.pgId && !opportunity.origin.hypothesisId && <p>{label('Sin origen PG enlazado.', 'No linked PG origin.')}</p>}
  </Section>
}
