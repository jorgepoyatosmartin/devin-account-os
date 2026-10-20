import { describe, expect, it } from 'vitest'
import { autoLayout } from './layout'
import type { Stakeholder } from './model'

describe('autoLayout', () => {
  it('wraps people without visible reporting lines into a compact grid', () => {
    const people = Array.from({ length: 8 }, (_, index) => ({
      id: `person-${index}`,
      reportsTo: null,
    }) as Stakeholder)
    const positions = autoLayout(people)

    expect(positions['person-0'].x).toBe(positions['person-2'].x)
    expect(positions['person-0'].y).toBe(positions['person-1'].y)
    expect(positions['person-0'].y).toBeLessThan(positions['person-2'].y)
    expect(positions['person-7'].y).toBeGreaterThan(positions['person-5'].y)
  })
})
