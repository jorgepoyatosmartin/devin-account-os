import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { products, pgScoreConfig, salesPlays } from '../config'
import { useI18n } from '../i18n'
import type { Dataset, Hypothesis, OpportunityV2, PgScoreInputs, Signal } from '../types'
import { Badge, Section } from '../components/ui'
import { convertDiscoveryToOpportunity, hypothesisConversion } from './convert'
import { pgScore } from './score'
import './discovery.css'

type SignalMeta = Partial<Pick<Signal, 'productIds' | 'salesPlayId' | 'scoreInputs'>>

export function DiscoveryWorkflow({
  dataset,
  hypotheses,
  upsertSignalMeta,
  upsertHypothesis,
  upsertOpportunityV2,
}: {
  dataset: Dataset
  hypotheses: Hypothesis[]
  upsertSignalMeta: (id: string, patch: SignalMeta) => void
  upsertHypothesis: (hypothesis: Hypothesis) => void
  upsertOpportunityV2: (opportunity: OpportunityV2) => void
}) {
  const { lang } = useI18n()
  const [draft, setDraft] = useState<Hypothesis | null>(null)
  const label = (es: string, en: string) => lang === 'es' ? es : en
  const accountScore = useMemo(() => {
    const result: Record<string, number> = {}
    for (const hypothesis of hypotheses) {
      const score = Math.max(0, ...dataset.signals
        .filter((signal) => signal.accountId === hypothesis.accountId && hypothesis.signalIds.includes(signal.id))
        .map((signal) => pgScore(signal.scoreInputs || {}, pgScoreConfig.weights) || 0))
      result[hypothesis.accountId] = Math.max(result[hypothesis.accountId] || 0, score)
    }
    return result
  }, [dataset.signals, hypotheses])
  const grouped = [...new Set(hypotheses.map((hypothesis) => hypothesis.accountId))]
    .sort((left, right) => (accountScore[right] || 0) - (accountScore[left] || 0))

  const beginHypothesis = (signal: Signal) => {
    setDraft({
      id: `hyp-${signal.id}-${Date.now()}`,
      accountId: signal.accountId,
      title: signal.signal,
      whyChange: '',
      whyNow: signal.signal,
      whyUs: '',
      valueEstimate: { amount: null, assumptions: '' },
      stakeholderIds: [],
      routeToMarket: 'direct',
      nextBestAction: '',
      status: 'hypothesis',
      signalIds: [signal.id],
      source: 'PG signal discovery',
      verifiedAt: null,
      productIds: signal.productIds || [],
      salesPlayId: signal.salesPlayId,
    })
  }

  const saveHypothesis = (event: React.FormEvent) => {
    event.preventDefault()
    if (draft) upsertHypothesis({
      ...draft,
      verifiedAt: draft.status === 'validated' ? (draft.verifiedAt || new Date().toISOString()) : draft.verifiedAt,
    })
    setDraft(null)
  }

  const convert = (hypothesis: Hypothesis) => {
    upsertOpportunityV2(convertDiscoveryToOpportunity(hypothesisConversion(hypothesis, new Date().toISOString().slice(0, 10)), dataset.stakeholders))
    upsertHypothesis({ ...hypothesis, status: 'converted' })
  }

  return <>
    <Section title={label('Señales puntuadas', 'Scored signals')} eyebrow={label('Enriquecimiento local', 'Local enrichment')}>
      <div className="discovery-signal-list">{dataset.signals.map((signal) => {
        const score = pgScore(signal.scoreInputs || {}, pgScoreConfig.weights)
        const inputs = signal.scoreInputs || {}
        const setInput = (key: keyof PgScoreInputs, value: string) => {
          const next = { ...inputs }
          if (value) next[key] = Number(value)
          else delete next[key]
          upsertSignalMeta(signal.id, { scoreInputs: next })
        }
        return <article className="discovery-signal" key={signal.id}>
          <div><Link to={`/accounts/${signal.accountId}`}><strong>{dataset.accounts.find((account) => account.id === signal.accountId)?.name || signal.accountId}</strong></Link><h3>{signal.signal}</h3><p>{signal.cognitionRelevance}</p><small>{signal.date} · {signal.source}</small></div>
          <div className="discovery-fields">
            <label>{label('Productos', 'Products')}<select multiple value={signal.productIds || []} onChange={(event) => upsertSignalMeta(signal.id, { productIds: [...event.currentTarget.selectedOptions].map((option) => option.value) })}>{products.map((product) => <option key={product.id} value={product.id}>{product.id}</option>)}</select></label>
            <label>{label('Sales play', 'Sales play')}<select value={signal.salesPlayId || ''} onChange={(event) => upsertSignalMeta(signal.id, { salesPlayId: event.target.value || undefined })}><option value="">{label('Sin asignar', 'Unset')}</option>{salesPlays.map((play) => <option key={play.id} value={play.id}>{play.id}</option>)}</select></label>
            <div className="discovery-score-inputs">{(['fit', 'signals', 'access', 'economic', 'urgency'] as const).map((key) => <label key={key}>{label(({ fit: 'Ajuste', signals: 'Señales', access: 'Acceso', economic: 'Económico', urgency: 'Urgencia' })[key], key)}<select value={inputs[key] ?? ''} onChange={(event) => setInput(key, event.target.value)}><option value="">—</option>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>)}</div>
            <Badge>{score == null ? label('Sin puntuar', 'Unscored') : `${score.toFixed(1)} / 100`}</Badge>
            <button className="button secondary" onClick={() => beginHypothesis(signal)}>{label('Crear hipótesis', 'Create hypothesis')}</button>
          </div>
        </article>
      })}</div>
    </Section>

    <Section title={label('Hipótesis', 'Hypotheses')} eyebrow={label('Descubrimiento de oportunidades', 'Opportunity discovery')}>
      {grouped.map((accountId) => <div className="hypothesis-account" key={accountId}>
        <h3>{dataset.accounts.find((account) => account.id === accountId)?.name || accountId} · {label('score máx.', 'max score')} {accountScore[accountId] || 0}</h3>
        {hypotheses.filter((hypothesis) => hypothesis.accountId === accountId).map((hypothesis) => <article className="hypothesis-card" key={hypothesis.id}>
          <div><strong>{hypothesis.title}</strong><Badge>{hypothesis.status === 'validated' ? label('Validada', 'Validated') : label('Hipótesis', 'Hypothesis')}</Badge><p>{hypothesis.whyChange} · {hypothesis.whyNow}</p>{hypothesis.signalIds.map((signalId) => <small key={signalId}>{dataset.signals.find((signal) => signal.id === signalId)?.signal || signalId}</small>)}</div>
          <div className="context-actions"><button className="button secondary" onClick={() => setDraft(hypothesis)}>{label('Editar', 'Edit')}</button>{hypothesis.status === 'hypothesis' && <button className="button secondary" onClick={() => upsertHypothesis({ ...hypothesis, status: 'validated', verifiedAt: new Date().toISOString() })}>{label('Validar', 'Validate')}</button>}{hypothesis.status === 'validated' && <button className="button primary" onClick={() => convert(hypothesis)}>{label('Convertir en oportunidad', 'Convert to opportunity')}</button>}</div>
        </article>)}
      </div>)}
      {!hypotheses.length && <p className="muted">{label('Aún no hay hipótesis.', 'No hypotheses yet.')}</p>}
    </Section>

    {draft && <div className="modal-backdrop"><form className="modal-card hypothesis-form" onSubmit={saveHypothesis}>
      <h2>{label('Crear hipótesis', 'Create hypothesis')}</h2>
      <p>{dataset.accounts.find((account) => account.id === draft.accountId)?.name || draft.accountId} · {draft.signalIds.map((signalId) => dataset.signals.find((signal) => signal.id === signalId)?.signal || signalId).join(', ')}</p>
      <label>{label('Título', 'Title')}<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>Why Change<textarea value={draft.whyChange} onChange={(event) => setDraft({ ...draft, whyChange: event.target.value })} /></label>
      <label>Why Now<textarea value={draft.whyNow} onChange={(event) => setDraft({ ...draft, whyNow: event.target.value })} /></label>
      <label>Why Us<textarea value={draft.whyUs} onChange={(event) => setDraft({ ...draft, whyUs: event.target.value })} /></label>
      <label>{label('Importe estimado', 'Estimated value')}<input type="number" value={draft.valueEstimate.amount ?? ''} onChange={(event) => setDraft({ ...draft, valueEstimate: { ...draft.valueEstimate, amount: event.target.value === '' ? null : Number(event.target.value) } })} /></label>
      <label>{label('Supuestos', 'Assumptions')}<textarea value={draft.valueEstimate.assumptions} onChange={(event) => setDraft({ ...draft, valueEstimate: { ...draft.valueEstimate, assumptions: event.target.value } })} /></label>
      <fieldset><legend>{label('Stakeholders', 'Stakeholders')}</legend>{dataset.stakeholders.filter((person) => person.accountId === draft.accountId).map((person) => <label key={person.id}><input type="checkbox" checked={draft.stakeholderIds.includes(person.id)} onChange={() => setDraft({ ...draft, stakeholderIds: draft.stakeholderIds.includes(person.id) ? draft.stakeholderIds.filter((id) => id !== person.id) : [...draft.stakeholderIds, person.id] })} />{person.name}</label>)}</fieldset>
      <label>{label('Productos', 'Products')}<select multiple value={draft.productIds} onChange={(event) => setDraft({ ...draft, productIds: [...event.currentTarget.selectedOptions].map((option) => option.value) })}>{products.map((product) => <option key={product.id} value={product.id}>{product.id}</option>)}</select></label>
      <label>{label('Sales play', 'Sales play')}<select value={draft.salesPlayId || ''} onChange={(event) => setDraft({ ...draft, salesPlayId: event.target.value || undefined })}><option value="">{label('Sin asignar', 'Unset')}</option>{salesPlays.map((play) => <option key={play.id} value={play.id}>{play.id}</option>)}</select></label>
      <label>{label('Ruta al mercado', 'Route to market')}<select value={draft.routeToMarket} onChange={(event) => setDraft({ ...draft, routeToMarket: event.target.value as Hypothesis['routeToMarket'] })}><option value="direct">Direct</option><option value="partner">Partner</option><option value="hyperscaler">Hyperscaler</option></select></label>
      <label>{label('Próxima mejor acción', 'Next best action')}<textarea value={draft.nextBestAction} onChange={(event) => setDraft({ ...draft, nextBestAction: event.target.value })} /></label>
      <label>{label('Estado', 'Status')}<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Hypothesis['status'] })}><option value="hypothesis">Hypothesis</option><option value="validated">Validated</option><option value="discarded">Discarded</option></select></label>
      <div className="context-actions"><button type="button" className="button secondary" onClick={() => setDraft(null)}>{label('Cancelar', 'Cancel')}</button><button className="button primary" type="submit">{label('Guardar hipótesis', 'Save hypothesis')}</button></div>
    </form></div>}
  </>
}
