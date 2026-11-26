import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Archive, Bell, Boxes, ChevronDown, ChevronLeft, CircleHelp, ClipboardList, Factory, FileText, FlaskConical, LayoutDashboard, Menu, Package, Ruler, Search, Settings, ShoppingBag, Truck, Users, Wallet, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { canSeeModule, roleLabels } from '../../lib/permissions'
import type { AppRole } from '../../lib/supabase'
import { Topbar } from './Topbar'

export const modules: { label: string; path: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard }, { label: 'Production', path: '/production', icon: Factory }, { label: 'Orders', path: '/orders', icon: ClipboardList },
  { label: 'Products', path: '/products', icon: Package }, { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Materials', path: '/materials', icon: FlaskConical }, { label: 'Suppliers', path: '/suppliers', icon: Truck }, { label: 'Units', path: '/units', icon: Ruler },
  { label: 'Inventory', path: '/inventory', icon: Boxes },
  { label: 'BOM', path: '/bom', icon: Archive }, { label: 'Purchases', path: '/purchases', icon: ShoppingBag },
  { label: 'Invoices', path: '/invoices', icon: FileText }, { label: 'Payments', path: '/payments', icon: Wallet },
  { label: 'Reports', path: '/reports', icon: Activity }, { label: 'Settings', path: '/settings', icon: Settings },
]

