import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Section } from '../components/ui'
import { scenariosConfig, stagesConfig } from '../config'
import { useI18n } from '../i18n'
import { downloadCompPlan, isCompPlan, readCompPlanFile } from '../lib/compPlan'
import { commissionByOpportunity } from '../prp/commission'
import { prp } from '../prp/engine'
import { prpScenario } from '../prp/scenarios'
import type { CompPlan, OpportunityV2 } from '../types'
import './prp.css'

type FourStrings = [string, string, string, string]
type TierDraft = { fromPct: string; toPct: string; rate: string }
type PlanDraft = {
  fiscalYear: string
  quotaByQuarter: FourStrings
  tiers: TierDraft[]
  renewalRate: string
  taxFactor: string
  fxEurUsd: string
  netTarget: string
  personalTargetQuarterSplit: FourStrings
  coverageMultiple: string
  avgDealSize: string
}

type Props = {
  opportunities: OpportunityV2[]
  compPlan: CompPlan | null
  setCompPlan: (plan: CompPlan | null) => void
  onToast: (message: string) => void
}

const blankFour = (): FourStrings => ['', '', '', '']
const blankTier = (): TierDraft => ({ fromPct: '', toPct: '', rate: '' })

function emptyDraft(): PlanDraft {
  return {
    fiscalYear: String(new Date().getFullYear()),
    quotaByQuarter: blankFour(),
    tiers: [blankTier()],
    renewalRate: '',
    taxFactor: '0.54',
    fxEurUsd: '1.16',
    netTarget: '',
    personalTargetQuarterSplit: ['5', '25', '30', '40'],
    coverageMultiple: '4',
    avgDealSize: '',
  }
}

function draftFromPlan(plan: CompPlan): PlanDraft {
  return {
    fiscalYear: String(plan.fiscalYear),
    quotaByQuarter: plan.quotaByQuarter.map(String) as FourStrings,
    tiers: plan.tiers.map((tier) => ({
      fromPct: String(tier.fromPct),
      toPct: tier.toPct === null ? '' : String(tier.toPct),
      rate: String(tier.rate),
    })),
    renewalRate: String(plan.renewalRate),
    taxFactor: String(plan.taxFactor),
    fxEurUsd: String(plan.fxEurUsd),
    netTarget: String(plan.netTarget),
    personalTargetQuarterSplit: plan.personalTargetQuarterSplit.map((split) => String(split * 100)) as FourStrings,
    coverageMultiple: String(plan.coverageMultiple),
    avgDealSize: String(plan.avgDealSize),
  }
}

function readNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function planFromDraft(draft: PlanDraft): CompPlan | null {
  const fiscalYear = readNumber(draft.fiscalYear)
  const quotas = draft.quotaByQuarter.map(readNumber)
  const renewalRate = readNumber(draft.renewalRate)
  const taxFactor = readNumber(draft.taxFactor)
  const fxEurUsd = readNumber(draft.fxEurUsd)
  const netTarget = readNumber(draft.netTarget)
  const quarterSplits = draft.personalTargetQuarterSplit.map(readNumber)
  const coverageMultiple = readNumber(draft.coverageMultiple)
  const avgDealSize = readNumber(draft.avgDealSize)
  if (
    fiscalYear === null || quotas.some((value) => value === null)
    || renewalRate === null || taxFactor === null || fxEurUsd === null
    || netTarget === null || quarterSplits.some((value) => value === null)
    || coverageMultiple === null || avgDealSize === null
  ) return null

  const tiers = draft.tiers.map((tier) => {
    const fromPct = readNumber(tier.fromPct)
    const toPct = tier.toPct.trim() ? readNumber(tier.toPct) : null
    const rate = readNumber(tier.rate)
    return fromPct === null || rate === null || (tier.toPct.trim() && toPct === null)
      ? null
      : { fromPct, toPct, rate }
  })
  if (tiers.some((tier) => tier === null)) return null

  const plan: CompPlan = {
    fiscalYear,
    currency: 'EUR',
    quotaByQuarter: quotas as unknown as CompPlan['quotaByQuarter'],
    tiers: tiers as CompPlan['tiers'],
    renewalRate,
    taxFactor,
    fxEurUsd,
    netTarget,
    personalTargetQuarterSplit: quarterSplits.map((value) => (value as number) / 100) as CompPlan['personalTargetQuarterSplit'],
    coverageMultiple,
    avgDealSize,
  }
  return isCompPlan(plan) ? plan : null
}

function PlanForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  onImport,
  showCancel,
}: {
  draft: PlanDraft
  setDraft: (next: PlanDraft | ((current: PlanDraft) => PlanDraft)) => void
  onSave: () => void
  onCancel?: () => void
  onImport: () => void
  showCancel: boolean
}) {
  const { t } = useI18n()
  const setScalar = (key: Exclude<keyof PlanDraft, 'quotaByQuarter' | 'tiers' | 'personalTargetQuarterSplit'>, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }
  return <form className="prp-form" onSubmit={(event) => { event.preventDefault(); onSave() }}>
    <div className="prp-form-grid">
      <label>{t('prp.fiscalYear')}<input type="number" step="1" value={draft.fiscalYear} onChange={(event) => setScalar('fiscalYear', event.target.value)} /></label>
      {draft.quotaByQuarter.map((quota, index) => <label key={index}>{t('prp.quotaQuarter', { q: index + 1 })}<input type="number" min="0" step="any" value={quota} onChange={(event) => setDraft((current) => ({ ...current, quotaByQuarter: current.quotaByQuarter.map((value, i) => i === index ? event.target.value : value) as FourStrings }))} /></label>)}
      <label>{t('prp.renewalRate')}<input type="number" min="0" step="any" value={draft.renewalRate} onChange={(event) => setScalar('renewalRate', event.target.value)} /></label>
      <label>{t('prp.taxFactor')}<input type="number" min="0" max="1" step="any" value={draft.taxFactor} onChange={(event) => setScalar('taxFactor', event.target.value)} /></label>
      <label>{t('prp.fxEurUsd')}<input type="number" min="0" step="any" value={draft.fxEurUsd} onChange={(event) => setScalar('fxEurUsd', event.target.value)} /></label>
      <label>{t('prp.netTarget')}<input type="number" min="0" step="any" value={draft.netTarget} onChange={(event) => setScalar('netTarget', event.target.value)} /></label>
      {draft.personalTargetQuarterSplit.map((split, index) => <label key={`split-${index}`}>{t('prp.quarterSplit', { q: index + 1 })}<input type="number" min="0" step="any" value={split} onChange={(event) => setDraft((current) => ({ ...current, personalTargetQuarterSplit: current.personalTargetQuarterSplit.map((value, i) => i === index ? event.target.value : value) as FourStrings }))} /></label>)}
      <label>{t('prp.coverageMultiple')}<input type="number" min="0" step="any" value={draft.coverageMultiple} onChange={(event) => setScalar('coverageMultiple', event.target.value)} /></label>
      <label>{t('prp.avgDealSize')}<input type="number" min="0" step="any" value={draft.avgDealSize} onChange={(event) => setScalar('avgDealSize', event.target.value)} /></label>
    </div>
    <div className="prp-tier-heading"><h3>{t('prp.tiers')}</h3><button type="button" className="button secondary" onClick={() => setDraft((current) => ({ ...current, tiers: [...current.tiers, blankTier()] }))}>{t('prp.addTier')}</button></div>
    <div className="prp-tier-list">
      {draft.tiers.map((tier, index) => <div className="prp-tier-row" key={index}>
        <label>{t('prp.tierFrom')}<input type="number" min="0" step="any" value={tier.fromPct} onChange={(event) => setDraft((current) => ({ ...current, tiers: current.tiers.map((item, i) => i === index ? { ...item, fromPct: event.target.value } : item) }))} /></label>
        <label>{t('prp.tierTo')}<input type="number" min="0" step="any" value={tier.toPct} onChange={(event) => setDraft((current) => ({ ...current, tiers: current.tiers.map((item, i) => i === index ? { ...item, toPct: event.target.value } : item) }))} /></label>
        <label>{t('prp.tierRate')}<input type="number" min="0" step="any" value={tier.rate} onChange={(event) => setDraft((current) => ({ ...current, tiers: current.tiers.map((item, i) => i === index ? { ...item, rate: event.target.value } : item) }))} /></label>
        <button type="button" className="button ghost" disabled={draft.tiers.length === 1} onClick={() => setDraft((current) => ({ ...current, tiers: current.tiers.filter((_, i) => i !== index) }))}>{t('prp.removeTier')}</button>
      </div>)}
    </div>
    <div className="prp-form-actions">
      <button type="submit" className="button primary">{t('prp.savePlan')}</button>
      <button type="button" className="button secondary" onClick={onImport}>{t('prp.importJson')}</button>
      {showCancel && onCancel && <button type="button" className="button ghost" onClick={onCancel}>{t('prp.cancel')}</button>}
    </div>
  </form>
}

