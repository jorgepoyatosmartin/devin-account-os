import { isCloseDateInFiscalYear, opportunityAmountEur, compGross } from './engine'
import type { CompPlan, OpportunityV2 } from '../types'

export interface OppCommission {
  oppId: string
  status: 'won' | 'open'
  quotaCredit: number
  commissionGross: number
  commissionNet: number
  effectiveRate: number
}

export function commissionByOpportunity(opps: OpportunityV2[], plan: CompPlan): OppCommission[] {
  const eligible = opps.flatMap((opportunity) => {
    if (
      !['won', 'open'].includes(opportunity.status)
      || !isCloseDateInFiscalYear(opportunity.closeDate, plan)
    ) return []
    const amount = opportunityAmountEur(opportunity, plan)
    return amount === null ? [] : [{ opportunity, amount }]
  })
  const closedNew = eligible
    .filter(({ opportunity }) => (
      opportunity.status === 'won'
      && opportunity.commissionType === 'new'
      && opportunity.countsForQuota
    ))
    .sort((a, b) => (
      (a.opportunity.closeDate || '').localeCompare(b.opportunity.closeDate || '')
      || a.opportunity.id.localeCompare(b.opportunity.id)
    ))
  const wonGrossById = new Map<string, number>()
  let closedQuota = 0
  closedNew.forEach(({ opportunity, amount }) => {
    const gross = compGross(closedQuota + amount, plan) - compGross(closedQuota, plan)
    wonGrossById.set(opportunity.id, gross)
    closedQuota += amount
  })

  return eligible.map(({ opportunity, amount }) => {
    let quotaCredit = 0
    let commissionGross = 0
    if (opportunity.commissionType === 'renewal') {
      if (opportunity.status === 'won' || opportunity.status === 'open') {
        commissionGross = amount * plan.renewalRate
      }
    } else if (opportunity.countsForQuota) {
      quotaCredit = amount
      commissionGross = opportunity.status === 'won'
        ? wonGrossById.get(opportunity.id) ?? 0
        : compGross(closedQuota + amount, plan) - compGross(closedQuota, plan)
    }
    return {
      oppId: opportunity.id,
      status: opportunity.status as OppCommission['status'],
      quotaCredit,
      commissionGross,
      commissionNet: commissionGross * plan.taxFactor,
      effectiveRate: amount === 0 ? 0 : commissionGross / amount,
    }
  })
}
