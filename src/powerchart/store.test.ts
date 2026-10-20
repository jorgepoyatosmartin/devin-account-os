import { describe, expect, it } from 'vitest'
import { getRegisteredAccount } from '../accounts/registry'
import { decodeSnapshot, storageKeyFor, type Snapshot } from './store'

describe('Power Chart account storage', () => {
  it('keeps edits in the existing MAPFRE key when the YAML version is unchanged', () => {
    const source = getRegisteredAccount('mapfre')!
    const saved: Snapshot = {
      people: [{ ...source.stakeholders[0], title: 'Local title edit' }],
      layouts: { 'all|all|none': { [source.stakeholders[0].id]: { x: 10, y: 20 } } },
      sourceVersion: source.sourceVersion,
    }

    expect(storageKeyFor('mapfre')).toBe('power-chart:mapfre')
    expect(decodeSnapshot(JSON.stringify(saved), source.sourceVersion)?.people[0].title).toBe('Local title edit')
    expect(decodeSnapshot(JSON.stringify(saved), `${source.sourceVersion}-changed`)).toBeNull()
  })
})