export function Sidebar({ role, collapsed, onToggle, mobile = false, onNavigate }: { role: AppRole; collapsed: boolean; onToggle?: () => void; mobile?: boolean; onNavigate?: () => void }) {
  const { profile } = useAuth()
  const compact = collapsed && !mobile
  const name = profile?.display_name || 'Your profile'
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const available = modules.filter(({ label }) => label !== 'Settings' && canSeeModule(role, label))
  return <aside className={`flex h-full flex-col bg-[#102c25] text-white ${mobile ? 'w-[276px]' : compact ? 'w-[76px]' : 'w-[252px]'} transition-[width] duration-300`}>
    <div className="relative flex h-[74px] items-center justify-between px-5"><NavLink to="/" onClick={onNavigate} className="flex items-center gap-3 overflow-hidden"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400 text-[#10372b]"><Package size={19} strokeWidth={2.3}/></span>{(!compact || mobile) && <span className="whitespace-nowrap text-[17px] font-semibold tracking-tight">SnackFlow<span className="ml-1.5 align-top text-[9px] font-medium text-emerald-300">ERP</span></span>}</NavLink>{mobile && <button onClick={onNavigate} aria-label="Close navigation" className="rounded-lg p-2 text-white/60 hover:bg-white/10"><X size={18}/></button>}{!mobile && onToggle && <button onClick={onToggle} aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} className="absolute -right-3 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-[#17382f] text-white/70 shadow-md hover:text-white"><ChevronLeft className={`h-4 w-4 transition-transform ${compact ? 'rotate-180' : ''}`}/></button>}</div>
    {(!compact || mobile) && <div className="px-4 pb-4"><div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300"><Factory size={16}/></span><span className="min-w-0"><span className="block truncate text-xs font-medium">Manufacturing workspace</span><span className="mt-0.5 block text-[10px] text-white/45">Tamil Nadu</span></span></div></div>}
    <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 pb-4">{(!compact || mobile) && <p className="mb-2 px-3 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">Workspace</p>}<div className="space-y-1">{available.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} title={compact ? label : undefined} onClick={onNavigate} className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-colors ${isActive ? 'bg-emerald-400 text-[#10372b] shadow-sm' : 'text-white/65 hover:bg-white/[0.07] hover:text-white'} ${compact ? 'justify-center px-0' : ''}`}><Icon size={17} strokeWidth={1.8}/>{(!compact || mobile) && <span className="flex-1">{label}</span>}</NavLink>)}</div>{canSeeModule(role, 'Settings') && <><p className="mb-2 mt-7 px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">System</p><NavLink to="/settings" title={compact ? 'Settings' : undefined} onClick={onNavigate} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-colors ${isActive ? 'bg-emerald-400 text-[#10372b]' : 'text-white/65 hover:bg-white/[0.07] hover:text-white'} ${compact ? 'justify-center px-0' : ''}`}><Settings size={17}/>{(!compact || mobile) && <span>Settings</span>}</NavLink></>}</nav>
    {(!compact || mobile) && <div className="mx-3 mb-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3"><div className="flex items-center gap-2 text-emerald-300"><CircleHelp size={14}/><span className="text-[10px] font-medium text-white/80">Need a hand?</span></div><p className="mt-1.5 text-[10px] leading-4 text-white/40">Your workspace guide is here to help.</p></div>}
    <div className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-4"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d8e9dd] text-[10px] font-bold text-[#17382f]">{initials}</div>{(!compact || mobile) && <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium">{name}</p><p className="text-[10px] text-white/40">{roleLabels[role]}</p></div>}</div>
  </aside>
}

export function AppShell() {
  const { profile, signOut, updateDisplayName } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState(profile?.display_name ?? '')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const role = profile?.role ?? 'salesman'
  const displayName = profile?.display_name || 'Your profile'
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  useEffect(() => setProfileName(profile?.display_name ?? ''), [profile?.display_name])

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMessage('')
    try { await updateDisplayName(profileName); setProfileMessage('Name saved.') }
    catch (error) { setProfileMessage(error instanceof Error ? error.message : 'Profile update failed.') }
    finally { setProfileSaving(false) }
  }
  const logOut = async () => {
    try { await signOut(); navigate('/login', { replace: true }) }
    catch { setProfileMessage('Sign out failed. Please try again.') }
  }

  return <div className="flex min-h-screen bg-[#f4f7f5] text-[#192b25]">
    <div className="hidden shrink-0 md:block"><Sidebar role={role} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)}/></div>
    <AnimatePresence>{mobileOpen && <><motion.button aria-label="Close navigation overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-[#0c211b]/55 md:hidden"/><motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 28 }} className="fixed inset-y-0 left-0 z-50 md:hidden"><Sidebar role={role} collapsed={false} mobile onNavigate={() => setMobileOpen(false)}/></motion.div></>}</AnimatePresence>
    <div className="flex min-w-0 flex-1 flex-col">
      <Topbar>
        <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-[#62746c] hover:bg-[#f4f7f5] md:hidden" aria-label="Open navigation"><Menu size={19}/></button><div className="hidden items-center gap-2 text-[11px] text-[#87958e] sm:flex"><span>Workspace</span><span>/</span><span className="font-medium text-[#32473e]">Overview</span></div><span className="text-xs font-semibold md:hidden">SnackFlow</span></div>
        <div className="flex items-center gap-2 sm:gap-3"><div className={`relative transition-all ${searchOpen ? 'w-40 sm:w-64' : ''}`}><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91a098]" size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => setSearchOpen(true)} onBlur={() => { if (!search) setSearchOpen(false) }} placeholder={searchOpen ? 'Search workspace...' : 'Search'} className={`h-9 rounded-lg border border-transparent bg-[#f5f7f6] pl-9 pr-3 text-[11px] text-[#33483f] outline-none transition-all placeholder:text-[#93a199] focus:border-[#cbded3] focus:bg-white ${searchOpen ? 'w-full' : 'w-[92px] sm:w-[154px]'}`} aria-label="Search workspace"/></div>
          <div className="relative"><button onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }} aria-label="Notifications" className={`relative grid h-9 w-9 place-items-center rounded-lg hover:bg-[#f4f7f5] ${notificationsOpen ? 'bg-[#f4f7f5]' : ''}`}><Bell size={17} className="text-[#66776f]"/></button>{notificationsOpen && <div className="absolute right-0 top-12 w-72 rounded-xl border border-[#e7ece9] bg-white p-4 shadow-xl"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Notifications</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] text-emerald-700">Preview</span></div><p className="mt-3 border-t border-[#edf1ee] pt-3 text-[11px] leading-5 text-[#77877f]">Notifications will appear here when that module is connected.</p></div>}</div>
          <div className="relative border-l border-[#edf0ee] pl-2 sm:pl-3"><button onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); setProfileMessage('') }} className="flex items-center gap-2 rounded-lg p-1 hover:bg-[#f6f8f7]" aria-label="Open profile menu"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#dceae1] text-[10px] font-bold text-[#25684e]">{initials}</span><span className="hidden text-left sm:block"><span className="block max-w-32 truncate text-[10px] font-semibold text-[#34483f]">{displayName}</span><span className="block text-[9px] text-[#8b9992]">{roleLabels[role]}</span></span><ChevronDown size={13} className="hidden text-[#93a098] sm:block"/></button>{profileOpen && <div className="absolute right-0 top-12 w-64 rounded-xl border border-[#e7ece9] bg-white p-3 shadow-xl"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#84928b]">Your profile</p><label className="block text-[9px] font-medium text-[#607168]">Display name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={120} className="mt-1 h-9 w-full rounded-lg border border-[#e4ebe6] px-2 text-[11px] text-[#33483f] outline-none focus:border-emerald-400"/></label><p className="mt-2 text-[9px] text-[#8b9992]">Role: {roleLabels[role]} · managed by an owner</p>{profileMessage && <p role="status" className="mt-2 text-[9px] text-[#47715a]">{profileMessage}</p>}<div className="mt-3 flex gap-2"><button onClick={() => void saveProfile()} disabled={profileSaving} className="rounded-lg bg-[#13845b] px-3 py-2 text-[10px] font-medium text-white disabled:opacity-60">{profileSaving ? 'Saving…' : 'Save name'}</button><button onClick={() => void logOut()} className="rounded-lg border border-[#e6ece8] px-3 py-2 text-[10px] font-medium text-[#52645b] hover:bg-[#f4f7f5]">Sign out</button></div></div>}</div>
        </div>
      </Topbar>
      {search && <div className="border-b border-emerald-100 bg-emerald-50/70 px-6 py-2 text-[10px] text-emerald-800">Search is a design preview and is not connected to records. You entered “{search}”. <button onClick={() => setSearch('')} className="ml-2 font-semibold underline">Clear</button></div>}
      <main className="flex-1 px-4 py-6 sm:px-7 sm:py-7 lg:px-9"><AnimatePresence mode="wait"><Outlet/></AnimatePresence></main>
      <footer className="px-4 pb-5 text-center text-[9px] text-[#9aa69f] sm:px-7 lg:px-9">SnackFlow · From Order to Audit. One Connected System. <span className="mx-1.5">•</span> Frontend preview</footer>
    </div>
  </div>
}
