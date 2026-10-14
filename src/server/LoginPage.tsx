import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { API_URL, AUTH_KEY, login } from './api'
import { syncInitialState } from './sync'
import './server.css'

export default function LoginPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!API_URL) return <Navigate to="/" replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username, password)
      await syncInitialState()
      window.location.hash = '#/'
      window.location.reload()
    } catch {
      localStorage.removeItem(AUTH_KEY)
      setError(t('server.loginError'))
      setBusy(false)
    }
  }

  return <section className="server-login">
    <h1>{t('server.connect')}</h1>
    <form onSubmit={submit}>
      <label>{t('server.username')}<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
      <label>{t('server.password')}<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p className="server-error" role="alert">{error}</p>}
      <div className="context-actions">
        <button type="button" className="button secondary" onClick={() => navigate(-1)}>{t('common.cancel')}</button>
        <button type="submit" className="button primary" disabled={busy}>{t('server.connect')}</button>
      </div>
    </form>
  </section>
}
