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

  async function login(credentials) {
    const result = await api('/api/auth/login', { method: 'POST', body: credentials })
    setUser(result.user)
    return result.user
  }

  async function logout(allDevices = false) {
    try {
      await api(`/api/auth/${allDevices ? 'logout-all' : 'logout'}`, { method: 'POST', body: {} })
    } finally {
      setUser(null)
    }
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>{children}</AuthContext.Provider>
}

