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

type Unit = { id: string; code: string; name: string; symbol: string; dimension: 'mass' | 'volume' | 'count'; factor_to_base: number | null; created_at: string }
type UnitForm = { code: string; name: string; symbol: string; dimension: 'mass' | 'volume' | 'count'; factor_to_base: string }
const blank: UnitForm = { code: '', name: '', symbol: '', dimension: 'mass', factor_to_base: '' }

export function UnitsPage() {
  const { profile } = useAuth()
  const canManage = profile ? canManageMaster(profile.role, 'units') : false
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)
  const [form, setForm] = useState<UnitForm>(blank)
  const [formError, setFormError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const { data, error } = await requireSupabase().from('units').select('*').order('dimension').order('name')
    if (error) throw error
    return data ?? []
  }, [])
  const resource = useResource(load)
  const rows = resource.data ?? []
  const visible = rows.filter((row) => `${row.code} ${row.name} ${row.symbol} ${row.dimension}`.toLowerCase().includes(search.trim().toLowerCase()))
  const create = () => { setEditing(null); setForm(blank); setFormError(null); setFormOpen(true) }
  const edit = (unit: Unit) => { setEditing(unit); setForm({ code: unit.code, name: unit.name, symbol: unit.symbol, dimension: unit.dimension, factor_to_base: unit.factor_to_base === null ? '' : String(unit.factor_to_base) }); setFormError(null); setFormOpen(true) }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null)
    if (form.dimension === 'count' && form.factor_to_base) { setFormError('Count-unit conversions depend on the specific item or package; leave the universal factor blank.'); return }
    if (form.dimension !== 'count' && (!form.factor_to_base || !/^\d+(\.\d+)?$/.test(form.factor_to_base) || Number(form.factor_to_base) <= 0)) { setFormError('Mass and volume units require a positive base factor.'); return }
    setSaving(true)
    try {
      const payload = { code: form.code.trim().toLowerCase(), name: form.name.trim(), symbol: form.symbol.trim(), dimension: form.dimension, factor_to_base: form.dimension === 'count' ? null : form.factor_to_base as unknown as number }
      const result = editing ? await requireSupabase().from('units').update(payload).eq('id', editing.id) : await requireSupabase().from('units').insert(payload)
      if (result.error) throw result.error
      setFormOpen(false); setEditing(null); await resource.reload()
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not save this unit.') }
    finally { setSaving(false) }
  }
  const remove = async (unit: Unit) => {
    if (!canManage || !window.confirm(`Delete unit “${unit.name}”? Units referenced by masters or ledger movements cannot be deleted.`)) return
    try { const { error } = await requireSupabase().from('units').delete().eq('id', unit.id); if (error) throw error; setTableError(null); await resource.reload() }
    catch (cause) { setTableError(cause instanceof Error ? cause.message : 'Could not delete this unit.') }
  }
  return <div className="mx-auto max-w-[1440px]"><PageHeader eyebrow="Master data · Live Supabase records" title="Units of measurement" description="Mass and volume units carry explicit base factors; count packaging conversions remain item-specific." action={canManage ? <NewRecordButton onClick={create}>Add unit</NewRecordButton> : undefined}/><DataPanel title="Unit catalog" subtitle={`${rows.length} units · conversions are never inferred across dimensions`}>
    {tableError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{tableError}</p>}
    <Toolbar><SearchBox value={search} onChange={setSearch} placeholder="Search unit, symbol or dimension…"/><span className="px-1 text-[9px] text-[#8e9b94]">{visible.length} shown</span></Toolbar>
    <LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}>{visible.length ? <DataTable headers={['Code', 'Unit', 'Symbol', 'Dimension', 'Base factor', ...(canManage ? ['Actions'] : [])]}>{visible.map((unit) => <tr key={unit.id} className="border-b border-[#f0f3f1] last:border-0"><td className="py-3 pr-3 font-mono text-[9px] text-[#718078]">{unit.code}</td><td className="py-3 pr-3 text-[10px] font-semibold text-[#43574d]">{unit.name}</td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{unit.symbol}</td><td className="py-3 pr-3"><span className="rounded-full bg-[#f1f5f2] px-2 py-1 text-[9px] capitalize text-[#63746a]">{unit.dimension}</span></td><td className="py-3 pr-3 text-[10px] text-[#66776e]">{unit.factor_to_base ?? 'Item-specific'}</td>{canManage && <td className="py-3"><div className="flex gap-1"><button onClick={() => edit(unit)} aria-label={`Edit ${unit.name}`} className="rounded-md p-2 text-[#718078] hover:bg-[#f2f6f3]"><Pencil size={14}/></button><button onClick={() => void remove(unit)} aria-label={`Delete ${unit.name}`} className="rounded-md p-2 text-[#9b7474] hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14}/></button></div></td>}</tr>)}</DataTable> : <EmptyState icon={<span className="text-sm">U</span>} title={search ? 'No matching units' : 'No units configured'} description="Units created in this workspace will appear here."/>}</LoadState>
  </DataPanel>
  {formOpen && <Dialog title={editing ? 'Edit unit' : 'Add unit'} description="Count units such as piece, packet and carton require item-specific relationships rather than a universal multiplier." onClose={() => { setFormOpen(false); setFormError(null) }}><FormGrid onSubmit={save}><TextField label="Code" value={form.code} onChange={(code) => setForm({ ...form, code })} required maxLength={20} placeholder="kg"/><TextField label="Unit name" value={form.name} onChange={(name) => setForm({ ...form, name })} required maxLength={100}/><TextField label="Symbol" value={form.symbol} onChange={(symbol) => setForm({ ...form, symbol })} required maxLength={20}/><SelectField label="Dimension" value={form.dimension} onChange={(dimension) => setForm({ ...form, dimension: dimension as UnitForm['dimension'], factor_to_base: dimension === 'count' ? '' : form.factor_to_base })} options={[{ value: 'mass', label: 'Mass' }, { value: 'volume', label: 'Volume' }, { value: 'count', label: 'Count' }]}/>{form.dimension !== 'count' ? <TextField label="Factor to base unit" value={form.factor_to_base} onChange={(factor_to_base) => setForm({ ...form, factor_to_base })} type="number" min="0.000000001" step="any" required/> : <p className="rounded-lg bg-[#f5f8f6] p-3 text-[9px] leading-4 text-[#7c8b82] sm:col-span-2">No universal count factor is stored. A carton-to-piece relationship depends on the specific package.</p>}<div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={() => { setFormOpen(false); setFormError(null) }} submitting={saving} submitLabel={editing ? 'Save unit' : 'Create unit'}/></div></FormGrid></Dialog>}
  </div>
}
