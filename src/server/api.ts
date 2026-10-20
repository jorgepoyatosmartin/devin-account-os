export const AUTH_KEY = 'cognition-pipeline-auth'
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(readonly status: number, readonly payload: unknown) {
    super(`API request failed (${status})`)
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = API_URL || (import.meta.env.MODE === 'test' ? 'http://api.test' : '')
  if (!baseUrl) throw new Error('API is not configured')
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = localStorage.getItem(AUTH_KEY)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  if (response.status === 401) {
    localStorage.removeItem(AUTH_KEY)
    window.dispatchEvent(new CustomEvent('cognition-pipeline:logout'))
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, payload)
  return payload as T
}

export function login(username: string, password: string) {
  return api<{ token: string; expiresAt: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }).then((result) => {
    localStorage.setItem(AUTH_KEY, result.token)
    return result
  })
}

export function getHealth() {
  if (!API_URL) return Promise.resolve({ status: 'ok', features: { lusha: false, openai: false }, dataDir: '' })
  return api<{ status: string; features: { lusha: boolean; openai: boolean }; dataDir: string }>('/health')
}

export function logout() {
  localStorage.removeItem(AUTH_KEY)
  window.dispatchEvent(new CustomEvent('cognition-pipeline:logout'))
}
