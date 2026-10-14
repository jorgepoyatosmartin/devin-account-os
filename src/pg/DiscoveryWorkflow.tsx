import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { products, pgScoreConfig, salesPlays } from '../config'
import { useI18n } from '../i18n'
import type { Dataset, Hypothesis, OpportunityV2, PgScoreInputs, Signal } from '../types'
import { Badge, Section } from '../components/ui'
import { convertDiscoveryToOpportunity, hypothesisConversion } from './convert'
import { pgScore } from './score'
import { API_URL, AUTH_KEY, api, getHealth } from '../server/api'
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
  const [signalAccountId, setSignalAccountId] = useState('')
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null)
  const [openAiEnabled, setOpenAiEnabled] = useState(false)
  const [analysis, setAnalysis] = useState<{ signalId: string; result: { products: string[]; salesPlayId: string | null; relevance: number; rationale: string; hypothesis: { whyChange: string; whyNow: string; whyUs: string }; nextBestAction: { stakeholderId: string | null; action: string }; assumptions: string[] } } | null>(null)
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const hypothesisFormRef = useRef<HTMLFormElement>(null)
  const label = (es: string, en: string) => lang === 'es' ? es : en
  const isHypothesisFormOpen = draft !== null
  useEffect(() => {
    if (!API_URL || !localStorage.getItem(AUTH_KEY)) return
    getHealth().then((health) => setOpenAiEnabled(health.features.openai)).catch(() => setOpenAiEnabled(false))
  }, [])
  useEffect(() => {
    if (!isHypothesisFormOpen) return
    const frame = requestAnimationFrame(() => {
      hypothesisFormRef.current?.scrollIntoView({ block: 'center' })
      hypothesisFormRef.current?.querySelector<HTMLInputElement>('input:not([type="checkbox"])')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [isHypothesisFormOpen])
  const signalScore = (signal: Signal) => pgScore(signal.scoreInputs || {}, pgScoreConfig.weights)
  const scoredSignals = [...dataset.signals]
    .filter((signal) => !signalAccountId || signal.accountId === signalAccountId)
    .sort((left, right) => {
      const scoreDiff = (signalScore(right) ?? -1) - (signalScore(left) ?? -1)
      return scoreDiff || (Date.parse(right.date) || 0) - (Date.parse(left.date) || 0)
    })
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

  const analyze = async (signal: Signal) => {
    setAnalysisBusy(true)
    setAnalysis(null)
    try {
      const result = await api<NonNullable<typeof analysis>['result']>('/llm/signal-analysis', {
        method: 'POST',
        body: JSON.stringify({
          signal,
          account: dataset.accounts.find((item) => item.id === signal.accountId),
          stakeholders: dataset.stakeholders.filter((person) => person.accountId === signal.accountId).map((person) => ({
            id: person.id,
            name: person.name,
            title: person.title,
            businessUnit: person.businessUnit,
            role: person.powerRole || person.buyingRole,
          })),
          catalog: {
            products: products.map((product) => ({ id: product.id, name: product.id })),
            salesPlays: salesPlays.map((play) => ({ id: play.id, name: play.id })),
          },
          language: lang,
        }),
      })
      setAnalysis({ signalId: signal.id, result })
    } catch {
      setAnalysis(null)
    } finally {
      setAnalysisBusy(false)
    }
  }

  const createAiHypothesis = (signal: Signal) => {
    const result = analysis?.result
    if (!result) return
    beginHypothesis(signal)
    setDraft((current) => current ? {
      ...current,
      whyChange: result.hypothesis.whyChange,
      whyNow: result.hypothesis.whyNow,
      whyUs: result.hypothesis.whyUs,
      productIds: result.products,
      salesPlayId: result.salesPlayId || undefined,
      valueEstimate: { ...current.valueEstimate, assumptions: result.assumptions.join('\n') },
      nextBestAction: result.nextBestAction.action,
      stakeholderIds: result.nextBestAction.stakeholderId ? [result.nextBestAction.stakeholderId] : [],
    } : current)
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
    <Section title={label('Hipótesis', 'Hypotheses')} eyebrow={label('Descubrimiento de oportunidades', 'Opportunity discovery')}>
      {grouped.map((accountId) => <div className="hypothesis-account" key={accountId}>
        <h3>{dataset.accounts.find((account) => account.id === accountId)?.name || accountId} · {label('score máx.', 'max score')} {accountScore[accountId] || 0}</h3>
        {hypotheses.filter((hypothesis) => hypothesis.accountId === accountId).map((hypothesis) => <article className="hypothesis-card" key={hypothesis.id}>
          <div><strong>{hypothesis.title}</strong><Badge>{hypothesis.status === 'converted' ? label('Convertida', 'Converted') : hypothesis.status === 'validated' ? label('Validada', 'Validated') : hypothesis.status === 'discarded' ? label('Descartada', 'Discarded') : label('Hipótesis', 'Hypothesis')}</Badge><p>{hypothesis.whyChange} · {hypothesis.whyNow}</p>{hypothesis.signalIds.map((signalId) => <small key={signalId}>{dataset.signals.find((signal) => signal.id === signalId)?.signal || signalId}</small>)}{hypothesis.status === 'converted' && <Link to={`/opportunities/opp-${hypothesis.id}?tab=Origin`}>{label('Abrir oportunidad', 'Open opportunity')} →</Link>}</div>
          <div className="context-actions"><button className="button secondary" onClick={() => setDraft(hypothesis)}>{label('Editar', 'Edit')}</button>{hypothesis.status === 'hypothesis' && <button className="button secondary" onClick={() => upsertHypothesis({ ...hypothesis, status: 'validated', verifiedAt: new Date().toISOString() })}>{label('Validar', 'Validate')}</button>}{hypothesis.status === 'validated' && <button className="button primary" onClick={() => convert(hypothesis)}>{label('Convertir en oportunidad', 'Convert to opportunity')}</button>}</div>
        </article>)}
      </div>)}
      {!hypotheses.length && <p className="muted">{label('Aún no hay hipótesis.', 'No hypotheses yet.')}</p>}
    </Section>

    <Section title={label('Señales puntuadas', 'Scored signals')} eyebrow={label('Enriquecimiento local', 'Local enrichment')}>
      <div className="discovery-toolbar"><label>{label('Cuenta', 'Account')}<select value={signalAccountId} onChange={(event) => setSignalAccountId(event.target.value)}><option value="">{label('Todas las cuentas', 'All accounts')}</option>{dataset.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><small>{scoredSignals.length} {label('señales', 'signals')}</small></div>
      <div className="table-wrap"><table className="discovery-table"><thead><tr>
        <th>{label('Cuenta', 'Account')}</th><th>{label('Fecha', 'Date')}</th><th>{label('Señal', 'Signal')}</th><th>{label('Sales play', 'Sales play')}</th><th>{label('Productos', 'Products')}</th><th>Score</th><th>{label('Acciones', 'Actions')}</th>
      </tr></thead><tbody>{scoredSignals.map((signal) => {
        const score = signalScore(signal)
        const inputs = signal.scoreInputs || {}
        const setInput = (key: keyof PgScoreInputs, value: number | undefined) => {
          const next = { ...inputs }
          if (value == null) delete next[key]
          else next[key] = value
          upsertSignalMeta(signal.id, { scoreInputs: next })
        }
        return <Fragment key={signal.id}>
          <tr>
            <td><Link to={`/accounts/${signal.accountId}`}>{dataset.accounts.find((account) => account.id === signal.accountId)?.name || signal.accountId}</Link></td>
            <td>{signal.date}</td><td className="discovery-signal-cell" title={signal.signal}>{signal.signal}</td>
            <td>{salesPlays.find((play) => play.id === signal.salesPlayId)?.id || signal.salesPlayId || '—'}</td>
            <td>{(signal.productIds || []).map((id) => products.find((product) => product.id === id)?.id || id).join(', ') || '—'}</td>
            <td><Badge>{score == null ? '—' : score.toFixed(1)}</Badge></td>
            <td className="discovery-actions"><button className="button secondary" onClick={() => setExpandedSignalId(expandedSignalId === signal.id ? null : signal.id)}>{label('Puntuar', 'Score')}</button><button className="button secondary" onClick={() => beginHypothesis(signal)}>{label('Crear hipótesis', 'Create hypothesis')}</button>{API_URL && localStorage.getItem(AUTH_KEY) && openAiEnabled && <button className="button secondary" disabled={analysisBusy} onClick={() => analyze(signal)}>{label('Analizar con IA', 'Analyze with AI')}</button>}</td>
          </tr>
          {expandedSignalId === signal.id && <tr className="discovery-editor-row"><td colSpan={7}><div className="discovery-editor">
            <div className="discovery-segments">{(['fit', 'signals', 'access', 'economic', 'urgency'] as const).map((key) => <div className="discovery-segment" key={key}>
              <strong>{label(({ fit: 'Fit', signals: 'Señales', access: 'Acceso', economic: 'Económico', urgency: 'Urgencia' })[key], ({ fit: 'Fit', signals: 'Signals', access: 'Access', economic: 'Economic', urgency: 'Urgency' })[key])}</strong>
              <small>{label('Peso', 'Weight')} {pgScoreConfig.weights[key]}</small>
              <div>{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} aria-pressed={inputs[key] === value} className={inputs[key] === value ? 'selected' : ''} onClick={() => setInput(key, value)}>{value}</button>)}</div>
            </div>)}</div>
            <div className="discovery-enrichment">
              <label>{label('Sales play', 'Sales play')}<select value={signal.salesPlayId || ''} onChange={(event) => upsertSignalMeta(signal.id, { salesPlayId: event.target.value || undefined })}><option value="">{label('Sin asignar', 'Unset')}</option>{salesPlays.map((play) => <option key={play.id} value={play.id}>{play.id}</option>)}</select></label>
              <label>{label('Productos', 'Products')}<select multiple value={signal.productIds || []} onChange={(event) => upsertSignalMeta(signal.id, { productIds: [...event.currentTarget.selectedOptions].map((option) => option.value) })}>{products.map((product) => <option key={product.id} value={product.id}>{product.id}</option>)}</select></label>
            </div>
          </div></td></tr>}
          {analysis?.signalId === signal.id && <tr><td colSpan={7}><div className="ai-block"><strong>{label('Análisis IA', 'AI analysis')} · {analysis.result.relevance}/5</strong><p>{analysis.result.rationale}</p><p>{analysis.result.hypothesis.whyChange} · {analysis.result.hypothesis.whyNow} · {analysis.result.hypothesis.whyUs}</p><p>{label('Productos', 'Products')}: {analysis.result.products.join(', ') || '—'} · {label('Sales play', 'Sales play')}: {analysis.result.salesPlayId || '—'}</p><p>{label('Próxima acción', 'Next best action')}: {analysis.result.nextBestAction.action}</p>{analysis.result.assumptions.length > 0 && <small>{label('Supuestos', 'Assumptions')}: {analysis.result.assumptions.join(' · ')}</small>}<div><button className="button secondary" onClick={() => createAiHypothesis(signal)}>{label('Crear hipótesis', 'Create hypothesis')}</button></div></div></td></tr>}
        </Fragment>
      })}</tbody></table></div>
    </Section>

    {draft && <div className="hypothesis-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null) }}>
      <form ref={hypothesisFormRef} className="hypothesis-form" role="dialog" aria-modal="true" aria-labelledby="hypothesis-form-title" onSubmit={saveHypothesis}>
      <h2 id="hypothesis-form-title">{label('Crear hipótesis', 'Create hypothesis')}</h2>
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
      </form>
    </div>}
  </>
}
