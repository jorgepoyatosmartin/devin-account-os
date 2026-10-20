import { useSyncExternalStore } from 'react'
import { getRegisteredAccount, registeredAccounts } from '../accounts/registry'
import type { Stakeholder } from './model'

export const STORAGE_KEY = 'power-chart:mapfre'
export const storageKeyFor = (accountId: string) => `power-chart:${accountId}`

export type Positions = Record<string, { x: number; y: number }>
export type Snapshot = { people: Stakeholder[]; layouts: Record<string, Positions>; sourceVersion: string }

const snapshots = new Map<string, Snapshot>()
const listeners = new Set<() => void>()
const emit = () => {
  allPeopleSnapshot = Object.fromEntries(registeredAccounts.map(({ account }) => [
    account.id,
    getAccountSnapshot(account.id).people,
  ]))
  listeners.forEach((listener) => listener())
}

export function decodeSnapshot(raw: string | null, sourceVersion: string): Snapshot | null {
  if (!raw) return null
  try {
    const saved = JSON.parse(raw) as Partial<Snapshot>
    if (saved.sourceVersion === sourceVersion && Array.isArray(saved.people) && saved.layouts) {
      return saved as Snapshot
    }
  } catch {
    return null
  }
  return null
}

function read(accountId: string): Snapshot {
  const source = getRegisteredAccount(accountId)
  const people = source?.stakeholders ?? []
  const sourceVersion = source?.sourceVersion ?? ''
  try {
    const raw = localStorage.getItem(storageKeyFor(accountId))
    const saved = decodeSnapshot(raw, sourceVersion)
    if (saved) return saved
    if (raw) localStorage.removeItem(storageKeyFor(accountId))
  } catch {
    /* ignore */
  }
  return { people, layouts: {}, sourceVersion }
}

export function getAccountSnapshot(accountId: string): Snapshot {
  let snapshot = snapshots.get(accountId)
  if (!snapshot) {
    snapshot = read(accountId)
    snapshots.set(accountId, snapshot)
  }
  return snapshot
}

export function setAccountSnapshot(accountId: string, people: Stakeholder[], layouts: Record<string, Positions>) {
  const sourceVersion = getRegisteredAccount(accountId)?.sourceVersion ?? ''
  const snapshot = { people, layouts, sourceVersion }
  snapshots.set(accountId, snapshot)
  try {
    localStorage.setItem(storageKeyFor(accountId), JSON.stringify(snapshot))
  } catch {
    /* ignore */
  }
  emit()
}

export function setAccountLayout(accountId: string, viewKey: string, positions: Positions) {
  const snapshot = getAccountSnapshot(accountId)
  setAccountSnapshot(accountId, snapshot.people, { ...snapshot.layouts, [viewKey]: positions })
}

export function updateAccountPerson(accountId: string, id: string, patch: Partial<Stakeholder>) {
  const snapshot = getAccountSnapshot(accountId)
  setAccountSnapshot(accountId, snapshot.people.map((person) => (
    person.id === id ? { ...person, ...patch } : person
  )), snapshot.layouts)
}

export function resetAccount(accountId: string) {
  try {
    localStorage.removeItem(storageKeyFor(accountId))
  } catch {
    /* ignore */
  }
  snapshots.delete(accountId)
  getAccountSnapshot(accountId)
  emit()
}

export function resetAllAccounts() {
  for (const { account } of registeredAccounts) {
    try {
      localStorage.removeItem(storageKeyFor(account.id))
    } catch {
      /* ignore */
    }
  }
  snapshots.clear()
  emit()
}

export function getAllAccountPeople(): Record<string, Stakeholder[]> {
  return Object.fromEntries(registeredAccounts.map(({ account }) => [
    account.id,
    getAccountSnapshot(account.id).people,
  ]))
}

let allPeopleSnapshot = getAllAccountPeople()

export function subscribeAccount(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAccountPeople(accountId: string): Stakeholder[] {
  return useSyncExternalStore(subscribeAccount, () => getAccountSnapshot(accountId).people)
}

export function useAllAccountPeople(): Record<string, Stakeholder[]> {
  return useSyncExternalStore(subscribeAccount, () => allPeopleSnapshot)
}

export const getMapfreSnapshot = () => getAccountSnapshot('mapfre')
export const setMapfreSnapshot = (people: Stakeholder[], layouts: Record<string, Positions>) =>
  setAccountSnapshot('mapfre', people, layouts)
export const setMapfreLayout = (viewKey: string, positions: Positions) =>
  setAccountLayout('mapfre', viewKey, positions)
export const updateMapfrePerson = (id: string, patch: Partial<Stakeholder>) =>
  updateAccountPerson('mapfre', id, patch)
export const resetMapfre = () => resetAccount('mapfre')
export const subscribeMapfre = subscribeAccount
export const useMapfrePeople = () => useAccountPeople('mapfre')
