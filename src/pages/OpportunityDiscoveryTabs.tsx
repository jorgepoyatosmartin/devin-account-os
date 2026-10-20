import { useState } from 'react'
import { Link } from 'react-router-dom'
import { engagementConfig, stagesConfig } from '../config'
import type { AccountPartner } from '../accounts/registry'
import { useI18n } from '../i18n'
import type { Dataset, Hypothesis, OpportunityPerson, OpportunityV2 } from '../types'
import { Section } from '../components/ui'
import '../pg/discovery.css'

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
    <div className="stage-gate-control"><label>{label('Etapa', 'Stage')}<select value={opportunity.stageId} onChange={(event) => advance(event.target.value)}>{stagesConfig.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><span>{stage?.exitCriteria.filter((criterion) => completed.includes(criterion)).length || 0}/{stage?.exitCriteria.length || 0} {label('criterios', 'criteria')}</span></div>
    {warning && <p className="warning">{warning}</p>}
    <div className="stage-gates-list">{(stage?.exitCriteria || []).map((criterion) => {
      const checked = completed.includes(criterion)
      return <label className={`stage-gate-option${checked ? ' complete' : ''}`} key={criterion}><input type="checkbox" checked={checked} onChange={(event) => toggle(criterion, event.target.checked)} /><span>{criterion}</span></label>
    })}</div>
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

export function OpportunityBusinessCaseTab({
  opportunity,
  save,
  fxEurUsd,
}: {
  opportunity: OpportunityV2
  save: Save
  fxEurUsd: number
}) {
  const { lang } = useI18n()
  const label = (es: string, en: string) => lang === 'es' ? es : en
  const businessCase = opportunity.businessCase ?? { levers: [], notes: '' }
  const update = (next: NonNullable<OpportunityV2['businessCase']>) => save({ ...opportunity, businessCase: next })
  const verified = businessCase.levers.reduce((sum, lever) => (
    lever.type === 'assumption' ? sum : sum + (lever.valueEur ?? 0)
  ), 0)
  const assumed = businessCase.levers.reduce((sum, lever) => (
    lever.type === 'assumption' ? sum + (lever.valueEur ?? 0) : sum
  ), 0)
  const total = verified + assumed
  const amountEur = opportunity.amount === null
    ? null
    : opportunity.currency === 'USD' ? opportunity.amount / fxEurUsd : opportunity.amount
  const roi = amountEur ? total / amountEur : null
  const addLever = () => update({
    ...businessCase,
    levers: [...businessCase.levers, {
      id: `lever-${Date.now()}`,
      label: '',
      formula: '',
      valueEur: null,
      source: '',
      type: 'assumption',
    }],
  })
  const updateLever = (index: number, patch: Partial<typeof businessCase.levers[number]>) => update({
    ...businessCase,
    levers: businessCase.levers.map((lever, itemIndex) => itemIndex === index ? { ...lever, ...patch } : lever),
  })
  const formatMoney = (value: number) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)

  return <Section title={label('Business case', 'Business case')} eyebrow={label('Palancas de valor trazables', 'Traceable value levers')}>
    <div className="prp-tier-heading">
      <h3>{label('Palancas', 'Value levers')}</h3>
      <button type="button" className="button secondary" onClick={addLever}>{label('Añadir palanca', 'Add lever')}</button>
    </div>
    <div className="table-wrap"><table><thead><tr>
      <th>{label('Palanca', 'Lever')}</th><th>{label('Fórmula', 'Formula')}</th><th>{label('Valor EUR', 'Value EUR')}</th>
      <th>{label('Fuente', 'Source')}</th><th>{label('Tipo', 'Type')}</th><th />
    </tr></thead><tbody>{businessCase.levers.map((lever, index) => <tr key={lever.id}>
      <td><input value={lever.label} onChange={(event) => updateLever(index, { label: event.target.value })} /></td>
      <td><input value={lever.formula} onChange={(event) => updateLever(index, { formula: event.target.value })} /></td>
      <td><input type="number" step="any" value={lever.valueEur ?? ''} onChange={(event) => updateLever(index, { valueEur: event.target.value === '' ? null : Number(event.target.value) })} /></td>
      <td><input value={lever.source} onChange={(event) => updateLever(index, { source: event.target.value })} /></td>
      <td><select value={lever.type} onChange={(event) => updateLever(index, { type: event.target.value as typeof lever.type })}>
        <option value="customer">{label('Cliente', 'Customer')}</option>
        <option value="benchmark">Benchmark</option>
        <option value="assumption">{label('Supuesto', 'Assumption')}</option>
      </select></td>
      <td><button type="button" className="button ghost" onClick={() => update({ ...businessCase, levers: businessCase.levers.filter((_, itemIndex) => itemIndex !== index) })}>×</button></td>
    </tr>)}</tbody></table></div>
    <label>{label('Notas', 'Notes')}<textarea value={businessCase.notes} onChange={(event) => update({ ...businessCase, notes: event.target.value })} /></label>
    <div className="detail-grid business-case-totals">
      <div className="detail-item"><span>{label('Verificado (cliente + benchmark)', 'Verified (customer + benchmark)')}</span><strong>{formatMoney(verified)}</strong></div>
      <div className="detail-item"><span>{label('Total con supuestos', 'Total including assumptions')}</span><strong>{formatMoney(total)}</strong></div>
      <div className="detail-item"><span>ROI</span><strong>{roi === null ? '—' : `${roi.toFixed(2)}×`}</strong></div>
    </div>
    {total > 0 && assumed / total > 0.5 && <p className="business-case-warning">{label('Los supuestos superan el 50 % del valor total.', 'Assumptions exceed 50% of total value.')}</p>}
  </Section>
}

