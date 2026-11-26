import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CircleDollarSign, Clock3, Factory, ShoppingCart, Sparkles, TrendingUp } from 'lucide-react'
import { DashboardCard } from '../components/ui/DashboardCard'
import { ChartCard } from '../components/ui/ChartCard'
import { DataTable } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { ProductCard, type ProductDemo } from '../components/ui/ProductCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useAuth } from '../auth/AuthProvider'
import { roleLabels } from '../lib/permissions'

const monthData = [
  { month: 'Jan', sales: 42, orders: 35 }, { month: 'Feb', sales: 48, orders: 39 }, { month: 'Mar', sales: 44, orders: 37 },
  { month: 'Apr', sales: 58, orders: 48 }, { month: 'May', sales: 54, orders: 45 }, { month: 'Jun', sales: 67, orders: 54 },
  { month: 'Jul', sales: 62, orders: 49 }, { month: 'Aug', sales: 75, orders: 61 }, { month: 'Sep', sales: 69, orders: 57 },
  { month: 'Oct', sales: 84, orders: 68 }, { month: 'Nov', sales: 78, orders: 63 }, { month: 'Dec', sales: 96, orders: 76 },
]
const weekData = [{ month: 'Mon', sales: 8, orders: 7 }, { month: 'Tue', sales: 12, orders: 9 }, { month: 'Wed', sales: 9, orders: 8 }, { month: 'Thu', sales: 15, orders: 12 }, { month: 'Fri', sales: 13, orders: 11 }, { month: 'Sat', sales: 18, orders: 14 }, { month: 'Sun', sales: 11, orders: 9 }]
const products: ProductDemo[] = [
  { name: 'Murukku · 200 g', category: 'Traditional snacks', price: '₹50.00', stock: '238 pcs', status: 'Completed', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=640&q=80' },
  { name: 'Madras Mixture · 200 g', category: 'Savory mixture', price: '₹55.00', stock: '164 pcs', status: 'Completed', image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=640&q=80' },
  { name: 'Banana Chips · 150 g', category: 'Crisps & chips', price: '₹45.00', stock: '42 pcs', status: 'Low stock', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=640&q=80' },
  { name: 'Mysore Pak · 250 g', category: 'Traditional sweets', price: '₹120.00', stock: '86 pcs', status: 'Completed', image: 'https://images.unsplash.com/photo-1605197161470-5d7c8a2e2c38?auto=format&fit=crop&w=640&q=80' },
]
const activity = [
  { icon: ShoppingCart, tone: 'bg-emerald-50 text-emerald-700', text: 'New order received', detail: 'Retailer A · 150 packets', time: '10 min ago' },
  { icon: Factory, tone: 'bg-sky-50 text-sky-700', text: 'Production run completed', detail: 'Murukku 200 g · 188 good packs', time: '1 hr ago' },
  { icon: Boxes, tone: 'bg-amber-50 text-amber-700', text: 'Stock running low', detail: 'Banana chips · 42 packets left', time: '2 hrs ago' },
  { icon: CircleDollarSign, tone: 'bg-violet-50 text-violet-700', text: 'Payment recorded', detail: 'Retailer A · ₹4,000.00', time: '3 hrs ago' },
]

function CountUp({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { duration: 1300, bounce: 0 })
  const rounded = useTransform(spring, (latest: number) => `${prefix}${Math.round(latest).toLocaleString('en-IN')}${suffix}`)
  const [display, setDisplay] = useState(`${prefix}0${suffix}`)
  useEffect(() => { const unsubscribe = rounded.on('change', setDisplay); motionValue.set(value); return unsubscribe }, [motionValue, rounded, value])
  return <motion.span>{display}</motion.span>
}

const kpis = [
  { title: 'Total sales', value: 284650, prefix: '₹', change: '+12.8%', trend: 'up', detail: 'vs. previous month', icon: CircleDollarSign, tint: 'bg-emerald-50 text-emerald-700' },
  { title: 'Orders received', value: 1248, change: '+8.2%', trend: 'up', detail: 'vs. previous month', icon: ShoppingCart, tint: 'bg-sky-50 text-sky-700' },
  { title: 'Production output', value: 8640, suffix: ' pkts', change: '-2.4%', trend: 'down', detail: 'vs. previous month', icon: Factory, tint: 'bg-amber-50 text-amber-700' },
  { title: 'Receivables', value: 68420, prefix: '₹', change: '12 invoices', trend: 'flat', detail: 'awaiting payment', icon: Clock3, tint: 'bg-violet-50 text-violet-700' },
]
const stock = [{ label: 'Raw materials', amount: '68%', sub: 'Flour, oil & spices', color: 'bg-emerald-500', pct: 68 }, { label: 'Packaging', amount: '42%', sub: 'Pouches & cartons', color: 'bg-sky-500', pct: 42 }, { label: 'Finished goods', amount: '81%', sub: 'Ready to dispatch', color: 'bg-amber-500', pct: 81 }]

export function PhaseOnePage() {
  const { profile } = useAuth()
  const [range, setRange] = useState<'This year' | 'This week'>('This year')
  const chartData = range === 'This year' ? monthData : weekData
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[1440px]">
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#dcece2] bg-[#eff7f1] px-3 py-2 text-[9px] text-[#47715a]"><Sparkles size={13} className="shrink-0"/><span><strong>Illustrative demo data</strong> · Preview figures are for interface demonstration only and are not connected to live business records.</span></div>
    <PageHeader eyebrow={`${today} · ${profile ? roleLabels[profile.role] : 'Workspace'}`} title={`Welcome back${profile?.display_name ? `, ${profile.display_name}` : ''}`} description="Here’s an overview of your business at a glance." action={<label className="flex h-9 items-center gap-2 rounded-lg border border-[#e1e8e4] bg-white px-3 text-[10px] font-medium text-[#586b61] shadow-sm hover:border-[#bdd7c8]"><Clock3 size={13}/><select value={range} onChange={(e) => setRange(e.target.value as 'This year' | 'This week')} className="cursor-pointer bg-transparent outline-none"><option>This year</option><option>This week</option></select><ChevronDownIcon/></label>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(({ title, value, prefix, suffix, change, trend, detail, icon: Icon, tint }, i) => <DashboardCard key={title} delay={i * 0.06} className="p-4"><div className="flex items-start justify-between"><span className="text-[10px] font-medium text-[#829087]">{title}</span><span className={`grid h-8 w-8 place-items-center rounded-lg ${tint}`}><Icon size={15}/></span></div><p className="mt-2 text-[21px] font-semibold tracking-tight text-[#1b3127]"><CountUp value={value} prefix={prefix} suffix={suffix}/></p><div className="mt-2 flex items-center gap-1.5 text-[9px]">{trend === 'down' ? <ArrowDownRight size={12} className="text-rose-600"/> : trend === 'up' ? <ArrowUpRight size={12} className="text-emerald-600"/> : <Activity size={11} className="text-violet-600"/>}<span className={trend === 'down' ? 'font-medium text-rose-600' : trend === 'up' ? 'font-medium text-emerald-700' : 'font-medium text-violet-700'}>{change}</span><span className="text-[#a0aaa4]">{detail}</span></div></DashboardCard>)}</div>
    <div className="mb-5 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <ChartCard title="Sales overview" subtitle="Illustrative revenue and order trend">
        <div className="mb-3 flex items-center gap-4 text-[9px] text-[#8d9b93]"><span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-emerald-600"/>Sales (₹ thousands)</span><span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[#bccdc2]"/>Orders</span></div>
        <div className="h-[218px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#149366" stopOpacity={0.18}/><stop offset="95%" stopColor="#149366" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf1ee" strokeDasharray="3 4"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#98a59e', fontSize: 9 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#98a59e', fontSize: 9 }}/><Tooltip contentStyle={{ border: '1px solid #e7ece9', borderRadius: 10, fontSize: 10 }}/><Area type="monotone" dataKey="sales" name="Sales (₹k)" stroke="#16865c" strokeWidth={2.5} fill="url(#salesFill)" animationDuration={900}/><Area type="monotone" dataKey="orders" name="Orders" stroke="#b4c8bc" strokeWidth={1.7} fill="transparent" animationDuration={1100}/></AreaChart></ResponsiveContainer></div>
      </ChartCard>
      <ChartCard title="Production overview" subtitle="Planned vs. actual output · demo" action={<span className="rounded-md bg-[#f4f7f5] px-2 py-1.5 text-[9px] text-[#819087]">Weekly</span>}>
        <div className="h-[160px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ day: 'Mon', planned: 400, actual: 380 }, { day: 'Tue', planned: 400, actual: 420 }, { day: 'Wed', planned: 400, actual: 390 }, { day: 'Thu', planned: 400, actual: 360 }, { day: 'Fri', planned: 400, actual: 410 }, { day: 'Sat', planned: 400, actual: 385 }]} margin={{ top: 6, right: 0, left: -27, bottom: 0 }} barGap={3}><CartesianGrid vertical={false} stroke="#edf1ee" strokeDasharray="3 4"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#98a59e', fontSize: 8 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#98a59e', fontSize: 8 }}/><Tooltip contentStyle={{ border: '1px solid #e7ece9', borderRadius: 10, fontSize: 10 }}/><Bar dataKey="planned" name="Planned" fill="#e7efea" radius={[3,3,0,0]} animationDuration={700}/><Bar dataKey="actual" name="Actual" fill="#1b9668" radius={[3,3,0,0]} animationDuration={900}/></BarChart></ResponsiveContainer></div>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-[#f4f8f5] px-3 py-2"><div><p className="text-[8px] text-[#8a9890]">Yield efficiency</p><p className="mt-0.5 text-[13px] font-semibold text-[#315441]">96.8%</p></div><span className="flex items-center gap-1 text-[9px] text-emerald-700"><TrendingUp size={12}/> +1.6%</span></div>
      </ChartCard>
    </div>
    <div className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <ChartCard title="Recent orders" subtitle="A snapshot of recent activity · illustrative" action={<span className="text-[9px] font-medium text-[#16845a]">View all <ArrowRight size={11} className="ml-0.5 inline"/></span>}>
        <DataTable headers={['Order', 'Customer', 'Date', 'Amount', 'Status']}><tr className="table-row"><td className="py-3 pr-3 text-[10px] font-semibold text-[#43574d]">#SF-2841</td><td className="py-3 pr-3 text-[10px] text-[#65766d]">Retailer A</td><td className="py-3 pr-3 text-[9px] text-[#96a29b]">24 Nov, 10:42</td><td className="py-3 pr-3 text-[10px] font-medium text-[#43574d]">₹7,875.00</td><td className="py-3"><StatusBadge status="Completed"/></td></tr><tr className="table-row"><td className="py-3 pr-3 text-[10px] font-semibold text-[#43574d]">#SF-2840</td><td className="py-3 pr-3 text-[10px] text-[#65766d]">Distributor B</td><td className="py-3 pr-3 text-[9px] text-[#96a29b]">24 Nov, 09:18</td><td className="py-3 pr-3 text-[10px] font-medium text-[#43574d]">₹6,300.00</td><td className="py-3"><StatusBadge status="Pending"/></td></tr><tr className="table-row"><td className="py-3 pr-3 text-[10px] font-semibold text-[#43574d]">#SF-2839</td><td className="py-3 pr-3 text-[10px] text-[#65766d]">Green Mart</td><td className="py-3 pr-3 text-[9px] text-[#96a29b]">23 Nov, 16:05</td><td className="py-3 pr-3 text-[10px] font-medium text-[#43574d]">₹4,500.00</td><td className="py-3"><StatusBadge status="In production"/></td></tr></DataTable>
      </ChartCard>
      <ChartCard title="Inventory status" subtitle="Illustrative stock position by category" action={<span className="rounded-md p-1 text-[#9aa69f]"><Boxes size={14}/></span>}>
        <div className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[130px_1fr]"><div className="h-[140px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Raw materials', value: 68 }, { name: 'Packaging', value: 42 }, { name: 'Finished goods', value: 81 }]} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={5} stroke="none" animationDuration={800}>{['#159366','#61b891','#bddbc7'].map((color, i) => <Cell key={i} fill={color}/>)}</Pie><Tooltip contentStyle={{ border: '1px solid #e7ece9', borderRadius: 10, fontSize: 10 }}/></PieChart></ResponsiveContainer></div><div className="space-y-4">{stock.map((s) => <div key={s.label}><div className="mb-1 flex justify-between"><span className="text-[9px] font-medium text-[#596b61]">{s.label}</span><span className="text-[9px] font-semibold text-[#465a4f]">{s.amount}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#f0f3f1]"><motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.8, delay: 0.2 }} className={`h-full rounded-full ${s.color}`}/></div><p className="mt-1 text-[8px] text-[#a0aba5]">{s.sub}</p></div>)}</div></div>
      </ChartCard>
    </div>
    <div className="mb-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      <ChartCard title="Popular products" subtitle="Product catalog preview · illustrative" action={<span className="text-[9px] font-medium text-[#16845a]">Product catalog <ArrowRight size={11} className="ml-0.5 inline"/></span>}><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.name} product={product}/>)}</div></ChartCard>
      <ChartCard title="Recent activity" subtitle="Latest workspace events · demo" action={<span className="rounded-md p-1 text-[#9aa69f]"><Activity size={14}/></span>}><div className="space-y-0.5">{activity.map(({ icon: Icon, tone, text, detail, time }, i) => <motion.div key={text} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }} className="flex gap-3 border-b border-[#f0f3f1] py-3 last:border-0"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={13}/></span><div className="min-w-0 flex-1"><p className="text-[10px] font-medium text-[#4a5e53]">{text}</p><p className="mt-0.5 truncate text-[9px] text-[#95a199]">{detail}</p></div><span className="whitespace-nowrap pt-0.5 text-[8px] text-[#a4afa9]">{time}</span></motion.div>)}</div></ChartCard>
    </div>
  </motion.div>
}

function ChevronDownIcon() { return <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> }
