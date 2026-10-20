import { Section } from './ui'
import { stagesConfig } from '../config'
import { useI18n } from '../i18n'
import { stageDisplayLabel } from '../lib/stageLabel'
import type { OpportunityV2 } from '../types'

export default function OpportunityCommercialFields({
  opportunity,
  onSave,
}: {
  opportunity: OpportunityV2
  onSave: (opportunity: OpportunityV2) => void
}) {
  const { t } = useI18n()
  const update = (patch: Partial<OpportunityV2>) => onSave({ ...opportunity, ...patch })
  const updateStage = (stageId: string) => {
    if (stageId === opportunity.stageId) return
    update({
      stageId,
      stageHistory: [...opportunity.stageHistory, { stageId, date: new Date().toISOString().slice(0, 10) }],
    })
  }
  return <Section title={t('opportunity.commercialBlock')}>
    <div className="edit-grid">
      <label>{t('opportunity.amount')}<input type="number" min="0" step="any" value={opportunity.amount ?? ''} onChange={(event) => {
        const value = event.target.value
        const amount = value === '' ? null : Number(value)
        update({ amount: amount !== null && Number.isFinite(amount) ? amount : null })
      }} /></label>
      <label>{t('opportunity.currency')}<select value={opportunity.currency} onChange={(event) => update({ currency: event.target.value as OpportunityV2['currency'] })}>
        <option value="EUR">EUR</option><option value="USD">USD</option>
      </select></label>
      <label>{t('opportunity.closeDate')}<input type="date" value={opportunity.closeDate ?? ''} onChange={(event) => update({ closeDate: event.target.value || null })} /></label>
      <label>{t('opportunity.stageId')}<select value={opportunity.stageId} onChange={(event) => updateStage(event.target.value)}>
        {stagesConfig.slice().sort((a, b) => a.order - b.order).map((stage) => <option key={stage.id} value={stage.id}>{stageDisplayLabel(stage.id, t)}</option>)}
      </select></label>
      <label>{t('opportunity.status')}<select value={opportunity.status} onChange={(event) => update({ status: event.target.value as OpportunityV2['status'] })}>
        <option value="open">{t('opportunity.statusOpen')}</option>
        <option value="won">{t('opportunity.statusWon')}</option>
        <option value="lost">{t('opportunity.statusLost')}</option>
      </select></label>
      <label>{t('opportunity.forecastCategory')}<select value={opportunity.forecastCategory} onChange={(event) => update({ forecastCategory: event.target.value as OpportunityV2['forecastCategory'] })}>
        {(['Pipeline', 'Upside', 'Commit', 'Closed'] as const).map((category) => <option value={category} key={category}>{category}</option>)}
      </select></label>
      <label className="check-label"><input type="checkbox" checked={opportunity.countsForQuota} onChange={(event) => update({ countsForQuota: event.target.checked })} />{t('opportunity.countsForQuota')}</label>
      <label>{t('opportunity.commissionType')}<select value={opportunity.commissionType} onChange={(event) => update({ commissionType: event.target.value as OpportunityV2['commissionType'] })}>
        <option value="new">{t('opportunity.commissionNew')}</option>
        <option value="renewal">{t('opportunity.commissionRenewal')}</option>
      </select></label>
    </div>
  </Section>
}