export function OpportunityTechnicalValidationTab({ opportunity, save }: { opportunity: OpportunityV2; save: Save }) {
  const { lang } = useI18n()
  const label = (es: string, en: string) => lang === 'es' ? es : en
  const validation = opportunity.technicalValidation ?? { pocPlan: '', criteria: [], acceptedAt: null }
  const allPassed = validation.criteria.length > 0 && validation.criteria.every((criterion) => criterion.result === 'pass')
  const update = (next: NonNullable<OpportunityV2['technicalValidation']>) => save({ ...opportunity, technicalValidation: next })
  const addCriterion = () => update({
    ...validation,
    criteria: [...validation.criteria, {
      id: `criterion-${Date.now()}`,
      criterion: '',
      owner: '',
      result: 'pending',
      evidence: '',
    }],
  })
  const updateCriterion = (index: number, patch: Partial<typeof validation.criteria[number]>) => {
    const criteria = validation.criteria.map((criterion, itemIndex) => itemIndex === index ? { ...criterion, ...patch } : criterion)
    update({ ...validation, criteria, acceptedAt: criteria.every((criterion) => criterion.result === 'pass') ? validation.acceptedAt : null })
  }
  const passed = validation.criteria.filter((criterion) => criterion.result === 'pass').length
  return <Section title={label('Validación técnica', 'Technical validation')} eyebrow={label('Plan de POC y criterios', 'POC plan and criteria')}>
    <label>{label('Plan de POC', 'POC plan')}<textarea value={validation.pocPlan} onChange={(event) => update({ ...validation, pocPlan: event.target.value })} /></label>
    <div className="prp-tier-heading">
      <h3>{label('Criterios', 'Criteria')} · {passed}/{validation.criteria.length} {label('superados', 'passed')}</h3>
      <button type="button" className="button secondary" onClick={addCriterion}>{label('Añadir criterio', 'Add criterion')}</button>
    </div>
    <div className="table-wrap"><table><thead><tr>
      <th>{label('Criterio', 'Criterion')}</th><th>{label('Responsable', 'Owner')}</th><th>{label('Resultado', 'Result')}</th><th>{label('Evidencia', 'Evidence')}</th><th />
    </tr></thead><tbody>{validation.criteria.map((criterion, index) => <tr key={criterion.id}>
      <td><input value={criterion.criterion} onChange={(event) => updateCriterion(index, { criterion: event.target.value })} /></td>
      <td><input value={criterion.owner} onChange={(event) => updateCriterion(index, { owner: event.target.value })} /></td>
      <td><select value={criterion.result} onChange={(event) => updateCriterion(index, { result: event.target.value as typeof criterion.result })}>
        <option value="pending">{label('Pendiente', 'Pending')}</option><option value="pass">{label('Superado', 'Pass')}</option><option value="fail">{label('Fallido', 'Fail')}</option>
      </select></td>
      <td><input value={criterion.evidence} onChange={(event) => updateCriterion(index, { evidence: event.target.value })} /></td>
      <td><button type="button" className="button ghost" onClick={() => update({ ...validation, criteria: validation.criteria.filter((_, itemIndex) => itemIndex !== index), acceptedAt: null })}>×</button></td>
    </tr>)}</tbody></table></div>
    <div className="context-actions">
      <button type="button" className="button primary" disabled={!allPassed} onClick={() => update({ ...validation, acceptedAt: new Date().toISOString().slice(0, 10) })}>{label('Aceptar validación', 'Accept validation')}</button>
      <span>{validation.acceptedAt ? `${label('Aceptada', 'Accepted')}: ${validation.acceptedAt}` : label('Sin aceptar', 'Not accepted')}</span>
    </div>
  </Section>
}

