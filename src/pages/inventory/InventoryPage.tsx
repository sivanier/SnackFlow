import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, Boxes, Package, PackageOpen, Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { DataPanel, Dialog, FormActions, FormError, FormGrid, LoadState, SearchBox, SelectField, TextField, Toolbar } from '../../components/data/DataPrimitives'
import { DataTable } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { dataErrorMessage } from '../../lib/dataErrors'
import { requireSupabase } from '../../lib/supabase'
import { useResource } from '../../hooks/useResource'

type ItemType = 'raw_material' | 'packaging_material' | 'product'
type MovementType = 'opening_balance' | 'purchase_receipt' | 'production_issue' | 'production_receipt' | 'dispatch' | 'adjustment_in' | 'adjustment_out'
type Balance = { item_type: ItemType; item_id: string; unit_id: string; balance: number }
type Unit = { id: string; code: string; name: string; symbol: string }
type CatalogItem = { id: string; name: string; sku: string; base_unit_id?: string; stock_unit_id?: string; reorder_level?: number }
type Movement = { id: string; item_type: ItemType; raw_material_id: string | null; packaging_material_id: string | null; product_id: string | null; movement_type: MovementType; quantity: number; unit_id: string; source_document_type: string; source_document_id: string | null; user_id: string | null; note: string | null; occurred_at: string; idempotency_key: string }
type InventoryData = { balances: Balance[]; movements: Movement[]; raw: CatalogItem[]; packaging: CatalogItem[]; products: CatalogItem[]; units: Unit[] }
type AdjustmentForm = { item_type: ItemType; item_id: string; direction: 'adjustment_in' | 'adjustment_out'; quantity: string; note: string }
const movementLabels: Record<MovementType, string> = { opening_balance: 'Opening balance', purchase_receipt: 'Purchase receipt', production_issue: 'Production issue', production_receipt: 'Production receipt', dispatch: 'Dispatch', adjustment_in: 'Adjustment in', adjustment_out: 'Adjustment out' }
const initialAdjustment: AdjustmentForm = { item_type: 'raw_material', item_id: '', direction: 'adjustment_in', quantity: '', note: '' }

