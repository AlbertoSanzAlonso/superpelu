import { useEffect, useState } from 'react'
import { verifyAdminToken } from '@/lib/api'

export const ADMIN_TOKEN_KEY = 'superpelu-admin-token'

export function useAdminSession() {
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) ?? '')
  const [authOk, setAuthOk] = useState<boolean | null>(null)

  useEffect(() => {
    if (!adminToken) {
      setAuthOk(false)
      return
    }
    verifyAdminToken(adminToken)
      .then(() => setAuthOk(true))
      .catch(() => {
        localStorage.removeItem(ADMIN_TOKEN_KEY)
        setAdminToken('')
        setAuthOk(false)
      })
  }, [adminToken])

  function handleLogout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    setAdminToken('')
    setAuthOk(false)
  }

  return { adminToken, authOk, handleLogout }
}
