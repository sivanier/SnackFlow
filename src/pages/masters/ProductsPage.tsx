import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Tag, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { canManageMaster } from '../../lib/permissions'
import { localDateString } from '../../lib/dataErrors'
import { requireSupabase } from '../../lib/supabase'
import { useResource } from '../../hooks/useResource'
import { DataPanel, Dialog, FormActions, FormError, FormGrid, LoadState, NewRecordButton, SearchBox, SelectField, TextField, Toolbar } from '../../components/data/DataPrimitives'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatusBadge } from '../../components/ui/StatusBadge'

type Product = { id: string; sku: string; name: string; description: string | null; hsn_code: string | null; pack_size: number; pack_unit_id: string; stock_unit_id: string; gst_rate: number; is_active: boolean; created_at: string; updated_at: string }
type Unit = { id: string; code: string; name: string; symbol: string; dimension: 'mass' | 'volume' | 'count'; factor_to_base: number | null }
type ProductPrice = { id: string; product_id: string; unit_price: number; effective_from: string; effective_to: string | null }
type ProductData = { products: Product[]; units: Unit[]; prices: ProductPrice[] }
type ProductForm = { sku: string; name: string; description: string; hsn_code: string; pack_size: string; pack_unit_id: string; stock_unit_id: string; gst_rate: string; is_active: boolean }
const emptyForm: ProductForm = { sku: '', name: '', description: '', hsn_code: '', pack_size: '', pack_unit_id: '', stock_unit_id: '', gst_rate: '0.05', is_active: true }
const gstOptions = [{ value: '0', label: '0%' }, { value: '0.05', label: '5%' }, { value: '0.12', label: '12%' }, { value: '0.18', label: '18%' }, { value: '0.28', label: '28%' }]

