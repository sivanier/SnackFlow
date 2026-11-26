import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigMessage, type Profile } from '../lib/supabase'

type AuthState = {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  error: string | null
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateDisplayName: (displayName: string) => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const profileRequest = useRef(0)

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    const requestId = ++profileRequest.current
    const { data, error: profileError } = await supabase.from('profiles').select('id, display_name, role, created_at, updated_at').eq('id', userId).maybeSingle()
    if (requestId !== profileRequest.current) return
    if (profileError) {
      setProfile(null)
      setError(`Could not load your profile: ${profileError.message}`)
    } else if (!data) {
      setProfile(null)
      setError('Your sign-in exists, but its profile is missing. Ask an owner to review the database profile trigger.')
    } else {
      setProfile(data as Profile)
      setError(null)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }
    let mounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        profileRequest.current += 1
        setProfile(null)
        setIsLoading(false)
      } else {
        setIsLoading(true)
        // Defer the profile query until after the auth callback releases Supabase's auth lock.
        queueMicrotask(() => { void loadProfile(nextSession.user.id).finally(() => { if (mounted) setIsLoading(false) }) })
      }
    })
    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!mounted) return
      if (sessionError) setError(`Could not restore your session: ${sessionError.message}`)
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      if (mounted) setIsLoading(false)
    })
    return () => { mounted = false; subscription.unsubscribe(); profileRequest.current += 1 }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(supabaseConfigMessage ?? 'Supabase is not configured.')
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setError(`Could not sign out: ${signOutError.message}`)
      throw signOutError
    }
    setSession(null)
    setProfile(null)
  }, [])

  const updateDisplayName = useCallback(async (displayName: string) => {
    if (!supabase || !session) throw new Error('You must be signed in to update your profile.')
    const cleanName = displayName.trim()
    if (!cleanName || cleanName.length > 120) throw new Error('Enter a name between 1 and 120 characters.')
    const { data, error: updateError } = await supabase.from('profiles').update({ display_name: cleanName }).eq('id', session.user.id).select('id, display_name, role, created_at, updated_at').single()
    if (updateError) throw updateError
    setProfile(data as Profile)
  }, [session])

  const value = useMemo<AuthState>(() => ({
    session, profile, isLoading, error, isConfigured: Boolean(supabase),
    signIn, signOut, updateDisplayName, clearError: () => setError(null),
  }), [session, profile, isLoading, error, signIn, signOut, updateDisplayName])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
