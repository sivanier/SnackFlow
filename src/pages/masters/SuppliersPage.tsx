import { useCallback, useState, type FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { canManageMaster } from '../../lib/permissions'
import { requireSupabase } from '../../lib/supabase'
import { useResource } from '../../hooks/useResource'
import { DataPanel, Dialog, FormActions, FormError, FormGrid, LoadState, NewRecordButton, SearchBox, TextField, Toolbar } from '../../components/data/DataPrimitives'
import { DataTable } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

type Supplier = { id: string; name: string; gstin: string | null; state_code: string | null; phone: string | null; email: string | null; address: string | null; is_active: boolean; created_at: string; updated_at: string }
type SupplierForm = { name: string; gstin: string; state_code: string; phone: string; email: string; address: string; is_active: boolean }
const blank: SupplierForm = { name: '', gstin: '', state_code: '', phone: '', email: '', address: '', is_active: true }

export function SuppliersPage() {
  const { profile } = useAuth()
  const canManage = profile ? canManageMaster(profile.role, 'suppliers') : false
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(blank)
  const [formError, setFormError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const { data, error } = await requireSupabase().from('suppliers').select('*').order('name')
    if (error) throw error
    return data ?? []
  }, [])
  const resource = useResource(load)
  const rows = resource.data ?? []
  const visible = rows.filter((row) => `${row.name} ${row.gstin ?? ''} ${row.phone ?? ''} ${row.email ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const create = () => { setEditing(null); setForm(blank); setFormError(null); setFormOpen(true) }
  const edit = (row: Supplier) => { setEditing(row); setForm({ name: row.name, gstin: row.gstin ?? '', state_code: row.state_code ?? '', phone: row.phone ?? '', email: row.email ?? '', address: row.address ?? '', is_active: row.is_active }); setFormError(null); setFormOpen(true) }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null); setSaving(true)
    try {
      const payload = { name: form.name.trim(), gstin: form.gstin.trim().toUpperCase() || null, state_code: form.state_code.trim() || null, phone: form.phone.trim() || null, email: form.email.trim().toLowerCase() || null, address: form.address.trim() || null, is_active: form.is_active }
      const result = editing ? await requireSupabase().from('suppliers').update(payload).eq('id', editing.id) : await requireSupabase().from('suppliers').insert(payload)
      if (result.error) throw result.error
      setFormOpen(false); setEditing(null); await resource.reload()
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not save this supplier.') }
    finally { setSaving(false) }
  }
  const remove = async (row: Supplier) => {
    if (!canManage || !window.confirm(`Delete supplier “${row.name}”?`)) return
    try { const { error } = await requireSupabase().from('suppliers').delete().eq('id', row.id); if (error) throw error; setTableError(null); await resource.reload() }
    catch (cause) { setTableError(cause instanceof Error ? cause.message : 'Could not delete this supplier.') }
  }
  return <div className="mx-auto max-w-[1440px]"><PageHeader eyebrow="Master data · Live Supabase records" title="Suppliers" description="Maintain supplier contact and tax details for purchasing and material receipts." action={canManage ? <NewRecordButton onClick={create}>Add supplier</NewRecordButton> : undefined}/><DataPanel title="Supplier directory" subtitle={`${rows.length} records · visibility follows the current workspace role`}>
    {tableError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{tableError}</p>}
    <Toolbar><SearchBox value={search} onChange={setSearch} placeholder="Search supplier, GSTIN or contact…"/><span className="px-1 text-[9px] text-[#8e9b94]">{visible.length} shown</span></Toolbar>
    <LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}>{visible.length ? <DataTable headers={['Supplier', 'GSTIN / State', 'Contact', 'Address', 'Status', ...(canManage ? ['Actions'] : [])]}>{visible.map((row) => <tr key={row.id} className="border-b border-[#f0f3f1] last:border-0"><td className="py-3 pr-3 text-[10px] font-semibold text-[#43574d]">{row.name}</td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{row.gstin || '—'}<span className="mt-0.5 block text-[9px] text-[#97a39c]">{row.state_code ? `State ${row.state_code}` : 'State not set'}</span></td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{row.phone || '—'}<span className="mt-0.5 block text-[9px] text-[#97a39c]">{row.email || ''}</span></td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{row.address || '—'}</td><td className="py-3 pr-3"><span className={`rounded-full px-2 py-1 text-[9px] ${row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f1f3f2] text-[#77847d]'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></td>{canManage && <td className="py-3"><div className="flex gap-1"><button onClick={() => edit(row)} aria-label={`Edit ${row.name}`} className="rounded-md p-2 text-[#718078] hover:bg-[#f2f6f3]"><Pencil size={14}/></button><button onClick={() => void remove(row)} aria-label={`Delete ${row.name}`} className="rounded-md p-2 text-[#9b7474] hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14}/></button></div></td>}</tr>)}</DataTable> : <EmptyState icon={<span className="text-sm">S</span>} title={search ? 'No matching suppliers' : 'No supplier records'} description={search ? 'Try a different search term.' : 'Supplier records created in this workspace will appear here.'}/>}</LoadState>
  </DataPanel>{formOpen && <Dialog title={editing ? 'Edit supplier' : 'Add supplier'} description="Only owner/admin roles can manage supplier records." onClose={() => { setFormOpen(false); setFormError(null) }}><FormGrid onSubmit={save}><TextField label="Supplier name" value={form.name} onChange={(name) => setForm({ ...form, name })} required maxLength={160}/><TextField label="GSTIN" value={form.gstin} onChange={(gstin) => setForm({ ...form, gstin })} maxLength={15} placeholder="Optional"/><TextField label="State code" value={form.state_code} onChange={(state_code) => setForm({ ...form, state_code })} maxLength={2} placeholder="Two digit code"/><TextField label="Phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} maxLength={30}/><TextField label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} type="email" maxLength={254}/><label className="block text-[10px] font-medium text-[#53665c] sm:col-span-2">Address<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} rows={2} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-xs outline-none focus:border-[#83b797]"/></label><label className="flex items-center gap-2 text-[10px] font-medium text-[#53665c] sm:col-span-2"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="accent-[#13845b]"/>Active</label><div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={() => { setFormOpen(false); setFormError(null) }} submitting={saving} submitLabel={editing ? 'Save supplier' : 'Create supplier'}/></div></FormGrid></Dialog>}</div>
}
