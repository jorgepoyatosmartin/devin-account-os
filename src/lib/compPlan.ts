import type { CompPlan } from '../types'

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function isNumberTuple(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber)
}

function isTier(value: unknown): value is CompPlan['tiers'][number] {
  if (!value || typeof value !== 'object') return false
  const tier = value as Partial<CompPlan['tiers'][number]>
  return isFiniteNumber(tier.fromPct)
    && tier.fromPct >= 0
    && (tier.toPct === null || (isFiniteNumber(tier.toPct) && tier.toPct > tier.fromPct))
    && isFiniteNumber(tier.rate)
    && tier.rate >= 0
}

export function isCompPlan(value: unknown): value is CompPlan {
  if (!value || typeof value !== 'object') return false
  const plan = value as Partial<CompPlan>
  return Number.isInteger(plan.fiscalYear)
    && plan.currency === 'EUR'
    && isNumberTuple(plan.quotaByQuarter)
    && plan.quotaByQuarter.every((quota) => quota >= 0)
    && Array.isArray(plan.tiers)
    && plan.tiers.length > 0
    && plan.tiers.every(isTier)
    && isFiniteNumber(plan.renewalRate)
    && plan.renewalRate >= 0
    && isFiniteNumber(plan.taxFactor)
    && plan.taxFactor > 0
    && plan.taxFactor <= 1
    && isFiniteNumber(plan.fxEurUsd)
    && plan.fxEurUsd > 0
    && isFiniteNumber(plan.netTarget)
    && plan.netTarget >= 0
    && isNumberTuple(plan.personalTargetQuarterSplit)
    && plan.personalTargetQuarterSplit.every((split) => split >= 0)
    && Math.abs(plan.personalTargetQuarterSplit.reduce((sum, split) => sum + split, 0) - 1) < 0.0001
    && isFiniteNumber(plan.coverageMultiple)
    && plan.coverageMultiple >= 0
    && isFiniteNumber(plan.avgDealSize)
    && plan.avgDealSize >= 0
}

export function parseCompPlanJson(json: string): CompPlan {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('invalid-json')
  }
  if (!isCompPlan(parsed)) throw new Error('invalid-comp-plan')
  return parsed
}

export async function readCompPlanFile(file: File): Promise<CompPlan> {
  return parseCompPlanJson(await file.text())
}

export function downloadCompPlan(plan: CompPlan): void {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cognition-pipeline-comp-plan-${plan.fiscalYear}.json`
  link.click()
  URL.revokeObjectURL(url)
}