export function ProductsPage() {
  const { profile } = useAuth()
  const canManage = profile ? canManageMaster(profile.role, 'products') : false
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [priceTarget, setPriceTarget] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [price, setPrice] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (): Promise<ProductData> => {
    const client = requireSupabase()
    const [products, units, prices] = await Promise.all([
      client.from('products').select('*').order('name'),
      client.from('units').select('id,code,name,symbol,dimension,factor_to_base').order('name'),
      client.from('product_prices').select('id,product_id,unit_price,effective_from,effective_to').order('effective_from', { ascending: false }),
    ])
    const failure = products.error ?? units.error ?? prices.error
    if (failure) throw failure
    return { products: products.data ?? [], units: units.data ?? [], prices: prices.data ?? [] }
  }, [])
  const resource = useResource(load)
  const data = resource.data ?? { products: [], units: [], prices: [] }
  const today = localDateString()
  const unitMap = useMemo(() => new Map(data.units.map((unit) => [unit.id, unit])), [data.units])
  const currentPriceMap = useMemo(() => {
    const current = new Map<string, ProductPrice>()
    for (const row of data.prices) if (row.effective_from <= today && (!row.effective_to || row.effective_to >= today) && !current.has(row.product_id)) current.set(row.product_id, row)
    return current
  }, [data.prices, today])
  const visibleProducts = data.products.filter((product) => {
    const matchesSearch = `${product.name} ${product.sku} ${product.hsn_code ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
    const matchesStatus = activeFilter === 'all' || (activeFilter === 'active' ? product.is_active : !product.is_active)
    return matchesSearch && matchesStatus
  })

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setFormOpen(true) }
  const openEdit = (product: Product) => {
    setEditing(product); setForm({ sku: product.sku, name: product.name, description: product.description ?? '', hsn_code: product.hsn_code ?? '', pack_size: String(product.pack_size), pack_unit_id: product.pack_unit_id, stock_unit_id: product.stock_unit_id, gst_rate: String(product.gst_rate), is_active: product.is_active }); setFormError(null); setFormOpen(true)
  }
  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null)
    if (!canManage) return
    const packUnit = unitMap.get(form.pack_unit_id)
    const stockUnit = unitMap.get(form.stock_unit_id)
    if (!packUnit || !['mass', 'volume'].includes(packUnit.dimension) || !stockUnit || stockUnit.dimension !== 'count') {
      setFormError('Choose a mass or volume unit for pack size and a count unit for finished-goods stock.')
      return
    }
    setSaving(true)
    try {
      const client = requireSupabase()
      const payload = { sku: form.sku.trim().toUpperCase(), name: form.name.trim(), description: form.description.trim() || null, hsn_code: form.hsn_code.trim().toUpperCase() || null, pack_size: form.pack_size as unknown as number, pack_unit_id: form.pack_unit_id, stock_unit_id: form.stock_unit_id, gst_rate: form.gst_rate as unknown as number, is_active: form.is_active }
      const result = editing ? await client.from('products').update(payload).eq('id', editing.id) : await client.from('products').insert(payload)
      if (result.error) throw result.error
      setFormOpen(false); setEditing(null)
      await resource.reload()
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not save this product.') }
    finally { setSaving(false) }
  }
  const savePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null)
    if (!priceTarget || !canManage) return
    if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) < 0) { setFormError('Enter a non-negative price with up to two decimal places.'); return }
    setSaving(true)
    try {
      const { error } = await requireSupabase().from('product_prices').upsert({ product_id: priceTarget.id, unit_price: price as unknown as number, currency: 'INR', effective_from: today }, { onConflict: 'product_id,effective_from' })
      if (error) throw error
      setPriceTarget(null); await resource.reload()
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not save this price.') }
    finally { setSaving(false) }
  }
  const deleteProduct = async (product: Product) => {
    if (!canManage || !window.confirm(`Delete ${product.name}? Products referenced by stock, BOMs or invoices cannot be deleted.`)) return
    try {
      const { error } = await requireSupabase().from('products').delete().eq('id', product.id)
      if (error) throw error
      setTableError(null); await resource.reload()
    } catch (cause) { setTableError(cause instanceof Error ? cause.message : 'Could not delete this product.') }
  }

  return <div className="mx-auto max-w-[1440px]"><PageHeader eyebrow="Master data · Live Supabase records" title="Products" description="Manage product details, pack sizes, tax rates and effective selling prices." action={canManage ? <NewRecordButton onClick={openCreate}>Add product</NewRecordButton> : undefined}/>
    <DataPanel title="Product catalog" subtitle={`${data.products.length} records · access is enforced by database RLS`}>
      {tableError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{tableError}</p>}
      <Toolbar><SearchBox value={search} onChange={setSearch} placeholder="Search name, SKU or HSN…"/><select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className="h-10 rounded-lg border border-[#e3eae6] bg-white px-3 text-[10px] text-[#586b61] outline-none"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><span className="px-1 text-[9px] text-[#8e9b94]">{visibleProducts.length} shown</span></Toolbar>
      <LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}>{visibleProducts.length ? <DataTable headers={['Product', 'Pack size', 'Selling price', 'GST', 'Status', ...(canManage ? ['Actions'] : [])]}>{visibleProducts.map((product) => { const pack = unitMap.get(product.pack_unit_id); const stock = unitMap.get(product.stock_unit_id); const currentPrice = currentPriceMap.get(product.id); return <tr key={product.id} className="border-b border-[#f0f3f1] last:border-0"><td className="py-3 pr-3"><p className="text-[10px] font-semibold text-[#40544a]">{product.name}</p><p className="mt-0.5 text-[9px] text-[#99a49e]">{product.sku}{product.hsn_code ? ` · HSN ${product.hsn_code}` : ''}</p></td><td className="py-3 pr-3 text-[10px] text-[#64756c]">{product.pack_size} {pack?.symbol ?? ''}<span className="block text-[8px] text-[#9aa69f]">stocked in {stock?.name ?? '—'}</span></td><td className="py-3 pr-3 text-[10px] font-medium text-[#40544a]">{currentPrice ? `₹${Number(currentPrice.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : <span className="text-[#9aa69f]">No current price</span>}</td><td className="py-3 pr-3 text-[10px] text-[#64756c]">{(product.gst_rate * 100).toFixed(2).replace(/\.00$/, '')}%</td><td className="py-3 pr-3"><StatusBadge status={product.is_active ? 'Completed' : 'Pending'}/></td>{canManage && <td className="py-3"><div className="flex items-center gap-1"><button onClick={() => { setPriceTarget(product); setPrice(currentPrice ? String(currentPrice.unit_price) : ''); setFormError(null) }} title="Manage selling price" aria-label={`Manage price for ${product.name}`} className="rounded-md p-2 text-[#718078] hover:bg-[#f2f6f3] hover:text-[#13845b]"><Tag size={14}/></button><button onClick={() => openEdit(product)} title="Edit product" aria-label={`Edit ${product.name}`} className="rounded-md p-2 text-[#718078] hover:bg-[#f2f6f3] hover:text-[#13845b]"><Pencil size={14}/></button><button onClick={() => void deleteProduct(product)} title="Delete product" aria-label={`Delete ${product.name}`} className="rounded-md p-2 text-[#9b7474] hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14}/></button></div></td>}</tr> })}</DataTable> : <EmptyState icon={<span className="text-sm">P</span>} title={search ? 'No matching products' : 'No products yet'} description={search ? 'Try a shorter search term or change the status filter.' : 'Products created in this workspace will appear here.'}/>}</LoadState>
    </DataPanel>

    {formOpen && <Dialog title={editing ? 'Edit product' : 'Add product'} description="Product details are stored in Supabase. Stock is tracked separately through ledger movements." onClose={() => { setFormOpen(false); setEditing(null); setFormError(null) }}><FormGrid onSubmit={saveProduct}><TextField label="SKU" value={form.sku} onChange={(sku) => setForm({ ...form, sku })} required maxLength={40} placeholder="SF-MUR-200"/><TextField label="Product name" value={form.name} onChange={(name) => setForm({ ...form, name })} required maxLength={160} placeholder="Murukku 200 g"/><TextField label="Pack size" value={form.pack_size} onChange={(pack_size) => setForm({ ...form, pack_size })} type="number" required min="0.001" step="0.001"/><SelectField label="Pack unit" value={form.pack_unit_id} onChange={(pack_unit_id) => setForm({ ...form, pack_unit_id })} required options={data.units.filter((unit) => unit.dimension !== 'count').map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` }))}/><SelectField label="Finished stock unit" value={form.stock_unit_id} onChange={(stock_unit_id) => setForm({ ...form, stock_unit_id })} required options={data.units.filter((unit) => unit.dimension === 'count').map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` }))}/><SelectField label="GST rate" value={form.gst_rate} onChange={(gst_rate) => setForm({ ...form, gst_rate })} options={gstOptions}/><TextField label="HSN code" value={form.hsn_code} onChange={(hsn_code) => setForm({ ...form, hsn_code })} maxLength={16} placeholder="Optional"/><label className="block text-[10px] font-medium text-[#53665c] sm:col-span-2">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-xs outline-none focus:border-[#83b797]"/></label><label className="flex items-center gap-2 text-[10px] font-medium text-[#53665c] sm:col-span-2"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="accent-[#13845b]"/>Active for new work</label><div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={() => { setFormOpen(false); setEditing(null); setFormError(null) }} submitting={saving} submitLabel={editing ? 'Save product' : 'Create product'}/></div></FormGrid></Dialog>}
    {priceTarget && <Dialog title={`Selling price · ${priceTarget.name}`} description={`Adds or updates the effective price for ${today}. Historical price rows are retained.`} onClose={() => { setPriceTarget(null); setFormError(null) }}><form onSubmit={savePrice} className="space-y-4"><TextField label="Unit price before tax (INR)" value={price} onChange={setPrice} type="number" required min="0" step="0.01" placeholder="50.00"/><p className="text-[9px] leading-4 text-[#8a9890]">GST is stored on the product; this price remains pre-tax.</p><FormError message={formError}/><FormActions onCancel={() => { setPriceTarget(null); setFormError(null) }} submitting={saving} submitLabel="Save price"/></form></Dialog>}
  </div>
}
