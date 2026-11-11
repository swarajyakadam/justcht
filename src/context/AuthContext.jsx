import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { AuthContext } from './authContextValue.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api('/api/auth/me')
      .then(({ user: currentUser }) => { if (active) setUser(currentUser) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user) return
    const sessionOnly = sessionStorage.getItem('pc-session-only') === '1'
    if (!sessionOnly) return
    function handleUnload() {
      navigator.sendBeacon('/api/auth/logout')
    }
    window.addEventListener('pagehide', handleUnload)
    return () => window.removeEventListener('pagehide', handleUnload)
  }, [user])

  async function login(credentials) {
    const result = await api('/api/auth/login', { method: 'POST', body: credentials })
    sessionStorage.setItem('pc-session-only', credentials.rememberMe ? '0' : '1')
    setUser(result.user)
    return result.user
  }

  async function logout(allDevices = false) {
    try {
      await api(`/api/auth/${allDevices ? 'logout-all' : 'logout'}`, { method: 'POST', body: {} })
    } finally {
      sessionStorage.removeItem('pc-session-only')
      setUser(null)
    }
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>{children}</AuthContext.Provider>
}

