import { Navigate, Outlet } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import type { AppRole } from '../lib/supabase'

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: AppRole[] }) {
  const { session, profile, isLoading, error } = useAuth()
  if (isLoading) return <div className="min-h-screen bg-[#f4f7f5] p-8"><div className="mx-auto max-w-md"><LoadingSkeleton lines={4}/><p className="mt-3 text-center text-xs text-[#718078]">Restoring your secure session…</p></div></div>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <div className="grid min-h-screen place-items-center bg-[#f4f7f5] p-5"><div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm"><ShieldAlert className="mx-auto text-amber-600" size={24}/><h1 className="mt-3 text-lg font-semibold text-[#24382f]">Profile unavailable</h1><p className="mt-2 text-sm leading-6 text-[#75847c]">{error ?? 'Your account profile could not be loaded.'}</p></div></div>
  if (allowedRoles && !allowedRoles.includes(profile.role)) return <div className="grid min-h-screen place-items-center bg-[#f4f7f5] p-5"><div className="max-w-md rounded-2xl border border-[#e5ebe7] bg-white p-6 text-center shadow-sm"><ShieldAlert className="mx-auto text-[#16845a]" size={24}/><h1 className="mt-3 text-lg font-semibold text-[#24382f]">This module is not in your workspace</h1><p className="mt-2 text-sm leading-6 text-[#75847c]">Your assigned role does not include this preview area. Database access is independently enforced by PostgreSQL RLS.</p></div></div>
  return <Outlet />
}
