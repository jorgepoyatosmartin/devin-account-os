import { describe, expect, it } from 'vitest'
import { pgScore } from './score'

const weights = { fit: 25, signals: 25, access: 20, economic: 20, urgency: 10 }

describe('pgScore', () => {
  it('scores all minimum inputs at zero', () => {
    expect(pgScore({ fit: 1, signals: 1, access: 1, economic: 1, urgency: 1 }, weights)).toBe(0)
  })

  it('scores all maximum inputs at one hundred', () => {
    expect(pgScore({ fit: 5, signals: 5, access: 5, economic: 5, urgency: 5 }, weights)).toBe(100)
  })

  it('returns null for an unset input and calculates weighted partial scores', () => {
    expect(pgScore({ fit: 5, signals: 3, access: 1, economic: 5, urgency: 1 }, weights)).toBe(57.5)
    expect(pgScore({ fit: 5, signals: 3 }, weights)).toBeNull()
  })
})
