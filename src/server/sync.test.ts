import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_KEY } from './api'
import { isSyncableKey, startSync, stopSync, syncInitialState } from './sync'
import { installBrowserTestEnvironment } from './testEnvironment'

beforeEach(() => {
  vi.useFakeTimers()
  installBrowserTestEnvironment()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  stopSync()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('server sync', () => {
  it('excludes auth, API URL, and language from synced keys', () => {
    expect(isSyncableKey('cognition-pipeline-auth')).toBe(false)
    expect(isSyncableKey('cognition-pipeline-api-url')).toBe(false)
    expect(isSyncableKey('cognition-pipeline-lang')).toBe(false)
    expect(isSyncableKey('power-chart:mapfre')).toBe(true)
  })

  it('debounces writes by one second', async () => {
    localStorage.setItem(AUTH_KEY, 'token')
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ key: 'cognition-pipeline-pg', value: [], version: 1, updatedAt: '' })))
    startSync()
    localStorage.setItem('cognition-pipeline-pg', '[]')
    localStorage.setItem('cognition-pipeline-pg', '[1]')
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledOnce()
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ value: [1], baseVersion: 0 })
  })

  it('migrates local-only values and lets server values win', async () => {
    localStorage.setItem('cognition-pipeline-pg', JSON.stringify(['local']))
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ key: 'power-chart:mapfre', value: { version: 'server' }, version: 4 }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ key: 'cognition-pipeline-pg', value: ['local'], version: 1, updatedAt: '' })))
    await syncInitialState()
    expect(JSON.parse(localStorage.getItem('power-chart:mapfre') || '{}')).toEqual({ version: 'server' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('loads server state on 409 without queuing it again', async () => {
    localStorage.setItem(AUTH_KEY, 'token')
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ current: { key: 'cognition-pipeline-pg', value: ['remote'], version: 4, updatedAt: '' } }), { status: 409 }))
    startSync()
    localStorage.setItem('cognition-pipeline-pg', '["local"]')
    await vi.advanceTimersByTimeAsync(1000)
    expect(localStorage.getItem('cognition-pipeline-pg')).toBe('["remote"]')
    expect(fetch).toHaveBeenCalledOnce()
  })
})
