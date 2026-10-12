import { fiscalConfig, funnelConfig } from '../config'
import type { CompPlan, OpportunityV2, PrpResult } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

function annualQuota(plan: CompPlan): number {
  return plan.quotaByQuarter.reduce((sum, quota) => sum + quota, 0)
}

export function compGross(salesQuota: number, plan: CompPlan): number {
  const quota = annualQuota(plan)
  const sales = Math.max(0, salesQuota)

  return plan.tiers.reduce((gross, tier) => {
    const fromSales = quota * tier.fromPct / 100
    const toSales = tier.toPct === null ? Number.POSITIVE_INFINITY : quota * tier.toPct / 100
    const salesInTier = Math.max(0, Math.min(sales, toSales) - fromSales)
    return gross + salesInTier * tier.rate
  }, 0)
}

export function salesNeededForGross(gross: number, plan: CompPlan): number {
  const target = Math.max(0, gross)
  if (target === 0) return 0

  const quota = annualQuota(plan)
  let grossBeforeTier = 0

  for (const tier of plan.tiers) {
    const fromSales = quota * tier.fromPct / 100
    const toSales = tier.toPct === null ? Number.POSITIVE_INFINITY : quota * tier.toPct / 100
    const grossInTier = (toSales - fromSales) * tier.rate
    if (tier.rate > 0 && target <= grossBeforeTier + grossInTier) {
      return fromSales + (target - grossBeforeTier) / tier.rate
    }
    grossBeforeTier += grossInTier
  }

  return 0
}

export function toEur(amount: number, currency: 'EUR' | 'USD', plan: CompPlan): number {
  return currency === 'EUR' ? amount : amount / plan.fxEurUsd
}

function parseIsoDate(value: string | null): number | null {
  if (!value) return null
  const timestamp = Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(timestamp) ? null : timestamp
}

function quarterIndex(date: number, fiscalYearStart: number): number {
  const dateValue = new Date(date)
  const fiscalStart = new Date(fiscalYearStart)
  const monthOffset = (dateValue.getUTCFullYear() - fiscalStart.getUTCFullYear()) * 12
    + dateValue.getUTCMonth() - fiscalStart.getUTCMonth()
  return Math.floor(monthOffset / 3)
}

function funnelCount(won: number, conversionRate: number): number {
  return conversionRate > 0 ? Math.ceil(won / conversionRate) : 0
}

