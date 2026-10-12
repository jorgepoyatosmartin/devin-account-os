import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TerritoryPlan } from '../accounts/registry'
import type { Dataset, OpportunityV2 } from '../types'
import { DEVIN_URL } from '../powerchart/playbooks'
import { Badge, PageHeader, Section } from '../components/ui'
import { useI18n } from '../i18n'
import { readTerritoryOverlays, saveTerritoryOverlays, type TerritoryOverlay } from '../lib/territory'
import { buildTerritoryRepoSavePrompt, type TerritoryChange } from './territoryRepoSave'

type EditableField = 'tier' | 'potentialEur' | 'effortPct' | 'priority'

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
  const role = person.powerRole || person.buyingRole
  return Boolean(role && role !== 'Unknown')
}

function isEconomicBuyer(person: Dataset['stakeholders'][number]) {
  return [person.powerRole, person.buyingRole].some((role) => role === 'Economic Buyer' || role === 'EB')
}

function isChampion(person: Dataset['stakeholders'][number]) {
  return [person.powerRole, person.buyingRole].some((role) => role?.toLowerCase().includes('champion'))
}

function toEur(opportunity: OpportunityV2, fxEurUsd: number) {
  if (opportunity.amount == null) return 0
  return opportunity.currency === 'USD' ? opportunity.amount / fxEurUsd : opportunity.amount
}

export default function TerritoryPage({
  dataset,
  opportunitiesV2,
  fxEurUsd,
}: {
  dataset: Dataset
  opportunitiesV2: OpportunityV2[]
  fxEurUsd: number
}) {
  const { t } = useI18n()
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
    const reported = people.filter((person) => ['Contacted', 'Engaged', 'Champion'].includes(person.relationshipStatus)).length
    return {
      account,
      territory,
      people,
      withRole: people.filter(hasRole).length,
      hasEconomicBuyer: people.some(isEconomicBuyer),
      hasChampion: people.some(isChampion),
      openOpps,
      pipelineEur: openOpps.reduce((sum, opportunity) => sum + toEur(opportunity, fxEurUsd), 0),
      lastTouch: lastTouchFor(people),
      coverage: people.length ? Math.round((reported / people.length) * 100) : 0,
    }
  }), [dataset.accounts, dataset.stakeholders, opportunitiesV2, fxEurUsd, overlays])

  const changed = useMemo(() => rows.flatMap(({ account, territory }) => {
    const base = account.territory
    const differs = (['tier', 'potentialEur', 'effortPct', 'priority'] as const)
      .some((field) => territory[field] !== base?.[field])
    return differs ? [{ accountId: account.id, accountName: account.name, territory } satisfies TerritoryChange] : []
  }), [rows])

  const countries = [...new Set(dataset.accounts.map((account) => account.country || account.headquarters.split(',').pop()?.trim() || '').filter(Boolean))].sort()
  const sectors = [...new Set(dataset.accounts.map((account) => account.sector).filter(Boolean))].sort()
  const tiers = [...new Set(rows.map(({ territory }) => territory.tier).filter((tier): tier is string => Boolean(tier)))].sort()
  const priorities = [...new Set(rows.map(({ territory }) => territory.priority).filter((priority): priority is number => priority != null))].sort((a, b) => a - b)
  const businessUnits = [...new Set(dataset.accounts.flatMap((account) => account.businessUnits))].sort()
  const filteredRows = rows.filter(({ account, territory }) => (
    (countryFilter === 'all' || (account.country || account.headquarters.split(',').pop()?.trim()) === countryFilter) &&
    (sectorFilter === 'all' || account.sector === sectorFilter) &&
    (tierFilter === 'all' || territory.tier === tierFilter) &&
    (priorityFilter === 'all' || String(territory.priority) === priorityFilter) &&
    (businessUnitFilter === 'all' || account.businessUnits.includes(businessUnitFilter))
  ))

  const totalPotential = rows.reduce((sum, row) => sum + (row.territory.potentialEur ?? 0), 0)
  const totalPipeline = rows.reduce((sum, row) => sum + row.pipelineEur, 0)
  const accountsWithoutEconomicBuyer = rows.filter((row) => !row.hasEconomicBuyer).length
  const accountsWithoutChampion = rows.filter((row) => !row.hasChampion).length

  const updateField = (accountId: string, field: EditableField, value: string) => {
    const parsed = field === 'tier' ? value || null : value === '' ? null : Number(value)
    const next = { ...overlays, [accountId]: { ...overlays[accountId], [field]: parsed } }
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
      action={<button className="button primary" disabled={!changed.length} onClick={() => setRepoOpen(true)}>Guardar en repo ({changed.length})</button>}
    />
    <div className="summary-grid territory-summary">
      <div><span>Potencial total</span><strong>{formatEur(totalPotential)}</strong></div>
      <div><span>Pipeline total</span><strong>{formatEur(totalPipeline)}</strong></div>
      <div><span>Cuentas sin EB</span><strong>{accountsWithoutEconomicBuyer}</strong></div>
      <div><span>Cuentas sin champion</span><strong>{accountsWithoutChampion}</strong></div>
    </div>
    <div className="context-actions territory-links">
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
      <div className="table-wrap territory-table">
        <table>
          <thead><tr><th>Cuenta</th><th>Tier</th><th>Potencial EUR</th><th>Esfuerzo %</th><th>Stakeholders (total / rol)</th><th>EB</th><th>Champion</th><th>Oportunidades abiertas</th><th>Pipeline EUR</th><th>Último contacto</th><th>Cobertura</th><th>Prioridad</th></tr></thead>
          <tbody>{filteredRows.map((row) => <tr key={row.account.id}>
            <td><Link to={`/accounts/${row.account.id}`}><strong>{row.account.name}</strong></Link><small>{row.account.country || row.account.headquarters}</small></td>
            <td><input aria-label={`${row.account.name} tier`} value={row.territory.tier ?? ''} onChange={(event) => updateField(row.account.id, 'tier', event.target.value)} placeholder="—" /></td>
            <td><input aria-label={`${row.account.name} potencial`} type="number" value={row.territory.potentialEur ?? ''} onChange={(event) => updateField(row.account.id, 'potentialEur', event.target.value)} placeholder="—" /></td>
            <td><input aria-label={`${row.account.name} esfuerzo`} type="number" value={row.territory.effortPct ?? ''} onChange={(event) => updateField(row.account.id, 'effortPct', event.target.value)} placeholder="—" /></td>
            <td>{row.people.length} / {row.withRole}</td>
            <td>{row.hasEconomicBuyer ? <Badge>Identificado</Badge> : '—'}</td>
            <td>{row.hasChampion ? <Badge>Identificado</Badge> : '—'}</td>
            <td>{row.openOpps.length}</td>
            <td>{formatEur(row.pipelineEur)}</td>
            <td>{row.lastTouch}</td>
            <td>{row.coverage}%</td>
            <td><input aria-label={`${row.account.name} prioridad`} type="number" value={row.territory.priority ?? ''} onChange={(event) => updateField(row.account.id, 'priority', event.target.value)} placeholder="—" /></td>
          </tr>)}</tbody>
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
