import { describe, expect, it } from 'vitest'
import accountsJson from '../data/accounts.json'
import legacyStakeholders from '../data/stakeholders.json'
import type { Account } from '../types'
import {
  accountYamlFiles,
  buildAccountRegistry,
  registeredAccounts,
  stakeholderYamlFiles,
  territoryYamlFiles,
} from './registry'

describe('account registry', () => {
  it('discovers a new account with account and stakeholder YAML only', () => {
    const discovered = buildAccountRegistry(
      accountsJson as unknown as Account[],
      {
        ...accountYamlFiles,
        '/accounts/newco/account.yaml': 'id: newco\nname: NewCo\nsector: Technology\nheadquarters: Madrid, Spain\ncountry: Spain\nbusinessUnits: []\n',
      },
      {
        ...stakeholderYamlFiles,
        '/accounts/newco/stakeholders.yaml': [
          'account: newco',
          'updated: 2026-10-12',
          'schema: stakeholders/v1',
          'stakeholders:',
          '  - id: newco-ceo',
          '    name: NewCo CEO',
          '    title: Chief Executive Officer',
          '    level: C Level',
          '    unit: Executive',
          '    role: EB',
          '    attitude: unknown',
          '    influence: 3',
          '    status: No contact',
        ].join('\n'),
      },
      territoryYamlFiles,
    )
    const account = discovered.find(({ account: item }) => item.id === 'newco')
    expect(account?.account.name).toBe('NewCo')
    expect(account?.account.initiatives).toEqual([])
    expect(account?.stakeholders.map((person) => person.id)).toEqual(['newco-ceo'])
    expect(account?.territory.potentialEur).toBeNull()
  })

  it('loads the requested bundled stakeholder counts', () => {
    const counts = Object.fromEntries(registeredAccounts.map(({ account, stakeholders }) => [
      account.id,
      stakeholders.length,
    ]))
    const legacyCounts = legacyStakeholders.reduce<Record<string, number>>((result, person) => {
      result[person.accountId] = (result[person.accountId] ?? 0) + 1
      return result
    }, {})
    expect(counts).toEqual({
      mapfre: 46,
      caixabank: 4,
      bankinter: 4,
      amadeus: 3,
      acciona: 15,
    })
    for (const accountId of ['caixabank', 'bankinter', 'amadeus', 'acciona']) {
      expect(counts[accountId]).toBe(legacyCounts[accountId])
    }
  })
})
