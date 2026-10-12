import { load as yamlLoad } from 'js-yaml'
import engagementRaw from '../../config/engagement.yaml?raw'
import fiscalRaw from '../../config/fiscal.yaml?raw'
import funnelRaw from '../../config/funnel.yaml?raw'
import pgScoreRaw from '../../config/pg-score.yaml?raw'
import stagesRaw from '../../config/stages.yaml?raw'
import productsRaw from '../../catalog/products.yaml?raw'
import salesPlaysRaw from '../../catalog/sales-plays.yaml?raw'

export interface StageDefinition {
  id: string
  label: string
  probability: number
  order: number
  exitCriteria: string[]
}

export interface FiscalConfig {
  fyStartMonth: number
  currency: 'EUR'
}

export interface EngagementPhase {
  id: 'DM' | 'NBM' | 'TFW' | 'BVA' | 'TV'
  label: string
  evidenceRequired: string[]
}

export interface FunnelConfig {
  rates: {
    DM_to_NBM: number
    NBM_to_TFW: number
    TFW_to_BVA_TV: number
    BVA_TV_to_WON: number
  }
}

export interface PgScoreConfig {
  inputMin: number
  inputMax: number
  weights: {
    fit: number
    signals: number
    access: number
    economic: number
    urgency: number
  }
}

export interface ProductDefinition {
  id: 'devin-cloud' | 'devin-desktop' | 'devin-cli' | 'devin-review'
  useCases: string[]
}

export interface SalesPlayDefinition {
  id: 'appsec' | 'modernization' | 'dev-productivity' | 'quality-testing' | 'ops-incidents'
  provisional: true
  productIds: ProductDefinition['id'][]
  pains: string[]
}

function parseYaml<T>(raw: string): T {
  return yamlLoad(raw) as T
}

export const stagesConfig = parseYaml<{ stages: StageDefinition[] }>(stagesRaw).stages
export const fiscalConfig = parseYaml<FiscalConfig>(fiscalRaw)
export const engagementConfig = parseYaml<{ phases: EngagementPhase[] }>(engagementRaw).phases
export const funnelConfig = parseYaml<FunnelConfig>(funnelRaw)
export const pgScoreConfig = parseYaml<PgScoreConfig>(pgScoreRaw)
export const products = parseYaml<{ products: ProductDefinition[] }>(productsRaw).products
export const salesPlays = parseYaml<{ salesPlays: SalesPlayDefinition[] }>(salesPlaysRaw).salesPlays
