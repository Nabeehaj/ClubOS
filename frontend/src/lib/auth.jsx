import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { auth, setUnauthorizedHandler, tokenStore } from './api'

const AuthContext = createContext(null)

// status: 'checking' (restoring a saved token) | 'offline' (backend unreachable) | 'anon' | 'authed'
export function AuthProvider({ children }) {
  const qc = useQueryClient()
  const [session, setSession] = useState(() => ({ status: tokenStore.get() ? 'checking' : 'anon' }))

  const signOut = useCallback(() => {
    auth.logout()
    qc.clear()
    setSession({ status: 'anon' })
  }, [qc])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.clear()
      setSession({ status: 'anon', expired: true })
    })
  }, [qc])

  const restore = useCallback(() => {
    setSession({ status: 'checking' })
    auth
      .me()
      .then((me) =>
        setSession({ status: 'authed', user: me.user, clubs: me.clubs ?? [], defaultClubId: me.default_club_id }),
      )
      .catch((err) => {
        if (err?.isNetwork) setSession({ status: 'offline' })
        else signOut()
      })
  }, [signOut])

  useEffect(() => {
    if (session.status === 'checking') restore()
    // only on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = useCallback(async (email, password) => {
    const data = await auth.login(email, password)
    setSession({ status: 'authed', user: data.user, clubs: data.clubs ?? [], defaultClubId: data.default_club_id })
    return data
  }, [])

  const value = useMemo(() => ({ ...session, signIn, signOut, retry: restore }), [session, signIn, signOut, restore])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
