import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { API_URL, AUTH_KEY, logout } from './api'
import { getSyncStatus, startSync, stopSync, type SyncStatus } from './sync'
import './server.css'

export function ServerControls() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [connected, setConnected] = useState(() => Boolean(localStorage.getItem(AUTH_KEY)))
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus())

  useEffect(() => {
    if (!API_URL) return
    if (connected) startSync()
    else stopSync()
    const onLogout = () => setConnected(false)
    const onStatus = (event: Event) => setStatus((event as CustomEvent<SyncStatus>).detail)
    window.addEventListener('cognition-pipeline:logout', onLogout)
    window.addEventListener('cognition-pipeline:sync-status', onStatus)
    return () => {
      window.removeEventListener('cognition-pipeline:logout', onLogout)
      window.removeEventListener('cognition-pipeline:sync-status', onStatus)
    }
  }, [connected])

  if (!API_URL) return null
  return <div className="server-controls">
    {connected && <span className={`sync-pill sync-${status}`}>{t(`server.${status}` as never)}</span>}
    <button className="button secondary" onClick={() => {
      if (connected) {
        logout()
        stopSync()
      } else navigate('/login')
    }}>{connected ? t('server.disconnect') : t('server.connect')}</button>
  </div>
}