export function prp(
  opps: OpportunityV2[],
  plan: CompPlan,
  stageProbabilities: Record<string, number>,
  today: string,
): PrpResult {
  const fyStartMonth = fiscalConfig.fyStartMonth
  const fiscalYearStart = Date.UTC(plan.fiscalYear, fyStartMonth - 1, 1)
  const fiscalYearEnd = Date.UTC(plan.fiscalYear + 1, fyStartMonth - 1, 1) - DAY_MS
  const todayTimestamp = parseIsoDate(today)
  const weeksRemaining = todayTimestamp === null
    ? 0
    : Math.max(0, (fiscalYearEnd - todayTimestamp) / DAY_MS + 1) / 7
  const quarterClosedWon = [0, 0, 0, 0]
  const quarterPipeline = [0, 0, 0, 0]
  const oppsMissingAmount: string[] = []
  const oppsOutsideFiscalYear: string[] = []
  let closedWonQuota = 0
  let renewalClosed = 0
  let renewalGrossClosed = 0
  let pipelineTotal = 0
  let pipelineWeighted = 0
  let openCommit = 0
  let openUpside = 0

  for (const opp of opps) {
    const closeTimestamp = parseIsoDate(opp.closeDate)
    const inFiscalYear = closeTimestamp !== null
      && closeTimestamp >= fiscalYearStart
      && closeTimestamp <= fiscalYearEnd

    if (!inFiscalYear) oppsOutsideFiscalYear.push(opp.id)
    if (opp.amount === null) oppsMissingAmount.push(opp.id)
    if (!inFiscalYear || closeTimestamp === null || opp.amount === null) continue

    const amount = toEur(opp.amount, opp.currency, plan)
    const q = quarterIndex(closeTimestamp, fiscalYearStart)

    if (opp.status === 'won') {
      if (opp.commissionType === 'renewal') {
        renewalClosed += amount
        renewalGrossClosed += amount * plan.renewalRate
      } else if (opp.countsForQuota) {
        closedWonQuota += amount
        quarterClosedWon[q] += amount
      }
    }

    if (opp.status === 'open') {
      pipelineTotal += amount
      pipelineWeighted += amount * (stageProbabilities[opp.stageId] ?? 0)
      quarterPipeline[q] += amount
      if (opp.forecastCategory === 'Commit') openCommit += amount
      if (opp.forecastCategory === 'Upside') openUpside += amount
    }
  }

  const quota = annualQuota(plan)
  const gapToQuota = quota - closedWonQuota
  const grossCommissionNeeded = plan.netTarget / plan.taxFactor - renewalGrossClosed
  const personalTargetSales = salesNeededForGross(grossCommissionNeeded, plan)
  const gapToPersonal = Math.max(0, personalTargetSales - closedWonQuota)
  const forecastCommit = closedWonQuota + openCommit
  const forecastBestCase = forecastCommit + openUpside
  const pipelineRequiredQuota = gapToQuota * plan.coverageMultiple
  const pipelineGapQuota = pipelineRequiredQuota - pipelineTotal
  const pipelineRequiredPersonal = gapToPersonal * plan.coverageMultiple
  const pipelineGapPersonal = pipelineRequiredPersonal - pipelineTotal
  const funnelRates = funnelConfig.rates
  const wonNeeded = plan.avgDealSize > 0 ? Math.ceil(gapToPersonal / plan.avgDealSize) : 0
  const bvaTvRate = funnelRates.BVA_TV_to_WON
  const tfwRate = funnelRates.TFW_to_BVA_TV * bvaTvRate
  const nbmRate = funnelRates.NBM_to_TFW * tfwRate
  const dmRate = funnelRates.DM_to_NBM * nbmRate
  const commissionGrossClosed = compGross(closedWonQuota, plan) + renewalGrossClosed
  const commissionGrossCommit = compGross(forecastCommit, plan) + renewalGrossClosed
  const quarters = plan.quotaByQuarter.map((quarterQuota, index) => ({
    q: (index + 1) as 1 | 2 | 3 | 4,
    quota: quarterQuota,
    closedWonQuota: quarterClosedWon[index],
    personalTarget: personalTargetSales * plan.personalTargetQuarterSplit[index],
    pipelineTotal: quarterPipeline[index],
  })) as PrpResult['quarters']

  return {
    year: plan.fiscalYear,
    annualQuota: quota,
    closedWonQuota,
    renewalClosed,
    gapToQuota,
    grossCommissionNeeded,
    personalTargetSales,
    gapToPersonal,
    pipelineTotal,
    pipelineWeighted,
    forecastCommit,
    forecastBestCase,
    pipelineRequiredQuota,
    pipelineGapQuota,
    pipelineRequiredPersonal,
    pipelineGapPersonal,
    weeksRemaining,
    weeklyPipelinePacePersonal: weeksRemaining > 0 ? pipelineGapPersonal / weeksRemaining : 0,
    oppsMissingAmount,
    oppsOutsideFiscalYear,
    commissionGrossClosed,
    commissionNetClosed: commissionGrossClosed * plan.taxFactor,
    commissionGrossCommit,
    commissionNetCommit: commissionGrossCommit * plan.taxFactor,
    funnelNeeded: {
      WON: wonNeeded,
      BVA_TV: funnelCount(wonNeeded, bvaTvRate),
      TFW: funnelCount(wonNeeded, tfwRate),
      NBM: funnelCount(wonNeeded, nbmRate),
      DM: funnelCount(wonNeeded, dmRate),
    },
    quarters,
  }
}
