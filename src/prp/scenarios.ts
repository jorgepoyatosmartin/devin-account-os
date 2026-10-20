import type { ScenarioDefinition, StageDefinition } from '../config'
import { compGross, prp } from './engine'
import type { CompPlan, OpportunityV2 } from '../types'

export interface ScenarioResult {
  id: string
  label: string
  projectedSales: number
  gapToQuota: number
  gapToPersonal: number
  pipelineRequiredPersonal: number
  commissionGross: number
  commissionNet: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function addUtcDays(date: string | null, days: number): string | null {
  if (!date) return null
  const timestamp = Date.parse(`${date.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(timestamp)) return date
  return new Date(timestamp + days * DAY_MS).toISOString().slice(0, 10)
}

export function prpScenario(
  opps: OpportunityV2[],
  plan: CompPlan,
  stages: StageDefinition[],
  today: string,
  scenario: ScenarioDefinition,
): ScenarioResult {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]))
  const adjustedOpps = opps.map((opportunity) => {
    const stage = stageById.get(opportunity.stageId)
    if (
      opportunity.status !== 'open'
      || stage?.order === undefined
      || stage.order > scenario.slipMaxStageOrder
      || scenario.slipDays === 0
    ) return opportunity
    return { ...opportunity, closeDate: addUtcDays(opportunity.closeDate, scenario.slipDays) }
  })
  const stageProbabilities = Object.fromEntries(stages.map((stage) => [
    stage.id,
    Math.min(1, stage.probability * scenario.probabilityFactor),
  ]))
  const scenarioPlan = scenario.coverageMultiple === null
    ? plan
    : { ...plan, coverageMultiple: scenario.coverageMultiple }
  const result = prp(adjustedOpps, scenarioPlan, stageProbabilities, today)
  const projectedSales = result.closedWonQuota + result.pipelineWeighted
  const annualQuota = scenarioPlan.quotaByQuarter.reduce((sum, quota) => sum + quota, 0)
  const commissionGross = compGross(projectedSales, scenarioPlan)
    + result.renewalClosed * scenarioPlan.renewalRate

  return {
    id: scenario.id,
    label: scenario.label,
    projectedSales,
    gapToQuota: Math.max(0, annualQuota - projectedSales),
    gapToPersonal: Math.max(0, result.personalTargetSales - projectedSales),
    pipelineRequiredPersonal: result.pipelineRequiredPersonal,
    commissionGross,
    commissionNet: commissionGross * scenarioPlan.taxFactor,
  }
}