export function InventoryPage() {
  const { profile } = useAuth()
  const canAdjust = profile?.role === 'owner' || profile?.role === 'admin'
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [movementFilter, setMovementFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<AdjustmentForm>(initialAdjustment)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async (): Promise<InventoryData> => {
    const client = requireSupabase()
    const [balances, movements, raw, packaging, products, units] = await Promise.all([
      client.from('inventory_balances').select('*'),
      client.from('inventory_movements').select('*').order('occurred_at', { ascending: false }).limit(500),
      client.from('raw_materials').select('id,name,sku,base_unit_id,reorder_level'),
      client.from('packaging_materials').select('id,name,sku,base_unit_id,reorder_level'),
      client.from('products').select('id,name,sku,stock_unit_id'),
      client.from('units').select('id,code,name,symbol'),
    ])
    const failure = balances.error ?? movements.error ?? raw.error ?? packaging.error ?? products.error ?? units.error
    if (failure) throw failure
    return { balances: balances.data ?? [], movements: movements.data ?? [], raw: raw.data ?? [], packaging: packaging.data ?? [], products: products.data ?? [], units: units.data ?? [] }
  }, [])
  const resource = useResource(load)
  const data = resource.data ?? { balances: [], movements: [], raw: [], packaging: [], products: [], units: [] }
  const units = useMemo(() => new Map(data.units.map((unit) => [unit.id, unit])), [data.units])
  const catalogs = useMemo(() => ({ raw_material: new Map(data.raw.map((item) => [item.id, item])), packaging_material: new Map(data.packaging.map((item) => [item.id, item])), product: new Map(data.products.map((item) => [item.id, item])) }), [data.raw, data.packaging, data.products])
  const getItemId = (movement: Movement) => movement.raw_material_id ?? movement.packaging_material_id ?? movement.product_id ?? ''
  const getItemName = (movement: Movement) => catalogs[movement.item_type].get(getItemId(movement))?.name ?? 'Item unavailable in your role'
  const getBalanceName = (balance: Balance) => catalogs[balance.item_type].get(balance.item_id)?.name ?? 'Item unavailable in your role'
  const rows = data.movements.filter((movement) => {
    const matchesSearch = `${getItemName(movement)} ${movementLabels[movement.movement_type]} ${movement.source_document_type} ${movement.source_document_id ?? ''} ${movement.note ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
    const matchesType = typeFilter === 'all' || movement.item_type === typeFilter
    const matchesMovement = movementFilter === 'all' || movement.movement_type === movementFilter
    const date = movement.occurred_at.slice(0, 10)
    const matchesFrom = !dateFrom || date >= dateFrom
    const matchesTo = !dateTo || date <= dateTo
    return matchesSearch && matchesType && matchesMovement && matchesFrom && matchesTo
  })
  const lowStockByType = useMemo(() => {
    const low = { raw_material: 0, packaging_material: 0, product: 0 }
    for (const balance of data.balances) {
      const item = catalogs[balance.item_type].get(balance.item_id)
      if (item?.reorder_level !== undefined && balance.balance <= item.reorder_level) low[balance.item_type] += 1
    }
    return low
  }, [data.balances, catalogs])
  const balancesByType = (type: ItemType) => data.balances.filter((balance) => balance.item_type === type)
  const options = form.item_type === 'raw_material' ? data.raw : form.item_type === 'packaging_material' ? data.packaging : data.products
  const selectedItem = options.find((item) => item.id === form.item_id)
  const selectedUnitId = selectedItem ? (form.item_type === 'product' ? selectedItem.stock_unit_id : selectedItem.base_unit_id) ?? '' : ''
  const createAdjustment = () => { setForm(initialAdjustment); setFormError(null); setDialogOpen(true) }
  const recordAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null)
    if (!canAdjust || !selectedItem || !selectedUnitId || !/^\d+(\.\d{1,6})?$/.test(form.quantity) || Number(form.quantity) <= 0) { setFormError('Select an item and enter a positive quantity using up to six decimal places.'); return }
    setSaving(true)
    try {
      const sourceId = crypto.randomUUID(); const sourceLineId = crypto.randomUUID()
      const payload = { item_type: form.item_type, raw_material_id: form.item_type === 'raw_material' ? form.item_id : null, packaging_material_id: form.item_type === 'packaging_material' ? form.item_id : null, product_id: form.item_type === 'product' ? form.item_id : null, movement_type: form.direction, quantity: form.quantity as unknown as number, unit_id: selectedUnitId, source_document_type: 'adjustment', source_document_id: sourceId, source_line_id: sourceLineId, idempotency_key: `inventory-adjustment:${sourceId}:${sourceLineId}`, note: form.note.trim() }
      const { error } = await requireSupabase().from('inventory_movements').insert(payload)
      if (error) throw error
      setDialogOpen(false); await resource.reload()
    } catch (cause) { setFormError(dataErrorMessage(cause)) }
    finally { setSaving(false) }
  }

  const summary = [
    { type: 'raw_material' as const, title: 'Raw materials', icon: PackageOpen, color: 'bg-emerald-50 text-emerald-700' },
    { type: 'packaging_material' as const, title: 'Packaging', icon: Boxes, color: 'bg-sky-50 text-sky-700' },
    { type: 'product' as const, title: 'Finished goods', icon: Package, color: 'bg-amber-50 text-amber-700' },
  ]
  return <div className="mx-auto max-w-[1440px]"><PageHeader eyebrow="Inventory · Live Supabase ledger" title="Inventory" description="Available stock is calculated from posted movements. Ledger entries are immutable." action={<div className="flex gap-2"><button onClick={() => void resource.reload()} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e1e8e4] bg-white text-[#687970] hover:bg-[#f5f8f6]" aria-label="Refresh inventory"><RefreshCw size={14}/></button>{canAdjust && <button onClick={createAdjustment} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#13845b] px-3 text-[10px] font-semibold text-white hover:bg-[#0d6e4b]"><Plus size={14}/>Record adjustment</button>}</div>}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">{summary.map(({ type, title, icon: Icon, color }, i) => { const typeBalances = balancesByType(type); return <DashboardCard key={type} delay={i * 0.05} className="p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-[#829087]">{title}</span><span className={`grid h-8 w-8 place-items-center rounded-lg ${color}`}><Icon size={15}/></span></div><p className="mt-2 text-[21px] font-semibold tracking-tight text-[#1b3127]">{typeBalances.length}<span className="ml-1.5 text-[10px] font-normal text-[#839188]">items tracked</span></p><p className="mt-2 text-[9px] text-[#89968f]">{lowStockByType[type]} at or below reorder level</p></DashboardCard> })}</div>
    <div className="mb-5 grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <DataPanel title="Available stock" subtitle="Balances are read from the inventory_balances database view; quantities remain in each item’s stock unit."><LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}>{data.balances.length ? <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left"><thead><tr>{['Item', 'Category', 'Available', 'Unit', 'Reorder'].map((heading) => <th key={heading} className="border-b border-[#edf1ee] px-2 py-2 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#9aa69f] first:pl-0">{heading}</th>)}</tr></thead><tbody>{data.balances.map((balance) => { const item = catalogs[balance.item_type].get(balance.item_id); const unit = units.get(balance.unit_id); const reorder = item?.reorder_level; const low = reorder !== undefined && balance.balance <= reorder; return <tr key={`${balance.item_type}:${balance.item_id}`} className="border-b border-[#f0f3f1] last:border-0"><td className="py-2.5 pr-2 text-[10px] font-medium text-[#43574d]">{getBalanceName(balance)}<span className="block text-[8px] font-normal text-[#9aa69f]">{item?.sku ?? balance.item_id.slice(0, 8)}</span></td><td className="py-2.5 pr-2 text-[9px] text-[#728178]">{balance.item_type.replace('_', ' ')}</td><td className={`py-2.5 pr-2 text-[11px] font-semibold ${low ? 'text-rose-700' : 'text-[#43574d]'}`}>{balance.balance.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td><td className="py-2.5 pr-2 text-[9px] text-[#728178]">{unit?.symbol ?? '—'}</td><td className="py-2.5 pr-2 text-[9px] text-[#8e9b94]">{reorder === undefined ? '—' : `${reorder} ${unit?.symbol ?? ''}`}</td></tr> })}</tbody></table></div> : <EmptyState icon={<Boxes size={18}/>} title="No stock movements yet" description="Available balances appear when an item has posted inventory movements."/>}</LoadState></DataPanel>
      <DataPanel title="Ledger rules" subtitle="Every balance is derived from append-only movement history."><div className="space-y-3">{[{ title: 'No direct balance editing', description: 'Stock changes are appended to the movement ledger; the balance view is read-only.' }, { title: 'Movement history is immutable', description: 'Posted movement rows cannot be changed or deleted. Corrections require a new movement.' }, { title: 'Database checks availability', description: 'The database rejects issues and dispatches that would make an item’s stock negative.' }].map((rule, index) => <div key={rule.title} className="flex gap-3 rounded-xl bg-[#f6f9f7] p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-[#16845a]">{index === 0 ? <Boxes size={14}/> : index === 1 ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>}</span><div><p className="text-[10px] font-semibold text-[#4a5e53]">{rule.title}</p><p className="mt-0.5 text-[9px] leading-4 text-[#87958d]">{rule.description}</p></div></div>)}</div></DataPanel>
    </div>
    <DataPanel title="Movement ledger" subtitle={`Showing ${rows.length} of up to 500 recent movements visible to your role.`}>
      <Toolbar><SearchBox value={search} onChange={setSearch} placeholder="Search item, source or note…"/><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-10 rounded-lg border border-[#e3eae6] bg-white px-2.5 text-[9px] text-[#586b61] outline-none"><option value="all">All item types</option><option value="raw_material">Raw materials</option><option value="packaging_material">Packaging</option><option value="product">Finished goods</option></select><select value={movementFilter} onChange={(event) => setMovementFilter(event.target.value)} className="h-10 rounded-lg border border-[#e3eae6] bg-white px-2.5 text-[9px] text-[#586b61] outline-none"><option value="all">All movements</option>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="flex items-center gap-1 text-[8px] text-[#89968f]">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-10 rounded-lg border border-[#e3eae6] px-2 text-[9px] text-[#586b61]"/></label><label className="flex items-center gap-1 text-[8px] text-[#89968f]">To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-10 rounded-lg border border-[#e3eae6] px-2 text-[9px] text-[#586b61]"/></label><span className="px-1 text-[9px] text-[#8e9b94]">{rows.length} shown</span></Toolbar>
      <LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}>{rows.length ? <DataTable headers={['Date & time', 'Item', 'Movement', 'Quantity', 'Source', 'Recorded by']} >{rows.map((movement) => { const itemId = getItemId(movement); const item = catalogs[movement.item_type].get(itemId); const unit = units.get(movement.unit_id); const incoming = ['opening_balance', 'purchase_receipt', 'production_receipt', 'adjustment_in'].includes(movement.movement_type); return <tr key={movement.id} className="border-b border-[#f0f3f1] last:border-0"><td className="whitespace-nowrap py-3 pr-3 text-[9px] text-[#728178]">{new Date(movement.occurred_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td><td className="py-3 pr-3 text-[10px] font-medium text-[#43574d]">{getItemName(movement)}<span className="mt-0.5 block text-[8px] font-normal text-[#9aa69f]">{item?.sku ?? itemId.slice(0, 8)}</span></td><td className="py-3 pr-3 text-[9px] text-[#66776e]">{movementLabels[movement.movement_type]}</td><td className={`whitespace-nowrap py-3 pr-3 text-[10px] font-semibold ${incoming ? 'text-emerald-700' : 'text-[#9b5e5e]'}`}>{incoming ? '+' : '−'}{movement.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {unit?.symbol ?? ''}</td><td className="py-3 pr-3 text-[9px] text-[#66776e]">{movement.source_document_type}<span className="mt-0.5 block text-[8px] text-[#9aa69f]">{movement.source_document_id?.slice(0, 8) ?? '—'}{movement.note ? ` · ${movement.note}` : ''}</span></td><td className="py-3 text-[8px] text-[#829087]">{movement.user_id ? `User ${movement.user_id.slice(0, 8)}` : 'System / seed'}</td></tr>})}</DataTable> : <EmptyState icon={<Boxes size={18}/>} title="No movements found" description="Try changing the filters, or wait for authorized ledger postings to appear."/>}</LoadState>
    </DataPanel>
    {dialogOpen && <Dialog title="Record inventory adjustment" description="This appends a new ledger movement. It never edits the calculated stock balance. The database validates the unit and prevents negative stock." onClose={() => { setDialogOpen(false); setFormError(null) }}><FormGrid onSubmit={recordAdjustment}><SelectField label="Item category" value={form.item_type} onChange={(value) => setForm({ ...form, item_type: value as ItemType, item_id: '' })} options={[{ value: 'raw_material', label: 'Raw material' }, { value: 'packaging_material', label: 'Packaging material' }, { value: 'product', label: 'Finished good' }]}/><SelectField label="Adjustment direction" value={form.direction} onChange={(direction) => setForm({ ...form, direction: direction as AdjustmentForm['direction'] })} options={[{ value: 'adjustment_in', label: 'Increase stock' }, { value: 'adjustment_out', label: 'Decrease stock' }]}/><SelectField label="Item" value={form.item_id} onChange={(item_id) => setForm({ ...form, item_id })} required options={options.map((item) => ({ value: item.id, label: `${item.name} · ${item.sku}` }))}/><TextField label="Quantity" value={form.quantity} onChange={(quantity) => setForm({ ...form, quantity })} type="number" required min="0.000001" step="0.000001"/><label className="block text-[10px] font-medium text-[#53665c] sm:col-span-2">Reason / reference note<textarea required value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} maxLength={500} rows={2} className="mt-1.5 w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-xs outline-none focus:border-[#83b797]"/></label><div className="sm:col-span-2 text-[9px] text-[#87958d]">Stock unit: {units.get(selectedUnitId)?.name ?? 'Select an item first'}</div><div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={() => { setDialogOpen(false); setFormError(null) }} submitting={saving} submitLabel="Post ledger movement"/></div></FormGrid></Dialog>}
  </div>
}
