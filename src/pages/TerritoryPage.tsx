import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TerritoryPlan } from '../accounts/registry'
import { stagesConfig, territoryEffortConfig } from '../config'
import type { CompPlan, Dataset, Hypothesis, MeetingNote, OpportunityV2 } from '../types'
import { DEVIN_URL } from '../powerchart/playbooks'
import { Badge, PageHeader, Section } from '../components/ui'
import { useI18n } from '../i18n'
import { readTerritoryOverlays, saveTerritoryOverlays, type TerritoryOverlay } from '../lib/territory'
import { actualEffort, coverageFor, effortSum, suggestEffort } from '../lib/territoryEffort'
import { prp } from '../prp/engine'
import { buildTerritoryRepoSavePrompt, type TerritoryChange } from './territoryRepoSave'

type EditableField = 'tier' | 'potentialEur' | 'effortPct' | 'effortReason' | 'priority'

function formatEur(value: number | null) {
  return value == null ? '—' : new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function lastTouchFor(people: Dataset['stakeholders']) {
  const dates = people.map((person) => person.lastTouch).filter((value): value is string => Boolean(value)).sort()
  return dates[dates.length - 1] ?? '—'
}

function hasRole(person: Dataset['stakeholders'][number]) {
  if (person.departed === true) return false
  const role = person.powerRole || person.buyingRole
  return Boolean(role && role !== 'Unknown')
}

function isEconomicBuyer(person: Dataset['stakeholders'][number]) {
  return person.departed !== true && [person.powerRole, person.buyingRole].some((role) => role === 'Economic Buyer' || role === 'EB')
}

function isChampion(person: Dataset['stakeholders'][number]) {
  return person.departed !== true && [person.powerRole, person.buyingRole].some((role) => role?.toLowerCase().includes('champion'))
}

function toEur(opportunity: OpportunityV2, fxEurUsd: number): number | null {
  if (opportunity.amount == null) return null
  return opportunity.currency === 'USD' ? opportunity.amount / fxEurUsd : opportunity.amount
}

export default function TerritoryPage({
  dataset,
  opportunitiesV2,
  fxEurUsd,
  compPlan,
  hypotheses,
  meetingNotes,
}: {
  dataset: Dataset
  opportunitiesV2: OpportunityV2[]
  fxEurUsd: number
  compPlan: CompPlan | null
  hypotheses: Hypothesis[]
  meetingNotes: MeetingNote[]
}) {
  const { t } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const [overlays, setOverlays] = useState<TerritoryOverlay>(readTerritoryOverlays)
  const [countryFilter, setCountryFilter] = useState('all')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [businessUnitFilter, setBusinessUnitFilter] = useState('all')
  const [repoOpen, setRepoOpen] = useState(false)
  const [toast, setToast] = useState('')

  const rows = useMemo(() => dataset.accounts.map((account) => {
    const people = dataset.stakeholders.filter((person) => person.accountId === account.id)
    const territory = { ...account.territory, ...overlays[account.id] } as TerritoryPlan
    const openOpps = opportunitiesV2.filter((opportunity) => opportunity.accountId === account.id && opportunity.status === 'open')
    const coverage = coverageFor(people, territoryEffortConfig)
    return {
      account,
      territory,
      people,
      coverage,
      withRole: people.filter(hasRole).length,
      hasEconomicBuyer: people.some(isEconomicBuyer),
      hasChampion: people.some(isChampion),
      openOpps,
      pipelineEur: (() => {
        const values = openOpps.flatMap((opportunity) => {
        const amount = toEur(opportunity, fxEurUsd)
        return amount === null ? [] : [amount]
        })
        return values.length ? values.reduce((sum, amount) => sum + amount, 0) : null
      })(),
      lastTouch: lastTouchFor(people),
    }
  }), [dataset.accounts, dataset.stakeholders, opportunitiesV2, fxEurUsd, overlays])

  const suggestedEffortByAccount = useMemo(() => suggestEffort(rows.map(({ account, territory, pipelineEur }) => ({
    accountId: account.id,
    tier: territory.tier,
    potentialEur: territory.potentialEur,
    pipelineEur,
  })), territoryEffortConfig), [rows])
  const actualEffortByAccount = useMemo(() => actualEffort(
    rows.map(({ account }) => account.id),
    { pg: dataset.pg, hypotheses, meetingNotes },
    today,
    territoryEffortConfig,
  ), [rows, dataset.pg, hypotheses, meetingNotes, today])
  const rowsWithEffort = useMemo(() => rows.map((row) => ({
    ...row,
    suggestedEffort: suggestedEffortByAccount[row.account.id] ?? null,
    actualEffortPct: actualEffortByAccount.pct[row.account.id] ?? null,
  })), [rows, suggestedEffortByAccount, actualEffortByAccount])
  const forecast = useMemo(() => compPlan
    ? prp(opportunitiesV2, compPlan, Object.fromEntries(stagesConfig.map((stage) => [stage.id, stage.probability])), today)
    : null, [compPlan, opportunitiesV2, today])
  const plannedManualEffort = Object.fromEntries(rows.map(({ account, territory }) => [account.id, territory.effortPct]))
  const manualEffortTotal = effortSum(plannedManualEffort)

  const changed = useMemo(() => rows.flatMap(({ account, territory }) => {
    const base = account.territory
    const differs = (['tier', 'potentialEur', 'effortPct', 'effortReason', 'priority'] as const)
      .some((field) => territory[field] !== base?.[field])
    return differs ? [{ accountId: account.id, accountName: account.name, territory } satisfies TerritoryChange] : []
  }), [rows])

  const countries = [...new Set(dataset.accounts.map((account) => account.country || account.headquarters.split(',').pop()?.trim() || '').filter(Boolean))].sort()
  const sectors = [...new Set(dataset.accounts.map((account) => account.sector).filter(Boolean))].sort()
  const tiers = [...new Set(rows.map(({ territory }) => territory.tier).filter((tier): tier is string => Boolean(tier)))].sort()
  const priorities = [...new Set(rows.map(({ territory }) => territory.priority).filter((priority): priority is number => priority != null))].sort((a, b) => a - b)
  const businessUnits = [...new Set(dataset.accounts.flatMap((account) => account.businessUnits))].sort()
  const filteredRows = rowsWithEffort.filter(({ account, territory }) => (
    (countryFilter === 'all' || (account.country || account.headquarters.split(',').pop()?.trim()) === countryFilter) &&
    (sectorFilter === 'all' || account.sector === sectorFilter) &&
    (tierFilter === 'all' || territory.tier === tierFilter) &&
    (priorityFilter === 'all' || String(territory.priority) === priorityFilter) &&
    (businessUnitFilter === 'all' || account.businessUnits.includes(businessUnitFilter))
  ))

  const potentialValues = rows.flatMap((row) => row.territory.potentialEur == null ? [] : [row.territory.potentialEur])
  const pipelineValues = rows.flatMap((row) => row.pipelineEur == null ? [] : [row.pipelineEur])
  const totalPotential = potentialValues.length ? potentialValues.reduce((sum, value) => sum + value, 0) : null
  const totalPipeline = pipelineValues.length ? pipelineValues.reduce((sum, value) => sum + value, 0) : null
  const accountsWithoutEconomicBuyer = rows.filter((row) => !row.hasEconomicBuyer).length
  const accountsWithoutChampion = rows.filter((row) => !row.hasChampion).length

  const updateField = (accountId: string, field: EditableField, value: string) => {
    const parsed = field === 'tier' ? value || null
      : field === 'effortReason' ? value
        : value === '' ? null : Number(value)
    const next = { ...overlays, [accountId]: { ...overlays[accountId], [field]: parsed } }
    setOverlays(next)
    if (!saveTerritoryOverlays(next)) setToast('No se pudo guardar el cambio en este navegador.')
  }

  const applySuggestedEffort = () => {
    const next = { ...overlays }
    for (const [accountId, value] of Object.entries(suggestedEffortByAccount)) {
      if (value !== null) next[accountId] = { ...next[accountId], effortPct: value }
    }
    setOverlays(next)
    if (!saveTerritoryOverlays(next)) setToast('No se pudo guardar el cambio en este navegador.')
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildTerritoryRepoSavePrompt(changed))
      window.open(DEVIN_URL, '_blank', 'noopener')
      setToast('Prompt copiado al portapapeles.')
      setRepoOpen(false)
    } catch {
      setToast('No se pudo copiar el prompt. Inténtalo de nuevo.')
    }
  }

  return <div className="page-stack territory-page">
    <PageHeader
      eyebrow="TERRITORIO"
      title="Territorio"
      subtitle="Cobertura, potencial y pipeline por cuenta."
      action={<div className="context-actions"><button className="button secondary" disabled={!Object.values(suggestedEffortByAccount).some((value) => value !== null)} onClick={applySuggestedEffort}>Aplicar esfuerzo sugerido</button><button className="button primary" disabled={!changed.length} onClick={() => setRepoOpen(true)}>Guardar en repo ({changed.length})</button></div>}
    />
    <div className="summary-grid territory-summary">
      <div><span>Potencial total</span><strong>{formatEur(totalPotential)}</strong></div>
      <div><span>Pipeline total</span><strong>{formatEur(totalPipeline)}</strong></div>
      <div><span>Cuentas sin EB</span><strong>{accountsWithoutEconomicBuyer}</strong></div>
      <div><span>Cuentas sin champion</span><strong>{accountsWithoutChampion}</strong></div>
      {forecast && <div><span>Pipeline que falta (objetivo personal)</span><strong>{formatEur(Math.max(forecast.pipelineGapPersonal, 0))}</strong></div>}
    </div>
    <div className="context-actions territory-links">
      <Link className="button primary" to="/import">{t('import.importCsv')}</Link>
      <Link className="button secondary" to="/stakeholders">{t('territory.stakeholders')}</Link>
      <Link className="button secondary" to="/power-charts">{t('territory.powerCharts')}</Link>
      <Link className="button secondary" to="/initiatives">{t('territory.initiatives')}</Link>
      <Link className="button secondary" to="/use-cases">{t('territory.useCases')}</Link>
      <Link className="button secondary" to="/cross-account">{t('territory.crossAccount')}</Link>
    </div>
    <Section title="Cartera de cuentas" eyebrow={`${filteredRows.length} cuentas`}>
      <div className="filters territory-filters">
        <label>País<select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}><option value="all">Todos</option>{countries.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Sector<select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}><option value="all">Todos</option>{sectors.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Tier<select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}><option value="all">Todos</option>{tiers.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Prioridad<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">Todas</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Unidad de negocio<select value={businessUnitFilter} onChange={(event) => setBusinessUnitFilter(event.target.value)}><option value="all">Todas</option>{businessUnits.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      {!manualEffortTotal.ok && <p className="territory-effort-warning" role="status">La suma del esfuerzo es {manualEffortTotal.sum} % (debería ser 100 %).</p>}
      <div className="table-wrap territory-table">
        <table>
          <thead><tr><th>Cuenta</th><th>Tier</th><th>Potencial EUR</th><th>Esfuerzo %</th><th>Stakeholders (activos / rol)</th><th>EB</th><th>Champion</th><th>Oportunidades abiertas</th><th>Pipeline EUR</th><th>Pipeline a generar</th><th>Último contacto</th><th>Cobertura</th><th>Roles clave</th><th>Prioridad</th></tr></thead>
          <tbody>{filteredRows.map((row) => {
            const plannedEffort = row.territory.effortPct ?? row.suggestedEffort
            const deviation = row.actualEffortPct === null || plannedEffort === null ? null : row.actualEffortPct - plannedEffort
            const needsReason = row.territory.effortPct !== null
              && row.suggestedEffort !== null
              && Math.abs(row.territory.effortPct - row.suggestedEffort) >= territoryEffortConfig.deviationThresholdPp
            const pipelineToGenerate = forecast && row.suggestedEffort !== null
              ? Math.max(forecast.pipelineGapPersonal, 0) * row.suggestedEffort / 100
              : null
            return <tr key={row.account.id}>
              <td><Link to={`/accounts/${row.account.id}`}><strong>{row.account.name}</strong></Link><small>{row.account.country || row.account.headquarters}</small></td>
              <td><input aria-label={`${row.account.name} tier`} value={row.territory.tier ?? ''} onChange={(event) => updateField(row.account.id, 'tier', event.target.value)} placeholder="—" /></td>
              <td><input aria-label={`${row.account.name} potencial`} type="number" value={row.territory.potentialEur ?? ''} onChange={(event) => updateField(row.account.id, 'potentialEur', event.target.value)} placeholder="—" /></td>
              <td className="territory-effort-cell">
                <input aria-label={`${row.account.name} esfuerzo`} type="number" value={row.territory.effortPct ?? ''} onChange={(event) => updateField(row.account.id, 'effortPct', event.target.value)} placeholder={row.suggestedEffort === null ? '—' : String(row.suggestedEffort)} />
                <small className="territory-effort-meta">Sugerido {row.suggestedEffort === null ? '—' : `${row.suggestedEffort} %`} · Real {row.actualEffortPct === null ? '—' : `${row.actualEffortPct} %`}</small>
                {deviation !== null && Math.abs(deviation) >= territoryEffortConfig.deviationThresholdPp && <Badge tone="warning">{deviation > 0 ? '+' : '−'}{Math.abs(deviation)} pp</Badge>}
                {needsReason && <label className="territory-effort-reason">Motivo<input aria-label={`${row.account.name} motivo esfuerzo`} value={row.territory.effortReason} onChange={(event) => updateField(row.account.id, 'effortReason', event.target.value)} /></label>}
              </td>
              <td>{row.coverage.active} / {row.withRole}{row.coverage.departed > 0 && <small>+{row.coverage.departed} bajas</small>}</td>
              <td>{row.hasEconomicBuyer ? <Badge>Identificado</Badge> : '—'}</td>
              <td>{row.hasChampion ? <Badge>Identificado</Badge> : '—'}</td>
              <td>{row.openOpps.length}</td>
              <td>{formatEur(row.pipelineEur)}</td>
              <td>{pipelineToGenerate === null ? '—' : formatEur(pipelineToGenerate)}</td>
              <td>{row.lastTouch}</td>
              <td>{row.coverage.coveragePct}%<small>{row.coverage.contacted}/{row.coverage.active}</small></td>
              <td title={`Faltan: ${row.coverage.keyRolesMissing.join(', ') || '—'}`}>{row.coverage.keyRolesCovered.length}/{territoryEffortConfig.keyRoles.length}</td>
              <td><input aria-label={`${row.account.name} prioridad`} type="number" value={row.territory.priority ?? ''} onChange={(event) => updateField(row.account.id, 'priority', event.target.value)} placeholder="—" /></td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </Section>
    {repoOpen && <div className="territory-modal-backdrop" role="presentation" onClick={() => setRepoOpen(false)}>
      <section className="territory-modal" role="dialog" aria-modal="true" aria-labelledby="territory-repo-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="territory-repo-title">Guardar cambios territoriales en repo</h2>
        <p>El prompt actualizará únicamente los ficheros territory.yaml de las cuentas editadas.</p>
        <ul>{changed.map(({ accountId, accountName }) => <li key={accountId}>{accountName} ({accountId})</li>)}</ul>
        <div className="context-actions"><button className="button primary" onClick={copyPrompt}>Copiar prompt y abrir Devin</button><button className="button secondary" onClick={() => setRepoOpen(false)}>Cancelar</button></div>
      </section>
    </div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}
