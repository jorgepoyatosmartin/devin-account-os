import { describe, expect, it } from 'vitest'
import { stagesConfig } from '../config'
import { prp } from '../prp/engine'
import type { CompPlan, Hypothesis } from '../types'
import synthetic from '../prp/__fixtures__/synthetic.json'
import { convertDiscoveryToOpportunity, hypothesisConversion } from './convert'

describe('PG discovery conversion', () => {
  const hypothesis: Hypothesis = {
    id: 'hyp-signal-a',
    accountId: 'acciona',
    title: 'Modernization hypothesis',
    whyChange: 'Reduce migration effort',
    whyNow: 'New platform roadmap',
    whyUs: 'Devin can automate migrations',
    valueEstimate: { amount: 42000, assumptions: 'Synthetic value estimate' },
    stakeholderIds: ['ana-rivero'],
    routeToMarket: 'direct',
    nextBestAction: 'Schedule discovery',
    status: 'validated',
    signalIds: ['signal-a'],
    source: 'local discovery',
    verifiedAt: null,
    productIds: ['devin-cloud'],
    salesPlayId: 'modernization',
    pgId: 'pg-1',
  }

  it('preserves source traceability and maps discovery fields into an opportunity', () => {
    const opportunity = convertDiscoveryToOpportunity(hypothesisConversion(hypothesis, '2026-10-12'), [])
    expect(opportunity).toMatchObject({
      stageId: '1-disco-scheduled',
      status: 'open',
      forecastCategory: 'Pipeline',
      amount: 42000,
      productIds: ['devin-cloud'],
      salesPlayId: 'modernization',
      nextAction: 'Route to market: direct · Schedule discovery',
      origin: { signalIds: ['signal-a'], pgId: 'pg-1', hypothesisId: 'hyp-signal-a' },
      people: [{ stakeholderId: 'ana-rivero', role: 'Unknown', confirmed: false }],
    })
    expect(opportunity.threeWhys).toMatchObject({
      whyAnything: { problem: hypothesis.whyChange },
      whyNow: { trigger: hypothesis.whyNow },
      whyCognition: { cognitionCapability: hypothesis.whyUs },
      validation: {
        problem: { status: 'Hypothesis' },
        whyNow: { status: 'Hypothesis' },
        whyCognition: { status: 'Hypothesis' },
      },
    })
  })

  it('includes a converted hypothesis in the PRP pipeline total', () => {
    const plan = synthetic.plan as CompPlan
    const opportunity = convertDiscoveryToOpportunity({
      ...hypothesisConversion(hypothesis, '2026-10-12'),
      amount: 42000,
    }, [])
    opportunity.closeDate = `${plan.fiscalYear}-06-01`
    const result = prp([opportunity], plan, Object.fromEntries(stagesConfig.map((stage) => [stage.id, stage.probability])), `${plan.fiscalYear}-01-01`)
    expect(result.pipelineTotal).toBe(42000)
  })
})
