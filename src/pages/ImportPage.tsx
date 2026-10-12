import { useMemo, useState } from 'react'
import type { Account, OpportunityV2 } from '../types'
import type { Stakeholder as ChartStakeholder } from '../powerchart/model'
import { getAccountSnapshot, setAccountSnapshot } from '../powerchart/store'
import { parseCsv } from '../import/csv'
import { getImportPreset, type ImportKind, type ImportPreset } from '../import/providers'
import { planOpportunityImport, planStakeholderImport } from '../import/dedupe'
import { Section, PageHeader } from '../components/ui'
import { useI18n } from '../i18n'

type Props = {
  accounts: Account[]
  peopleByAccount: Record<string, ChartStakeholder[]>
  opportunities: OpportunityV2[]
  upsertOpportunityV2: (opportunity: OpportunityV2) => void
  onToast: (message: string) => void
}

export default function ImportPage({ accounts, peopleByAccount, opportunities, upsertOpportunityV2, onToast }: Props) {
  const { t } = useI18n()
  const [kind, setKind] = useState<ImportKind>('stakeholders')
  const [presetId, setPresetId] = useState<ImportPreset['id']>('lusha')
  const [accountId, setAccountId] = useState(accounts.find((account) => account.id === 'mapfre')?.id ?? accounts[0]?.id ?? '')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const preset = getImportPreset(presetId, kind)
  const parsed = useMemo(() => parseCsv(text), [text])
  const stakeholderPlan = useMemo(() => (
    kind === 'stakeholders' && accountId
      ? planStakeholderImport(parsed.rows, preset, accountId, peopleByAccount[accountId] ?? [])
      : null
  ), [accountId, kind, parsed.rows, peopleByAccount, preset])
  const opportunityPlan = useMemo(() => (
    kind === 'opportunities'
      ? planOpportunityImport(parsed.rows, preset, opportunities, accounts)
      : null
  ), [accounts, kind, opportunities, parsed.rows, preset])

  const changeKind = (value: ImportKind) => {
    setKind(value)
    setPresetId(value === 'stakeholders' ? 'lusha' : 'crm-opps')
  }

  const loadFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name)
    setText(await file.text())
  }

  const apply = () => {
    if (stakeholderPlan && accountId) {
      const snapshot = getAccountSnapshot(accountId)
      const patched = snapshot.people.map((person) => {
        const update = stakeholderPlan.updates.find((item) => item.id === person.id)
        return update ? { ...person, ...update.patch } : person
      })
      setAccountSnapshot(accountId, [...patched, ...stakeholderPlan.creates], snapshot.layouts)
      onToast(t('import.applied', {
        creates: stakeholderPlan.creates.length,
        updates: stakeholderPlan.updates.length,
        skipped: stakeholderPlan.skipped.length,
      }))
      return
    }
    if (opportunityPlan) {
      opportunityPlan.updates.forEach((update) => {
        const opportunity = opportunities.find((item) => item.id === update.id)
        if (opportunity) upsertOpportunityV2({ ...opportunity, ...update.patch })
      })
      onToast(t('import.applied', {
        creates: 0,
        updates: opportunityPlan.updates.length,
        skipped: opportunityPlan.skipped.length,
      }))
    }
  }

  const creates = stakeholderPlan?.creates.length ?? 0
  const updates = stakeholderPlan?.updates.length ?? opportunityPlan?.updates.length ?? 0
  const skipped = (stakeholderPlan?.skipped.length ?? 0) + (opportunityPlan?.skipped.length ?? 0)
  const previewRows = [
    ...(stakeholderPlan?.creates.map((person) => ({
      key: `create-${person.id}`,
      action: t('import.create'),
      record: person.name,
      details: <mark>{[person.title, person.country].filter(Boolean).join(' · ') || person.id}</mark>,
    })) ?? []),
    ...(stakeholderPlan?.updates.map((update) => ({
      key: `update-${update.id}`,
      action: t('import.update'),
      record: peopleByAccount[accountId]?.find((person) => person.id === update.id)?.name ?? update.id,
      details: <span>{update.changedFields.map((field) => <mark key={field}>{field}</mark>)}</span>,
    })) ?? []),
    ...(opportunityPlan?.updates.map((update) => ({
      key: `opp-update-${update.id}`,
      action: t('import.update'),
      record: opportunities.find((opportunity) => opportunity.id === update.id)?.name ?? update.id,
      details: <span>{update.changedFields.map((field) => <mark key={field}>{field}</mark>)}</span>,
    })) ?? []),
    ...(stakeholderPlan?.skipped.map((item, index) => ({
      key: `person-skip-${index}`,
      action: t('import.skip'),
      record: Object.values(item.row).filter(Boolean).join(' · ') || t('import.unknownRow'),
      details: item.reason,
    })) ?? []),
    ...(opportunityPlan?.skipped.map((item, index) => ({
      key: `opp-skip-${index}`,
      action: t('import.skip'),
      record: Object.values(item.row).filter(Boolean).join(' · ') || t('import.unknownRow'),
      details: item.reason,
    })) ?? []),
    ...(opportunityPlan?.warnings.map((item, index) => ({
      key: `opp-warning-${index}`,
      action: t('import.warning'),
      record: Object.values(item.row).filter(Boolean).join(' · ') || t('import.unknownRow'),
      details: item.reason,
    })) ?? []),
  ]

  return <>
    <PageHeader eyebrow={t('import.eyebrow')} title={t('import.title')} subtitle={t('import.subtitle')} />
    <Section title={t('import.setup')}>
      <div className="edit-grid">
        <label>{t('import.kind')}<select value={kind} onChange={(event) => changeKind(event.target.value as ImportKind)}>
          <option value="stakeholders">{t('import.stakeholders')}</option>
          <option value="opportunities">{t('import.opportunities')}</option>
        </select></label>
        <label>{t('import.preset')}<select value={presetId} onChange={(event) => setPresetId(event.target.value as ImportPreset['id'])}>
          {(kind === 'stakeholders' ? ['lusha', 'salesnav', 'generic'] : ['crm-opps', 'generic']).map((id) => <option value={id} key={id}>{t(`import.preset.${id}` as never)}</option>)}
        </select></label>
        {kind === 'stakeholders' && <label>{t('import.account')}<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
        </select></label>}
        <label>{t('import.file')}<input type="file" accept=".csv,text/csv" onChange={(event) => { void loadFile(event.target.files?.[0]) }} /></label>
      </div>
      {fileName && <p className="muted">{fileName}</p>}
      <label className="csv-paste-label">{t('import.paste')}<textarea className="csv-paste" value={text} onChange={(event) => { setText(event.target.value); setFileName('') }} placeholder="First Name,Last Name,Job Title&#10;Alex,Morgan,Director" /></label>
    </Section>
    <Section title={t('import.preview')} eyebrow={`${parsed.rows.length} ${t('import.rows')}`}>
      <div className="summary-grid">
        <div><span>{t('import.create')}</span><strong>{creates}</strong></div>
        <div><span>{t('import.update')}</span><strong>{updates}</strong></div>
        <div><span>{t('import.skip')}</span><strong>{skipped}</strong></div>
      </div>
      {previewRows.length > 0 && <div className="table-wrap"><table className="csv-preview-table">
        <thead><tr><th>{t('import.action')}</th><th>{t('import.record')}</th><th>{t('import.changesOrReason')}</th></tr></thead>
        <tbody>{previewRows.map((row) => <tr key={row.key}><td>{row.action}</td><td>{row.record}</td><td>{row.details}</td></tr>)}</tbody>
      </table></div>}
      <button className="button primary" type="button" disabled={!parsed.rows.length || (!creates && !updates)} onClick={apply}>{t('import.apply')}</button>
    </Section>
  </>
}
