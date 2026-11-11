import { useContext } from 'react'
import { AuthContext } from './authContextValue.js'

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}