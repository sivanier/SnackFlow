import { useCallback, useState, type FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { canManageMaster } from '../../lib/permissions'
import { requireSupabase } from '../../lib/supabase'
import { useResource } from '../../hooks/useResource'
import { DataPanel, Dialog, FormActions, FormError, FormGrid, LoadState, NewRecordButton, SearchBox, SelectField, TextField, Toolbar } from '../../components/data/DataPrimitives'
import { DataTable } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

type Material = { id: string; sku: string; name: string; base_unit_id: string; reorder_level: number; is_active: boolean; created_at: string; updated_at: string }
type Unit = { id: string; code: string; name: string; symbol: string; dimension: 'mass' | 'volume' | 'count'; factor_to_base: number | null }
type MaterialData = { raw: Material[]; packaging: Material[]; units: Unit[] }
type MaterialForm = { sku: string; name: string; base_unit_id: string; reorder_level: string; is_active: boolean }
const blank: MaterialForm = { sku: '', name: '', base_unit_id: '', reorder_level: '0', is_active: true }
type MaterialKind = 'raw' | 'packaging'

export function MaterialsPage() {
  const { profile } = useAuth()
  const canManage = profile ? canManageMaster(profile.role, 'materials') : false
  const [kind, setKind] = useState<MaterialKind>('raw')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [form, setForm] = useState<MaterialForm>(blank)
  const [formError, setFormError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async (): Promise<MaterialData> => {
    const client = requireSupabase()
    const [raw, packaging, units] = await Promise.all([
      client.from('raw_materials').select('*').order('name'),
      client.from('packaging_materials').select('*').order('name'),
      client.from('units').select('id,code,name,symbol,dimension,factor_to_base').order('name'),
    ])
    const failure = raw.error ?? packaging.error ?? units.error
    if (failure) throw failure
    return { raw: raw.data ?? [], packaging: packaging.data ?? [], units: units.data ?? [] }
  }, [])
  const resource = useResource(load)
  const data = resource.data ?? { raw: [], packaging: [], units: [] }
  const rows = kind === 'raw' ? data.raw : data.packaging
  const visible = rows.filter((row) => `${row.name} ${row.sku}`.toLowerCase().includes(search.trim().toLowerCase()))
  const label = kind === 'raw' ? 'Raw materials' : 'Packaging materials'
  const tableName = kind === 'raw' ? 'raw_materials' : 'packaging_materials'
  const create = () => { setEditing(null); setForm(blank); setFormError(null); setFormOpen(true) }
  const edit = (row: Material) => { setEditing(row); setForm({ sku: row.sku, name: row.name, base_unit_id: row.base_unit_id, reorder_level: String(row.reorder_level), is_active: row.is_active }); setFormError(null); setFormOpen(true) }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null)
    const baseUnit = data.units.find((unit) => unit.id === form.base_unit_id)
    if (!baseUnit || (kind === 'packaging' && baseUnit.dimension !== 'count')) { setFormError('Packaging materials must use a count stock unit.'); return }
    setSaving(true)
    try {
      const payload = { sku: form.sku.trim().toUpperCase(), name: form.name.trim(), base_unit_id: form.base_unit_id, reorder_level: form.reorder_level as unknown as number, is_active: form.is_active }
      const client = requireSupabase()
      const result = editing ? await client.from(tableName).update(payload).eq('id', editing.id) : await client.from(tableName).insert(payload)
      if (result.error) throw result.error
      setFormOpen(false); setEditing(null); await resource.reload()
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : `Could not save this ${kind === 'raw' ? 'raw material' : 'packaging material'}.`) }
    finally { setSaving(false) }
  }
  const remove = async (row: Material) => {
    if (!canManage || !window.confirm(`Delete “${row.name}”? Materials referenced by BOMs or stock movements cannot be deleted.`)) return
    try { const { error } = await requireSupabase().from(tableName).delete().eq('id', row.id); if (error) throw error; setTableError(null); await resource.reload() }
    catch (cause) { setTableError(cause instanceof Error ? cause.message : 'Could not delete this material.') }
  }

  return <div className="mx-auto max-w-[1440px]"><PageHeader eyebrow="Master data · Live Supabase records" title="Materials" description="Manage raw inputs and packaging items with explicit stock units and reorder thresholds." action={canManage ? <NewRecordButton onClick={create}>{kind === 'raw' ? 'Add raw material' : 'Add packaging'}</NewRecordButton> : undefined}/><DataPanel title="Material catalog" subtitle={`${rows.length} ${kind === 'raw' ? 'raw material' : 'packaging'} records · ledger balances are shown in Inventory`}>
    <div className="mb-4 flex gap-1 rounded-lg bg-[#f1f5f2] p-1"><button onClick={() => { setKind('raw'); setSearch(''); setTableError(null) }} className={`rounded-md px-3 py-2 text-[10px] font-medium ${kind === 'raw' ? 'bg-white text-[#2d4438] shadow-sm' : 'text-[#7e8c84]'}`}>Raw materials <span className="ml-1 text-[9px] opacity-70">{data.raw.length}</span></button><button onClick={() => { setKind('packaging'); setSearch(''); setTableError(null) }} className={`rounded-md px-3 py-2 text-[10px] font-medium ${kind === 'packaging' ? 'bg-white text-[#2d4438] shadow-sm' : 'text-[#7e8c84]'}`}>Packaging <span className="ml-1 text-[9px] opacity-70">{data.packaging.length}</span></button></div>
    {tableError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{tableError}</p>}
    <Toolbar><SearchBox value={search} onChange={setSearch} placeholder={`Search ${kind === 'raw' ? 'raw materials' : 'packaging'}…`}/><span className="px-1 text-[9px] text-[#8e9b94]">{visible.length} shown</span></Toolbar>
    <LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}>{visible.length ? <DataTable headers={['Code', 'Material', 'Stock unit', 'Reorder level', 'Status', ...(canManage ? ['Actions'] : [])]}>{visible.map((row) => { const unit = data.units.find((item) => item.id === row.base_unit_id); return <tr key={row.id} className="border-b border-[#f0f3f1] last:border-0"><td className="py-3 pr-3 text-[9px] font-medium text-[#718078]">{row.sku}</td><td className="py-3 pr-3 text-[10px] font-semibold text-[#43574d]">{row.name}</td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{unit ? `${unit.name} (${unit.symbol})` : '—'}</td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{row.reorder_level} {unit?.symbol ?? ''}</td><td className="py-3 pr-3"><span className={`rounded-full px-2 py-1 text-[9px] ${row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f1f3f2] text-[#77847d]'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></td>{canManage && <td className="py-3"><div className="flex gap-1"><button onClick={() => edit(row)} aria-label={`Edit ${row.name}`} className="rounded-md p-2 text-[#718078] hover:bg-[#f2f6f3]"><Pencil size={14}/></button><button onClick={() => void remove(row)} aria-label={`Delete ${row.name}`} className="rounded-md p-2 text-[#9b7474] hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14}/></button></div></td>}</tr>})}</DataTable> : <EmptyState icon={<span className="text-sm">M</span>} title={search ? 'No matching materials' : `No ${label.toLowerCase()} yet`} description={search ? 'Try a shorter search term.' : 'Records created in this workspace will appear here.'}/>}</LoadState>
  </DataPanel>
  {formOpen && <Dialog title={`${editing ? 'Edit' : 'Add'} ${kind === 'raw' ? 'raw material' : 'packaging material'}`} description="Stock quantities are tracked separately in the append-only inventory ledger." onClose={() => { setFormOpen(false); setFormError(null) }}><FormGrid onSubmit={save}><TextField label="SKU" value={form.sku} onChange={(sku) => setForm({ ...form, sku })} required maxLength={40} placeholder={kind === 'raw' ? 'RM-FLOUR' : 'PK-POUCH-200'}/><TextField label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} required maxLength={160}/><SelectField label="Base stock unit" value={form.base_unit_id} onChange={(base_unit_id) => setForm({ ...form, base_unit_id })} required options={data.units.filter((unit) => kind !== 'packaging' || unit.dimension === 'count').map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` }))}/><TextField label="Reorder alert quantity" value={form.reorder_level} onChange={(reorder_level) => setForm({ ...form, reorder_level })} type="number" min="0" step="0.001" required/><label className="flex items-center gap-2 text-[10px] font-medium text-[#53665c] sm:col-span-2"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="accent-[#13845b]"/>Active for new work</label><div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={() => { setFormOpen(false); setFormError(null) }} submitting={saving} submitLabel={editing ? 'Save material' : 'Create material'}/></div></FormGrid></Dialog>}
  </div>
}
