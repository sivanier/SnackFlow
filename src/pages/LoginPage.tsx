import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, LockKeyhole, Package2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabaseConfigMessage } from '../lib/supabase'

export function LoginPage() {
  const { signIn, session, profile, isLoading, isConfigured, error: authError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  if (isLoading) return <div className="grid min-h-screen place-items-center bg-[#f4f7f5]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d9e8df] border-t-[#13845b]" aria-label="Restoring session"/></div>
  if (session && profile) return <Navigate to="/" replace/>

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setSubmitting(true)
    try { await signIn(email.trim(), password) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed. Check your credentials and try again.') }
    finally { setSubmitting(false) }
  }

  return <div className="grid min-h-screen bg-[#f4f7f5] lg:grid-cols-[1fr_1fr]">
    <section className="relative hidden overflow-hidden bg-[#102c25] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20"><div className="absolute -right-32 -top-24 h-[520px] w-[520px] rounded-full border border-white/[0.06]"/><div className="absolute -right-12 -top-4 h-[280px] w-[280px] rounded-full border border-emerald-200/[0.08]"/><div className="relative flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 text-[#10372b]"><Package2 size={21}/></span><span className="text-lg font-semibold">SnackFlow</span></div><div className="relative max-w-lg"><p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">From Order to Audit</p><h1 className="text-4xl font-semibold leading-[1.15] tracking-[-0.04em] xl:text-5xl">One connected system for your business.</h1><p className="mt-5 max-w-md text-sm leading-7 text-white/55">A considered workspace for orders, production, inventory and finance in packaged-snacks manufacturing.</p></div><p className="relative text-[10px] text-white/35">Secure workspace access · Role-based permissions</p></section>
    <section className="flex items-center justify-center px-5 py-10 sm:px-8"><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-[390px]">
      <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#13845b] text-white"><Package2 size={20}/></span><span className="text-lg font-semibold text-[#1c3429]">SnackFlow</span></div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#16845a]">Welcome back</p><h2 className="mt-2 text-[26px] font-semibold tracking-[-0.04em] text-[#1a2e26]">Sign in to your workspace</h2><p className="mt-2 text-xs leading-5 text-[#829087]">Use the account provided by your workspace owner.</p>
      {!isConfigured && <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-700"/><div><p className="text-[11px] font-semibold text-amber-900">Supabase setup required</p><p className="mt-1 text-[10px] leading-5 text-amber-800">{supabaseConfigMessage}</p><p className="mt-2 text-[10px] leading-5 text-amber-800">Copy <code className="rounded bg-amber-100 px-1">.env.example</code> to <code className="rounded bg-amber-100 px-1">.env.local</code>, set both public project values, and restart the dev server.</p></div></div></div>}
      {session && !profile && authError && <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] leading-5 text-rose-700">{authError}</p>}
      <form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-[10px] font-medium text-[#50635a]">Email address<input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#e1e9e4] bg-white px-3 text-xs text-[#263b31] outline-none placeholder:text-[#a4afa9] focus:border-[#88b99d] focus:ring-2 focus:ring-emerald-50" placeholder="you@company.com"/></label><label className="block text-[10px] font-medium text-[#50635a]">Password<div className="relative mt-1.5"><LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ba8a1]"/><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-[#e1e9e4] bg-white pl-9 pr-3 text-xs text-[#263b31] outline-none focus:border-[#88b99d] focus:ring-2 focus:ring-emerald-50" placeholder="Enter your password"/></div></label>{error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] leading-5 text-rose-700">{error}</p>}<button type="submit" disabled={!isConfigured || submitting || Boolean(session && !profile)} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#13845b] text-xs font-semibold text-white transition hover:bg-[#0d6e4b] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Signing in…' : 'Sign in'}{!submitting && <ArrowRight size={14}/>}</button></form>
      <p className="mt-6 text-center text-[10px] leading-5 text-[#98a49d]">Your access and role are managed securely by your SnackFlow administrator.</p>
    </motion.div></section>
  </div>
}
