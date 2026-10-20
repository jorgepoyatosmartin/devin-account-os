import type { PgScoreInputs } from '../types'

export interface PgScoreWeights {
  fit: number
  signals: number
  access: number
  economic: number
  urgency: number
}

const inputKeys: (keyof PgScoreWeights)[] = ['fit', 'signals', 'access', 'economic', 'urgency']

export function pgScore(inputs: PgScoreInputs, weights: PgScoreWeights): number | null {
  if (inputKeys.some((key) => {
    const value = inputs[key]
    return value == null || !Number.isFinite(value) || value < 1 || value > 5
  })) return null

  return inputKeys.reduce((total, key) => {
    const value = inputs[key]!
    return total + weights[key] * (value - 1) / 4
  }, 0)
}
