import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Archive, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { canManageMaster } from '../../lib/permissions'
import { requireSupabase } from '../../lib/supabase'
import { useResource } from '../../hooks/useResource'
import { DataPanel, Dialog, FormActions, FormError, FormGrid, LoadState, NewRecordButton, SearchBox, SelectField, TextField, Toolbar } from '../../components/data/DataPrimitives'
import { DataTable } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

type Bom = { id: string; product_id: string; version: number; expected_output: number; output_unit_id: string; is_active: boolean; created_at: string }
type Product = { id: string; sku: string; name: string; stock_unit_id: string; is_active: boolean }
type Material = { id: string; sku: string; name: string; base_unit_id: string; is_active: boolean }
type Unit = { id: string; code: string; name: string; symbol: string; dimension: 'mass' | 'volume' | 'count' }
type BomItem = { id: string; bom_header_id: string; raw_material_id: string | null; packaging_material_id: string | null; quantity: number; unit_id: string; notes: string | null; created_at: string }
type BomData = { headers: Bom[]; items: BomItem[]; products: Product[]; raw: Material[]; packaging: Material[]; units: Unit[] }
type HeaderForm = { product_id: string; version: string; expected_output: string; output_unit_id: string; is_active: boolean }
type ItemForm = { item_type: 'raw_material' | 'packaging_material'; item_id: string; quantity: string; notes: string }
const emptyHeader: HeaderForm = { product_id: '', version: '1', expected_output: '', output_unit_id: '', is_active: true }
const emptyItem: ItemForm = { item_type: 'raw_material', item_id: '', quantity: '', notes: '' }

