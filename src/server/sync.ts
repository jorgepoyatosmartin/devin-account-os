import { api, ApiError, AUTH_KEY } from './api'

export type SyncStatus = 'synced' | 'saving' | 'offline'
type StateItem = { key: string; value: unknown; version: number; updatedAt: string }
type StateResponse = { items: StateItem[] }
type PendingValue = string | null

const VERSIONS_KEY = 'cognition-pipeline-sync-versions'
const excluded = new Set([AUTH_KEY, 'cognition-pipeline-api-url', 'cognition-pipeline-lang', VERSIONS_KEY])
const versions = new Map<string, number>()
const pending = new Map<string, PendingValue>()
const timers = new Map<string, number>()
const inFlight = new Set<string>()
let interval: number | undefined
let active = false
let status: SyncStatus = 'synced'
let originalSet: Storage['setItem'] | undefined
let originalRemove: Storage['removeItem'] | undefined
let suppress = false

function persistVersions() {
  const setItem = originalSet ?? localStorage.setItem
  setItem.call(localStorage, VERSIONS_KEY, JSON.stringify(Object.fromEntries(versions)))
}

function setVersion(key: string, version: number) {
  versions.set(key, version)
  persistVersions()
}

function deleteVersion(key: string) {
  versions.delete(key)
  persistVersions()
}

function loadVersions() {
  versions.clear()
  try {
    const value: unknown = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '{}')
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value).forEach(([key, version]) => {
        if (isSyncableKey(key) && typeof version === 'number' && Number.isSafeInteger(version) && version > 0) {
          versions.set(key, version)
        }
      })
    }
  } catch {
    persistVersions()
  }
}

function setStatus(next: SyncStatus) {
  if (status === next) return
  status = next
  window.dispatchEvent(new CustomEvent('cognition-pipeline:sync-status', { detail: next }))
}

export function getSyncStatus() {
  return status
}

export function isSyncableKey(key: string) {
  return !excluded.has(key) && (key.startsWith('cognition-pipeline-') || key.startsWith('power-chart:'))
}

function localValue(key: string, value: PendingValue) {
  suppress = true
  if (value === null) (originalRemove ?? localStorage.removeItem).call(localStorage, key)
  else (originalSet ?? localStorage.setItem).call(localStorage, key, value)
  suppress = false
}

async function flush(key: string) {
  if (inFlight.has(key)) return
  const value = pending.get(key)
  if (value === undefined) return
  inFlight.add(key)
  setStatus('saving')
  try {
    const baseVersion = versions.get(key) ?? 0
    if (value === null) {
      await api(`/state/${encodeURIComponent(key)}`, { method: 'DELETE', body: JSON.stringify({ baseVersion }) })
      deleteVersion(key)
    } else {
      const item = await api<StateItem>(`/state/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify({ value: JSON.parse(value), baseVersion }),
      })
      setVersion(key, item.version)
    }
    const timer = timers.get(key)
    if (timer !== undefined) window.clearTimeout(timer)
    timers.delete(key)
    if (pending.get(key) === value) pending.delete(key)
    setStatus(pending.size ? 'saving' : 'synced')
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const payload = error.payload as { current?: StateItem; detail?: { current?: StateItem } }
      const current = payload.current || payload.detail?.current
      if (current) {
        setVersion(key, current.version)
        localValue(key, JSON.stringify(current.value))
        pending.delete(key)
        const timer = timers.get(key)
        if (timer !== undefined) window.clearTimeout(timer)
        timers.delete(key)
        window.dispatchEvent(new CustomEvent('cognition-pipeline:toast', { detail: 'server.syncConflict' }))
        sessionStorage.setItem('cognition-pipeline-sync-toast', 'server.syncConflict')
        window.location.reload()
      }
      return
    }
    setStatus('offline')
  } finally {
    inFlight.delete(key)
    if (pending.has(key) && status !== 'offline') void flush(key)
  }
}

function enqueue(key: string, value: PendingValue) {
  if (!active || suppress || !isSyncableKey(key)) return
  pending.set(key, value)
  setStatus('saving')
  const existing = timers.get(key)
  if (existing !== undefined) window.clearTimeout(existing)
  timers.set(key, window.setTimeout(() => {
    timers.delete(key)
    void flush(key)
  }, 1000))
}

export async function syncInitialState() {
  versions.clear()
  persistVersions()
  const response = await api<StateResponse>('/state')
  const serverKeys = new Set(response.items.map((item) => item.key))
  response.items.forEach((item) => {
    if (!isSyncableKey(item.key)) return
    setVersion(item.key, item.version)
    localValue(item.key, JSON.stringify(item.value))
  })
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || !isSyncableKey(key) || serverKeys.has(key)) continue
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    const item = await api<StateItem>(`/state/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value: JSON.parse(raw), baseVersion: 0 }),
    })
    setVersion(key, item.version)
  }
}

export function startSync() {
  if (active || !localStorage.getItem(AUTH_KEY)) return
  active = true
  const setItem = localStorage.setItem
  const removeItem = localStorage.removeItem
  originalSet = setItem
  originalRemove = removeItem
  loadVersions()
  localStorage.setItem = function (key: string, value: string) {
    setItem.call(this, key, value)
    enqueue(key, value)
  }
  localStorage.removeItem = function (key: string) {
    removeItem.call(this, key)
    enqueue(key, null)
  }
  interval = window.setInterval(() => {
    if (!pending.size) return
    pending.forEach((_, key) => { void flush(key) })
  }, 30000)
}

export function stopSync() {
  if (active) {
    active = false
    if (interval !== undefined) window.clearInterval(interval)
    timers.forEach((timer) => window.clearTimeout(timer))
    interval = undefined
    timers.clear()
    if (originalSet) localStorage.setItem = originalSet
    if (originalRemove) localStorage.removeItem = originalRemove
  }
  const removeItem = originalRemove ?? localStorage.removeItem
  removeItem.call(localStorage, VERSIONS_KEY)
  originalSet = undefined
  originalRemove = undefined
  pending.clear()
  versions.clear()
  setStatus('synced')
}