export function OpportunityDecisionPlanTab({
  opportunity,
  save,
  partners,
}: {
  opportunity: OpportunityV2
  save: Save
  partners: AccountPartner[]
}) {
  const { lang } = useI18n()
  const label = (es: string, en: string) => lang === 'es' ? es : en
  const today = new Date().toISOString().slice(0, 10)
  const plan = opportunity.decisionPlan ?? { steps: [], partnerIds: [] }
  const update = (next: NonNullable<OpportunityV2['decisionPlan']>) => save({ ...opportunity, decisionPlan: next })
  const addStep = () => update({
    ...plan,
    steps: [...plan.steps, { id: `decision-${Date.now()}`, step: '', owner: '', date: null, done: false }],
  })
  const updateStep = (index: number, patch: Partial<typeof plan.steps[number]>) => update({
    ...plan,
    steps: plan.steps.map((step, itemIndex) => itemIndex === index ? { ...step, ...patch } : step),
  })
  return <Section title={label('Plan de decisión', 'Decision plan')} eyebrow={label('Plan de acción mutuo', 'Mutual action plan')}>
    <div className="prp-tier-heading">
      <h3>{label('Pasos', 'Steps')}</h3>
      <button type="button" className="button secondary" onClick={addStep}>{label('Añadir paso', 'Add step')}</button>
    </div>
    <div className="decision-plan-steps">{plan.steps.map((step, index) => {
      const overdue = Boolean(step.date && step.date < today && !step.done)
      return <article className={`decision-plan-step${overdue ? ' overdue' : ''}`} key={step.id}>
        <label><input type="checkbox" checked={step.done} onChange={(event) => updateStep(index, { done: event.target.checked })} />{label('Completado', 'Done')}</label>
        <input aria-label={label('Paso', 'Step')} value={step.step} onChange={(event) => updateStep(index, { step: event.target.value })} />
        <input aria-label={label('Responsable', 'Owner')} value={step.owner} onChange={(event) => updateStep(index, { owner: event.target.value })} />
        <input aria-label={label('Fecha', 'Date')} type="date" value={step.date || ''} onChange={(event) => updateStep(index, { date: event.target.value || null })} />
        {overdue && <span>{label('Vencido', 'Overdue')}</span>}
        <button type="button" className="button ghost" onClick={() => update({ ...plan, steps: plan.steps.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
      </article>
    })}</div>
    <label>{label('Partners implicados', 'Partners involved')}
      <select multiple value={plan.partnerIds} onChange={(event) => update({ ...plan, partnerIds: [...event.currentTarget.selectedOptions].map((option) => option.value) })}>
        {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
      </select>
    </label>
    {plan.partnerIds.length > 0 && <p>{plan.partnerIds.map((partnerId) => partners.find((partner) => partner.id === partnerId)?.name || partnerId).join(', ')}</p>}
  </Section>
}

export function AccountPartnersTab({ partners }: { partners: AccountPartner[] }) {
  const { lang } = useI18n()
  const label = (es: string, en: string) => lang === 'es' ? es : en
  return <Section title={label('Partners', 'Partners')} eyebrow={label('Relaciones documentadas', 'Documented relationships')}>
    {partners.length ? <div className="table-wrap"><table><thead><tr>
      <th>{label('Partner', 'Partner')}</th><th>{label('Tipo', 'Type')}</th><th>{label('Relación', 'Relationship')}</th>
      <th>{label('Proyectos', 'Projects')}</th><th>{label('Contacto de acceso', 'Door opener')}</th><th>{label('Notas', 'Notes')}</th><th>{label('Fuente', 'Source')}</th>
    </tr></thead><tbody>{partners.map((partner) => <tr key={partner.id}>
      <td>{partner.name}</td><td>{partner.type}</td><td>{partner.relationship}</td><td>{partner.projects.join(', ') || '—'}</td>
      <td>{partner.doorOpenerStakeholderId || '—'}</td><td>{partner.notes || '—'}</td><td>{partner.source}</td>
    </tr>)}</tbody></table></div> : <p className="muted">{label('No hay partners registrados.', 'No partners registered.')}</p>}
  </Section>
}
