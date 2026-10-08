import { useSyncExternalStore } from 'react'
import { MAPFRE, MAPFRE_VERSION } from './data/mapfre'
import type { Stakeholder } from './model'

// Único almacén de stakeholders de MAPFRE (chart + resto de la app). Fuente: accounts/mapfre/stakeholders.yaml.
export const STORAGE_KEY = 'power-chart:mapfre'

export type Positions = Record<string, { x: number; y: number }>
type Snapshot = { people: Stakeholder[]; layouts: Record<string, Positions>; sourceVersion?: string }

function read(): Snapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Snapshot
      if (saved.sourceVersion === MAPFRE_VERSION) return saved
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
  return { people: MAPFRE, layouts: {} }
}

let snapshot: Snapshot = read()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function getMapfreSnapshot(): Snapshot {
  return snapshot
}

export function setMapfreSnapshot(people: Stakeholder[], layouts: Record<string, Positions>) {
  snapshot = { people, layouts, sourceVersion: MAPFRE_VERSION }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  emit()
}

export function setMapfreLayout(viewKey: string, positions: Positions) {
  setMapfreSnapshot(snapshot.people, { ...snapshot.layouts, [viewKey]: positions })
}

export function updateMapfrePerson(id: string, patch: Partial<Stakeholder>) {
  setMapfreSnapshot(snapshot.people.map((p) => (p.id === id ? { ...p, ...patch } : p)), snapshot.layouts)
}

export function resetMapfre() {
  localStorage.removeItem(STORAGE_KEY)
  snapshot = { people: MAPFRE, layouts: {} }
  emit()
}

export function subscribeMapfre(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useMapfrePeople(): Stakeholder[] {
  return useSyncExternalStore(subscribeMapfre, () => snapshot.people)
}
