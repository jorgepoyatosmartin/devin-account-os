import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_KEY, api } from './api'
import { installBrowserTestEnvironment } from './testEnvironment'

beforeEach(() => installBrowserTestEnvironment())

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('server api', () => {
  it('clears auth and emits logout after a 401', async () => {
    localStorage.setItem(AUTH_KEY, 'expired')
    const listener = vi.fn()
    window.addEventListener('cognition-pipeline:logout', listener)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    await expect(api('/state')).rejects.toMatchObject({ status: 401 })
    expect(localStorage.getItem(AUTH_KEY)).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener('cognition-pipeline:logout', listener)
  })
})
