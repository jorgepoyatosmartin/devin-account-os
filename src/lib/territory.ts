import type { TerritoryPlan } from '../accounts/registry'

export const TERRITORY_STORAGE_KEY = 'cognition-pipeline-territory'
export type TerritoryOverlay = Record<string, Partial<Pick<TerritoryPlan, 'tier' | 'potentialEur' | 'effortPct' | 'effortReason' | 'priority'>>>

export function readTerritoryOverlays(): TerritoryOverlay {
  try {
    const parsed = JSON.parse(localStorage.getItem(TERRITORY_STORAGE_KEY) || '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as TerritoryOverlay : {}
  } catch {
    return {}
  }
}

export function saveTerritoryOverlays(overlays: TerritoryOverlay) {
  try {
    localStorage.setItem(TERRITORY_STORAGE_KEY, JSON.stringify(overlays))
  } catch {
    return false
  }
  return true
}

export function territoryWithOverlay(accountId: string, base?: Partial<TerritoryPlan>) {
  return { ...base, ...readTerritoryOverlays()[accountId] } as TerritoryPlan
}
