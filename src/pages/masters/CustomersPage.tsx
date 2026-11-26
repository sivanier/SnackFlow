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

type Customer = { id: string; name: string; gstin: string | null; state_code: string | null; phone: string | null; email: string | null; billing_address: string | null; assigned_salesman_id: string | null; is_active: boolean; created_at: string; updated_at: string }
type ProfileOption = { id: string; display_name: string; role: 'owner' | 'admin' | 'salesman' | 'production' | 'accountant' }
type CustomerData = { customers: Customer[]; profiles: ProfileOption[] }
type CustomerForm = { name: string; gstin: string; state_code: string; phone: string; email: string; billing_address: string; assigned_salesman_id: string; is_active: boolean }
const blankForm: CustomerForm = { name: '', gstin: '', state_code: '', phone: '', email: '', billing_address: '', assigned_salesman_id: '', is_active: true }

export function CustomersPage() {
  const { profile } = useAuth()
  const canManage = profile ? canManageMaster(profile.role, 'customers') : false
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(blankForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async (): Promise<CustomerData> => {
    const client = requireSupabase()
    const [customers, profiles] = await Promise.all([
      client.from('customers').select('*').order('name'),
      client.from('profiles').select('id,display_name,role').order('display_name'),
    ])
    const failure = customers.error ?? profiles.error
    if (failure) throw failure
    return { customers: customers.data ?? [], profiles: (profiles.data ?? []) as ProfileOption[] }
  }, [])
  const resource = useResource(load)
  const data = resource.data ?? { customers: [], profiles: [] }
  const visible = data.customers.filter((row) => `${row.name} ${row.gstin ?? ''} ${row.phone ?? ''} ${row.email ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const openCreate = () => { setEditing(null); setForm(blankForm); setFormError(null); setSuccessMessage(null); setFormOpen(true) }
  const openEdit = (row: Customer) => { setEditing(row); setForm({ name: row.name, gstin: row.gstin ?? '', state_code: row.state_code ?? '', phone: row.phone ?? '', email: row.email ?? '', billing_address: row.billing_address ?? '', assigned_salesman_id: row.assigned_salesman_id ?? '', is_active: row.is_active }); setFormError(null); setFormOpen(true) }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null)
    const name = form.name.trim()
    const gstin = form.gstin.trim().toUpperCase()
    const stateCode = form.state_code.trim()
    const phone = form.phone.trim()
    const email = form.email.trim()
    if (!name || name.length > 160) { setFormError('Enter a customer name between 1 and 160 characters.'); return }
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) { setFormError('Enter a valid 15-character GSTIN, or leave it blank.'); return }
    if (stateCode && !/^\d{2}$/.test(stateCode)) { setFormError('State code must contain exactly two digits.'); return }
    if (phone && (!/^[+\d().\s-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) { setFormError('Enter a phone number with 7 to 15 digits.'); return }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError('Enter a valid email address, or leave it blank.'); return }
    setSaving(true)
    try {
      const payload = { name, gstin: gstin || null, state_code: stateCode || null, phone: phone || null, email: email.toLowerCase() || null, billing_address: form.billing_address.trim() || null, assigned_salesman_id: form.assigned_salesman_id || null, is_active: form.is_active }
      const client = requireSupabase()
      const result = editing ? await client.from('customers').update(payload).eq('id', editing.id) : await client.from('customers').insert(payload)
      if (result.error) throw result.error
      setFormOpen(false); setEditing(null); setSuccessMessage(editing ? 'Customer details saved.' : 'Customer created successfully.'); await resource.reload()
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not save this customer.') }
    finally { setSaving(false) }
  }
  const remove = async (row: Customer) => {
    if (!canManage || !window.confirm(`Delete customer “${row.name}”?`)) return
    try { const { error } = await requireSupabase().from('customers').delete().eq('id', row.id); if (error) throw error; setTableError(null); await resource.reload() }
    catch (cause) { setTableError(cause instanceof Error ? cause.message : 'Could not delete this customer.') }
  }

  return <div className="mx-auto max-w-[1440px]"><PageHeader eyebrow="Master data · Live Supabase records" title="Customers" description="Manage customer details and assign customer records to sales representatives."/><DataPanel title="Customer directory" subtitle={`${data.customers.length} records · salesman visibility is restricted by database RLS`} action={canManage ? <NewRecordButton onClick={openCreate}>Add Customer</NewRecordButton> : undefined}>
    {successMessage && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-800">{successMessage}</p>}
    {tableError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{tableError}</p>}
    <Toolbar><SearchBox value={search} onChange={setSearch} placeholder="Search customer, GSTIN or contact…"/><span className="px-1 text-[9px] text-[#8e9b94]">{visible.length} shown</span></Toolbar>
    <LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}>{visible.length ? <DataTable headers={['Customer', 'GSTIN / State', 'Contact', 'Assigned salesperson', 'Status', ...(canManage ? ['Actions'] : [])]}>{visible.map((row) => { const salesman = data.profiles.find((person) => person.id === row.assigned_salesman_id); return <tr key={row.id} className="border-b border-[#f0f3f1] last:border-0"><td className="py-3 pr-3 text-[10px] font-semibold text-[#43574d]">{row.name}<span className="mt-0.5 block font-normal text-[#97a39c]">{row.billing_address || 'No billing address'}</span></td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{row.gstin || '—'}<span className="mt-0.5 block text-[9px] text-[#97a39c]">{row.state_code ? `State ${row.state_code}` : 'State not set'}</span></td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{row.phone || '—'}<span className="mt-0.5 block text-[9px] text-[#97a39c]">{row.email || ''}</span></td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{salesman?.display_name || (row.assigned_salesman_id ? 'Assigned profile' : 'Unassigned')}</td><td className="py-3 pr-3"><span className={`rounded-full px-2 py-1 text-[9px] ${row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f1f3f2] text-[#77847d]'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></td>{canManage && <td className="py-3"><div className="flex gap-1"><button onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`} className="rounded-md p-2 text-[#718078] hover:bg-[#f2f6f3]"><Pencil size={14}/></button><button onClick={() => void remove(row)} aria-label={`Delete ${row.name}`} className="rounded-md p-2 text-[#9b7474] hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14}/></button></div></td>}</tr>})}</DataTable> : <EmptyState icon={<span className="text-sm">C</span>} title={search ? 'No matching customers' : 'No customer records'} description={search ? 'Adjust your search and try again.' : 'Customer records created in this workspace will appear here.'}/>}</LoadState>
  </DataPanel>
  {formOpen && <Dialog title={editing ? 'Edit customer' : 'Add customer'} description="Only owner/admin roles can manage customer records. Sales representatives see assigned customers only." onClose={() => { if (!saving) { setFormOpen(false); setFormError(null) } }}><FormGrid onSubmit={save}><TextField label="Customer name" value={form.name} onChange={(name) => setForm({ ...form, name })} required maxLength={160}/><TextField label="GSTIN" value={form.gstin} onChange={(gstin) => setForm({ ...form, gstin })} maxLength={15} placeholder="15 characters, optional"/><TextField label="State code" value={form.state_code} onChange={(state_code) => setForm({ ...form, state_code })} maxLength={2} placeholder="Two digit code"/><TextField label="Phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} maxLength={30}/><TextField label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} type="email" maxLength={254}/><SelectField label="Assigned salesperson" value={form.assigned_salesman_id} onChange={(assigned_salesman_id) => setForm({ ...form, assigned_salesman_id })} options={data.profiles.filter((item) => item.role === 'salesman').map((item) => ({ value: item.id, label: item.display_name || 'Salesman profile' }))}/><label className="block text-[10px] font-medium text-[#53665c] sm:col-span-2">Billing address<textarea value={form.billing_address} onChange={(event) => setForm({ ...form, billing_address: event.target.value })} rows={2} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-xs outline-none focus:border-[#83b797]"/></label><label className="flex items-center gap-2 text-[10px] font-medium text-[#53665c] sm:col-span-2"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="accent-[#13845b]"/>Active</label><div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={() => { setFormOpen(false); setFormError(null) }} submitting={saving} submitLabel={editing ? 'Save customer' : 'Create customer'}/></div></FormGrid></Dialog>}
  </div>
}