export function BOMPage() {
  const { profile } = useAuth()
  const canManage = profile ? canManageMaster(profile.role, 'bom') : false
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [headerDialog, setHeaderDialog] = useState(false)
  const [itemDialog, setItemDialog] = useState(false)
  const [editingHeader, setEditingHeader] = useState<Bom | null>(null)
  const [editingItem, setEditingItem] = useState<BomItem | null>(null)
  const [headerForm, setHeaderForm] = useState<HeaderForm>(emptyHeader)
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItem)
  const [formError, setFormError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async (): Promise<BomData> => {
    const client = requireSupabase()
    const [headers, items, products, raw, packaging, units] = await Promise.all([
      client.from('bom_headers').select('*').order('product_id').order('version', { ascending: false }),
      client.from('bom_items').select('*').order('created_at'),
      client.from('products').select('id,sku,name,stock_unit_id,is_active').order('name'),
      client.from('raw_materials').select('id,sku,name,base_unit_id,is_active').order('name'),
      client.from('packaging_materials').select('id,sku,name,base_unit_id,is_active').order('name'),
      client.from('units').select('id,code,name,symbol,dimension').order('name'),
    ])
    const failure = headers.error ?? items.error ?? products.error ?? raw.error ?? packaging.error ?? units.error
    if (failure) throw failure
    return { headers: headers.data ?? [], items: items.data ?? [], products: products.data ?? [], raw: raw.data ?? [], packaging: packaging.data ?? [], units: units.data ?? [] }
  }, [])
  const resource = useResource(load)
  const data = resource.data ?? { headers: [], items: [], products: [], raw: [], packaging: [], units: [] }
  const productMap = useMemo(() => new Map(data.products.map((row) => [row.id, row])), [data.products])
  const unitMap = useMemo(() => new Map(data.units.map((row) => [row.id, row])), [data.units])
  const selectedHeader = data.headers.find((row) => row.id === selectedId) ?? data.headers.find((row) => row.is_active) ?? data.headers[0] ?? null
  const selectedItems = selectedHeader ? data.items.filter((item) => item.bom_header_id === selectedHeader.id) : []
  const visibleHeaders = data.headers.filter((header) => `${productMap.get(header.product_id)?.name ?? ''} ${productMap.get(header.product_id)?.sku ?? ''} ${header.version}`.toLowerCase().includes(search.trim().toLowerCase()))
  const itemOptions = itemForm.item_type === 'raw_material' ? data.raw : data.packaging
  const selectedItem = itemOptions.find((item) => item.id === itemForm.item_id)
  const openCreateHeader = () => { setEditingHeader(null); setHeaderForm(emptyHeader); setFormError(null); setHeaderDialog(true) }
  const openEditHeader = (header: Bom) => { setEditingHeader(header); setHeaderForm({ product_id: header.product_id, version: String(header.version), expected_output: String(header.expected_output), output_unit_id: header.output_unit_id, is_active: header.is_active }); setFormError(null); setHeaderDialog(true) }
  const chooseProduct = (productId: string) => { const product = data.products.find((row) => row.id === productId); setHeaderForm({ ...headerForm, product_id: productId, output_unit_id: product?.stock_unit_id ?? '' }) }
  const saveHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null); setSaving(true)
    try {
      const payload = { product_id: headerForm.product_id, version: headerForm.version as unknown as number, expected_output: headerForm.expected_output as unknown as number, output_unit_id: headerForm.output_unit_id, is_active: headerForm.is_active }
      const result = editingHeader ? await requireSupabase().from('bom_headers').update(payload).eq('id', editingHeader.id).select('id').single() : await requireSupabase().from('bom_headers').insert(payload).select('id').single()
      if (result.error) throw result.error
      setSelectedId(result.data.id); setHeaderDialog(false); setEditingHeader(null); await resource.reload()
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not save this BOM.') }
    finally { setSaving(false) }
  }
  const deleteHeader = async (header: Bom) => {
    const productName = productMap.get(header.product_id)?.name ?? 'this product'
    if (!canManage || !window.confirm(`Delete BOM v${header.version} for ${productName}? Its BOM items will also be removed.`)) return
    try { const { error } = await requireSupabase().from('bom_headers').delete().eq('id', header.id); if (error) throw error; setTableError(null); if (selectedId === header.id) setSelectedId(''); await resource.reload() }
    catch (cause) { setTableError(cause instanceof Error ? cause.message : 'Could not delete this BOM.') }
  }
  const openAddItem = () => { setEditingItem(null); setItemForm(emptyItem); setFormError(null); setItemDialog(true) }
  const openEditItem = (item: BomItem) => { setEditingItem(item); setItemForm({ item_type: item.raw_material_id ? 'raw_material' : 'packaging_material', item_id: item.raw_material_id ?? item.packaging_material_id ?? '', quantity: String(item.quantity), notes: item.notes ?? '' }); setFormError(null); setItemDialog(true) }
  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null)
    if (!selectedHeader || !selectedItem) { setFormError('Select a valid material for this BOM item.'); return }
    setSaving(true)
    try {
      const payload = { bom_header_id: selectedHeader.id, raw_material_id: itemForm.item_type === 'raw_material' ? itemForm.item_id : null, packaging_material_id: itemForm.item_type === 'packaging_material' ? itemForm.item_id : null, quantity: itemForm.quantity as unknown as number, unit_id: selectedItem.base_unit_id, notes: itemForm.notes.trim() || null }
      const result = editingItem ? await requireSupabase().from('bom_items').update(payload).eq('id', editingItem.id) : await requireSupabase().from('bom_items').insert(payload)
      if (result.error) throw result.error
      setItemDialog(false); setEditingItem(null); await resource.reload()
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not save this BOM item.') }
    finally { setSaving(false) }
  }
  const deleteItem = async (item: BomItem) => {
    if (!canManage || !window.confirm('Remove this material from the BOM?')) return
    try { const { error } = await requireSupabase().from('bom_items').delete().eq('id', item.id); if (error) throw error; setTableError(null); await resource.reload() }
    catch (cause) { setTableError(cause instanceof Error ? cause.message : 'Could not remove this BOM item.') }
  }

  const itemName = (item: BomItem) => item.raw_material_id ? data.raw.find((row) => row.id === item.raw_material_id)?.name ?? 'Material unavailable' : data.packaging.find((row) => row.id === item.packaging_material_id)?.name ?? 'Material unavailable'
  const itemSku = (item: BomItem) => item.raw_material_id ? data.raw.find((row) => row.id === item.raw_material_id)?.sku : data.packaging.find((row) => row.id === item.packaging_material_id)?.sku
  return <div className="mx-auto max-w-[1440px]"><PageHeader eyebrow="Master data · Live Supabase records" title="Bills of materials" description="Maintain product recipes, planned batch outputs and material quantities." action={canManage ? <NewRecordButton onClick={openCreateHeader}>Add BOM</NewRecordButton> : undefined}/>
    <LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}><div className="grid gap-4 xl:grid-cols-[0.9fr_1.5fr]">
      <DataPanel title="BOM versions" subtitle={`${data.headers.length} records · active versions are protected by a unique database constraint`}><Toolbar><SearchBox value={search} onChange={setSearch} placeholder="Search product or version…"/></Toolbar>{tableError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{tableError}</p>}{visibleHeaders.length ? <div className="space-y-2">{visibleHeaders.map((header) => { const product = productMap.get(header.product_id); const active = selectedHeader?.id === header.id; return <div key={header.id} className={`rounded-xl border p-3 transition ${active ? 'border-[#a8ceb7] bg-[#f3f8f4]' : 'border-[#e9eeeb] bg-white hover:border-[#d4e3da]'}`}><div className="flex items-start gap-2"><button onClick={() => setSelectedId(header.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-[10px] font-semibold text-[#43574d]">{product?.name ?? 'Product unavailable'}</p><p className="mt-1 text-[9px] text-[#8a9890]">v{header.version} · {header.expected_output} {unitMap.get(header.output_unit_id)?.symbol ?? ''} · {data.items.filter((item) => item.bom_header_id === header.id).length} inputs</p></button><span className={`rounded-full px-2 py-1 text-[8px] ${header.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f1f3f2] text-[#77847d]'}`}>{header.is_active ? 'Active' : 'Inactive'}</span></div>{canManage && <div className="mt-2 flex justify-end gap-1 border-t border-[#edf1ee] pt-2"><button onClick={() => openEditHeader(header)} aria-label={`Edit BOM ${product?.name ?? ''}`} className="rounded-md p-1.5 text-[#718078] hover:bg-white"><Pencil size={13}/></button><button onClick={() => void deleteHeader(header)} aria-label={`Delete BOM ${product?.name ?? ''}`} className="rounded-md p-1.5 text-[#9b7474] hover:bg-rose-50"><Trash2 size={13}/></button></div>}</div>})}</div> : <EmptyState icon={<Archive size={18}/>} title={search ? 'No matching BOMs' : 'No BOMs configured'} description="Bills of materials stored in Supabase will appear here."/>}</DataPanel>
      <DataPanel title={selectedHeader ? `${productMap.get(selectedHeader.product_id)?.name ?? 'BOM'} · version ${selectedHeader.version}` : 'BOM inputs'} subtitle={selectedHeader ? `Expected batch output: ${selectedHeader.expected_output} ${unitMap.get(selectedHeader.output_unit_id)?.symbol ?? ''}` : 'Select a BOM version to view its material inputs'} action={selectedHeader && canManage ? <NewRecordButton onClick={openAddItem}><Plus size={14}/>Add input</NewRecordButton> : undefined}>{selectedHeader ? <>{selectedItems.length ? <DataTable headers={['Material', 'Category', 'Standard quantity', 'Unit', 'Notes', ...(canManage ? ['Actions'] : [])]}>{selectedItems.map((item) => <tr key={item.id} className="border-b border-[#f0f3f1] last:border-0"><td className="py-3 pr-3 text-[10px] font-medium text-[#43574d]">{itemName(item)}<span className="block text-[8px] text-[#9aa69f]">{itemSku(item) ?? ''}</span></td><td className="py-3 pr-3 text-[9px] text-[#74837a]">{item.raw_material_id ? 'Raw material' : 'Packaging'}</td><td className="py-3 pr-3 text-[10px] font-semibold text-[#4a5e53]">{item.quantity}</td><td className="py-3 pr-3 text-[9px] text-[#74837a]">{unitMap.get(item.unit_id)?.symbol ?? '—'}</td><td className="py-3 pr-3 text-[9px] text-[#8b9991]">{item.notes || '—'}</td>{canManage && <td className="py-3"><div className="flex gap-1"><button onClick={() => openEditItem(item)} aria-label={`Edit ${itemName(item)}`} className="rounded-md p-2 text-[#718078] hover:bg-[#f2f6f3]"><Pencil size={14}/></button><button onClick={() => void deleteItem(item)} aria-label={`Remove ${itemName(item)}`} className="rounded-md p-2 text-[#9b7474] hover:bg-rose-50"><Trash2 size={14}/></button></div></td>}</tr>)}</DataTable> : <EmptyState icon={<Archive size={18}/>} title="No inputs in this BOM" description="Add the raw and packaging materials that make up this product batch."/>}</> : <EmptyState icon={<Archive size={18}/>} title="Choose a BOM version" description="Select a BOM on the left, or create a new BOM for an active product."/>}</DataPanel>
    </div></LoadState>
    {headerDialog && <Dialog title={editingHeader ? 'Edit BOM header' : 'Create BOM'} description="The output unit must match the selected product stock unit. Material inputs are saved separately as ledger-independent BOM rows." onClose={() => { setHeaderDialog(false); setFormError(null) }}><FormGrid onSubmit={saveHeader}><SelectField label="Product" value={headerForm.product_id} onChange={chooseProduct} required disabled={Boolean(editingHeader)} options={data.products.filter((product) => product.is_active).map((product) => ({ value: product.id, label: `${product.name} · ${product.sku}` }))}/><TextField label="Version" value={headerForm.version} onChange={(version) => setHeaderForm({ ...headerForm, version })} type="number" required min="1" step="1"/><TextField label="Expected output quantity" value={headerForm.expected_output} onChange={(expected_output) => setHeaderForm({ ...headerForm, expected_output })} type="number" required min="0.000001" step="0.001"/><SelectField label="Output stock unit" value={headerForm.output_unit_id} onChange={(output_unit_id) => setHeaderForm({ ...headerForm, output_unit_id })} required options={data.units.filter((unit) => unit.dimension === 'count').map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` }))}/><label className="flex items-center gap-2 text-[10px] font-medium text-[#53665c] sm:col-span-2"><input type="checkbox" checked={headerForm.is_active} onChange={(event) => setHeaderForm({ ...headerForm, is_active: event.target.checked })} className="accent-[#13845b]"/>Active BOM (one active version per product)</label><div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={() => { setHeaderDialog(false); setFormError(null) }} submitting={saving} submitLabel={editingHeader ? 'Save BOM' : 'Create BOM'}/></div></FormGrid></Dialog>}
    {itemDialog && selectedHeader && <Dialog title={editingItem ? 'Edit BOM input' : 'Add material input'} description="The unit follows the selected material’s stock unit; the database enforces this relationship." onClose={() => { setItemDialog(false); setFormError(null) }}><FormGrid onSubmit={saveItem}><SelectField label="Material type" value={itemForm.item_type} onChange={(value) => setItemForm({ ...itemForm, item_type: value as ItemForm['item_type'], item_id: '' })} options={[{ value: 'raw_material', label: 'Raw material' }, { value: 'packaging_material', label: 'Packaging material' }]}/><SelectField label="Material" value={itemForm.item_id} onChange={(item_id) => setItemForm({ ...itemForm, item_id })} required options={itemOptions.filter((row) => row.is_active).map((row) => ({ value: row.id, label: `${row.name} · ${row.sku}` }))}/><TextField label="Standard quantity" value={itemForm.quantity} onChange={(quantity) => setItemForm({ ...itemForm, quantity })} type="number" required min="0.000001" step="0.000001"/><p className="self-end pb-2 text-[9px] text-[#7e8c84]">Unit: {selectedItem ? unitMap.get(selectedItem.base_unit_id)?.symbol : 'select a material'}</p><TextField label="Notes" value={itemForm.notes} onChange={(notes) => setItemForm({ ...itemForm, notes })} maxLength={500}/><div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={() => { setItemDialog(false); setFormError(null) }} submitting={saving} submitLabel={editingItem ? 'Save input' : 'Add input'}/></div></FormGrid></Dialog>}
  </div>
}