export default function PrpPage({ opportunities, compPlan, setCompPlan, onToast }: Props) {
  const { lang, t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<PlanDraft>(() => compPlan ? draftFromPlan(compPlan) : emptyDraft())
  const [editing, setEditing] = useState(!compPlan)
  const today = new Date().toISOString().slice(0, 10)
  const stageProbabilities = useMemo(
    () => Object.fromEntries(stagesConfig.map((stage) => [stage.id, stage.probability])) as Record<string, number>,
    [],
  )
  const result = useMemo(
    () => compPlan ? prp(opportunities, compPlan, stageProbabilities, today) : null,
    [compPlan, opportunities, stageProbabilities, today],
  )
  const scenarioResults = useMemo(
    () => compPlan ? scenariosConfig.map((scenario) => prpScenario(opportunities, compPlan, stagesConfig, today, scenario)) : [],
    [compPlan, opportunities, today],
  )
  const opportunityCommissions = useMemo(
    () => compPlan ? commissionByOpportunity(opportunities, compPlan) : [],
    [compPlan, opportunities],
  )
  const formatMoney = (value: number) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
  const formatCount = (value: number) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(value)
  const save = () => {
    const plan = planFromDraft(draft)
    if (!plan) {
      onToast(t('prp.validationError'))
      return
    }
    setCompPlan(plan)
    setEditing(false)
    onToast(t('prp.planSaved'))
  }
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    try {
      setCompPlan(await readCompPlanFile(file))
      setEditing(false)
      onToast(t('prp.planImported'))
    } catch {
      onToast(t('prp.invalidPlan'))
    } finally {
      input.value = ''
    }
  }
  const importButton = <button type="button" className="button secondary" onClick={() => inputRef.current?.click()}>{t('prp.importJson')}</button>
  return <div className="prp-page">
    <input ref={inputRef} className="prp-file-input" type="file" accept="application/json,.json" onChange={importFile} />
    <PageHeader eyebrow={t('prp.eyebrow')} title={t('prp.title')} subtitle={t('prp.subtitle')} action={compPlan && !editing ? <div className="prp-header-actions">
      <button className="button secondary" onClick={() => { setDraft(draftFromPlan(compPlan)); setEditing(true) }}>{t('prp.editPlan')}</button>
      <button className="button secondary" onClick={() => downloadCompPlan(compPlan)}>{t('prp.exportJson')}</button>
      {importButton}
      <button className="button ghost" onClick={() => { setCompPlan(null); setDraft(emptyDraft()); setEditing(true); onToast(t('prp.planDeleted')) }}>{t('prp.deletePlan')}</button>
    </div> : undefined} />
    {!compPlan && <div className="prp-local-card">
      <h2>{t('prp.noPlanTitle')}</h2>
      <p>{t('prp.noPlanMessage')}</p>
      <strong>{t('prp.localOnly')}</strong>
    </div>}
    {editing && <Section title={t('prp.noPlanTitle')} eyebrow={t('prp.eyebrow')} className="prp-plan-section">
      <PlanForm
        draft={draft}
        setDraft={setDraft}
        onSave={save}
        onCancel={compPlan ? () => { setDraft(draftFromPlan(compPlan)); setEditing(false) } : undefined}
        onImport={() => inputRef.current?.click()}
        showCancel={Boolean(compPlan)}
      />
    </Section>}
    {compPlan && !editing && result && <>
      <div className="prp-plan-meta"><span>{t('prp.fiscalYearEnd', { year: result.year })}</span><span>{t('prp.today')}: {today}</span></div>
      <div className="prp-kpis">
        {[
          [t('prp.annualQuota'), formatMoney(result.annualQuota)],
          [t('prp.personalTargetSales'), formatMoney(result.personalTargetSales)],
          [t('prp.closed'), formatMoney(result.closedWonQuota)],
          [t('prp.gapToQuota'), formatMoney(result.gapToQuota)],
          [t('prp.gapToPersonal'), formatMoney(result.gapToPersonal)],
          [t('prp.pipelineTotal'), formatMoney(result.pipelineTotal)],
          [t('prp.pipelineWeighted'), formatMoney(result.pipelineWeighted)],
          [t('prp.forecastCommit'), formatMoney(result.forecastCommit)],
          [t('prp.forecastBestCase'), formatMoney(result.forecastBestCase)],
          [t('prp.requiredPipelineQuota'), formatMoney(result.pipelineRequiredQuota)],
          [t('prp.pipelineGapQuota'), formatMoney(result.pipelineGapQuota)],
          [t('prp.requiredPipelinePersonal'), formatMoney(result.pipelineRequiredPersonal)],
          [t('prp.pipelineGapPersonal'), formatMoney(result.pipelineGapPersonal)],
          [t('prp.weeklyPace'), `${formatMoney(result.weeklyPipelinePacePersonal)}${t('prp.perWeek')}`],
        ].map(([label, value]) => <div className="prp-kpi" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="prp-commission-grid">
        <Section title={t('prp.commissionClosed')}><div className="prp-commission-values"><div><span>{t('prp.gross')}</span><strong>{formatMoney(result.commissionGrossClosed)}</strong></div><div><span>{t('prp.net')}</span><strong>{formatMoney(result.commissionNetClosed)}</strong></div></div></Section>
        <Section title={t('prp.commissionCommit')}><div className="prp-commission-values"><div><span>{t('prp.gross')}</span><strong>{formatMoney(result.commissionGrossCommit)}</strong></div><div><span>{t('prp.net')}</span><strong>{formatMoney(result.commissionNetCommit)}</strong></div></div></Section>
      </div>
      <Section title={t('prp.scenarios')}>
        <div className="table-wrap"><table><thead><tr>
          <th>{t('prp.scenarios')}</th><th>{t('prp.projectedSales')}</th><th>{t('prp.gapQuota')}</th><th>{t('prp.gapPersonal')}</th>
          <th>{t('prp.pipelineRequiredPersonal')}</th><th>{t('prp.gross')}</th><th>{t('prp.net')}</th>
        </tr></thead><tbody>{scenarioResults.map((scenario) => <tr key={scenario.id}>
          <td>{scenario.label}</td><td>{formatMoney(scenario.projectedSales)}</td><td>{formatMoney(scenario.gapToQuota)}</td>
          <td>{formatMoney(scenario.gapToPersonal)}</td><td>{formatMoney(scenario.pipelineRequiredPersonal)}</td>
          <td>{formatMoney(scenario.commissionGross)}</td><td>{formatMoney(scenario.commissionNet)}</td>
        </tr>)}</tbody></table></div>
      </Section>
      <Section title={t('prp.commissionByOpportunity')}>
        <div className="table-wrap"><table><thead><tr>
          <th>{t('common.opportunity')}</th><th>{t('common.status')}</th><th>{t('prp.quotaCredit')}</th><th>{t('prp.gross')}</th><th>{t('prp.net')}</th>
        </tr></thead><tbody>{opportunityCommissions
          .map((commission) => ({ commission, opportunity: opportunities.find((item) => item.id === commission.oppId) }))
          .filter((row): row is typeof row & { opportunity: OpportunityV2 } => Boolean(row.opportunity))
          .sort((a, b) => {
            if (a.commission.status !== b.commission.status) return a.commission.status === 'won' ? -1 : 1
            if (a.commission.status === 'open') return b.commission.commissionNet - a.commission.commissionNet
            return (a.opportunity.closeDate || '').localeCompare(b.opportunity.closeDate || '')
          })
          .map(({ commission, opportunity }) => <tr key={commission.oppId}>
            <td><Link to={`/opportunities/${opportunity.id}`}>{opportunity.name}</Link></td>
            <td>{commission.status}</td>
            <td>{formatMoney(commission.quotaCredit)}</td>
            <td>{formatMoney(commission.commissionGross)}</td>
            <td>{commission.status === 'open' ? t('prp.netIfWon', { amount: formatMoney(commission.commissionNet) }) : formatMoney(commission.commissionNet)}</td>
          </tr>)}</tbody></table></div>
      </Section>
      <Section title={t('prp.quarters')} eyebrow={t('prp.fiscalYearEnd', { year: result.year })}>
        <div className="table-wrap"><table><thead><tr><th>{t('prp.quarter')}</th><th>{t('prp.quota')}</th><th>{t('prp.closedWonQuota')}</th><th>{t('prp.personalTargetQuarter')}</th><th>{t('prp.quarterPipeline')}</th></tr></thead><tbody>{result.quarters.map((quarter) => <tr key={quarter.q}><td>Q{quarter.q}</td><td>{formatMoney(quarter.quota)}</td><td>{formatMoney(quarter.closedWonQuota)}</td><td>{formatMoney(quarter.personalTarget)}</td><td>{formatMoney(quarter.pipelineTotal)}</td></tr>)}</tbody></table></div>
      </Section>
      <Section title={t('prp.backwardFunnel')}>
        <div className="prp-funnel">{[
          [t('prp.funnelWon'), result.funnelNeeded.WON],
          [t('prp.funnelBvaTv'), result.funnelNeeded.BVA_TV],
          [t('prp.funnelTfw'), result.funnelNeeded.TFW],
          [t('prp.funnelNbm'), result.funnelNeeded.NBM],
          [t('prp.funnelDm'), result.funnelNeeded.DM],
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{formatCount(Number(value))}</strong></div>)}</div>
      </Section>
      <Section title={t('prp.dataGaps')}>
        {result.oppsMissingAmount.length || result.oppsOutsideFiscalYear.length
          ? <div className="prp-gap-grid">
            {[
              { label: t('prp.missingAmount'), ids: result.oppsMissingAmount },
              { label: t('prp.outsideFiscalYear'), ids: result.oppsOutsideFiscalYear },
            ].map(({ label, ids }) => <div className="prp-gap-group" key={label}>
              <h3>{label}</h3>
              {ids.map((id) => {
                const opportunity = opportunities.find((item) => item.id === id)
                return <Link key={`${label}-${id}`} to={`/opportunities/${id}`}><span>{opportunity?.name || id}</span><small>{id}</small></Link>
              })}
            </div>)}
          </div>
          : <p className="muted">{t('prp.noGaps')}</p>}
      </Section>
    </>}
  </div>
}
