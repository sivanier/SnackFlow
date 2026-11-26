import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Factory, Play, RefreshCw } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useResource } from '../../hooks/useResource'
import { dataErrorMessage } from '../../lib/dataErrors'
import { requireSupabase } from '../../lib/supabase'
import type { Json, ProductionRunStatus } from '../../lib/database.types'
import { canManageMaster } from '../../lib/permissions'
import { DataPanel, Dialog, FormActions, FormError, FormGrid, LoadState, NewRecordButton, SelectField, TextField, Toolbar } from '../../components/data/DataPrimitives'
import { DataTable } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

type Run = { id: string; product_id: string; bom_header_id: string; planned_quantity: number; unit_id: string; status: ProductionRunStatus; notes: string | null; created_by: string; created_at: string; completed_at: string | null }
type Consumption = { id: string; production_run_id: string; bom_item_id: string | null; raw_material_id: string | null; packaging_material_id: string | null; planned_quantity: number; actual_quantity: number | null; unit_id: string }
type Output = { id: string; production_run_id: string; good_quantity: number; rejected_quantity: number; wastage_quantity: number; actual_quantity: number; unit_id: string; notes: string | null; created_at: string }
type Product = { id: string; sku: string; name: string; stock_unit_id: string; is_active: boolean }
type Unit = { id: string; symbol: string; name: string }
type Material = { id: string; sku: string; name: string }
type BomHeader = { id: string; product_id: string; expected_output: number; output_unit_id: string; is_active: boolean }
type BomItem = { id: string; bom_header_id: string; raw_material_id: string | null; packaging_material_id: string | null; quantity: number; unit_id: string }
type ProductionData = { runs: Run[]; consumption: Consumption[]; outputs: Output[]; products: Product[]; units: Unit[]; rawMaterials: Material[]; packaging: Material[]; bomHeaders: BomHeader[]; bomItems: BomItem[] }
type CreateForm = { product_id: string; planned_quantity: string; notes: string }
type OutputForm = { good: string; rejected: string; wastage: string; notes: string }

const blankCreate: CreateForm = { product_id: '', planned_quantity: '', notes: '' }
const blankOutput: OutputForm = { good: '', rejected: '0', wastage: '0', notes: '' }
const varianceTolerance = 3

function percent(actual: number, planned: number) {
  return planned > 0 ? ((actual - planned) / planned) * 100 : null
}

export function ProductionPage() {
  const { profile } = useAuth()
  const canManage = profile ? canManageMaster(profile.role, 'bom') : false
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [createForm, setCreateForm] = useState<CreateForm>(blankCreate)
  const [outputForm, setOutputForm] = useState<OutputForm>(blankOutput)
  const [actuals, setActuals] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (): Promise<ProductionData> => {
    const db = requireSupabase()
    const [runs, consumption, outputs, products, units, rawMaterials, packaging, bomHeaders, bomItems] = await Promise.all([
      db.from('production_runs').select('*').order('created_at', { ascending: false }),
      db.from('production_consumption').select('*').order('id'),
      db.from('production_outputs').select('*').order('created_at', { ascending: false }),
      db.from('products').select('id,sku,name,stock_unit_id,is_active').order('name'),
      db.from('units').select('id,name,symbol').order('name'),
      db.from('raw_materials').select('id,sku,name').order('name'),
      db.from('packaging_materials').select('id,sku,name').order('name'),
      db.from('bom_headers').select('id,product_id,expected_output,output_unit_id,is_active'),
      db.from('bom_items').select('id,bom_header_id,raw_material_id,packaging_material_id,quantity,unit_id').order('id'),
    ])
    const failed = [runs, consumption, outputs, products, units, rawMaterials, packaging, bomHeaders, bomItems].find((result) => result.error)?.error
    if (failed) throw failed
    return {
      runs: runs.data ?? [], consumption: consumption.data ?? [], outputs: outputs.data ?? [], products: products.data ?? [], units: units.data ?? [],
      rawMaterials: rawMaterials.data ?? [], packaging: packaging.data ?? [], bomHeaders: bomHeaders.data ?? [], bomItems: bomItems.data ?? [],
    }
  }, [])
  const resource = useResource(load)
  const data: ProductionData = resource.data ?? { runs: [], consumption: [], outputs: [], products: [], units: [], rawMaterials: [], packaging: [], bomHeaders: [], bomItems: [] }
  const productMap = useMemo(() => new Map(data.products.map((row) => [row.id, row])), [data.products])
  const unitMap = useMemo(() => new Map(data.units.map((row) => [row.id, row])), [data.units])
  const rawMap = useMemo(() => new Map(data.rawMaterials.map((row) => [row.id, row])), [data.rawMaterials])
  const packagingMap = useMemo(() => new Map(data.packaging.map((row) => [row.id, row])), [data.packaging])
  const outputMap = useMemo(() => new Map(data.outputs.map((row) => [row.production_run_id, row])), [data.outputs])
  const selectedRun = data.runs.find((run) => run.id === selectedId) ?? data.runs[0] ?? null
  const selectedConsumption = useMemo(() => data.consumption.filter((line) => line.production_run_id === selectedRun?.id), [data.consumption, selectedRun?.id])
  const filteredRuns = data.runs.filter((run) => {
    const product = productMap.get(run.product_id)
    return `${product?.name ?? ''} ${product?.sku ?? ''} ${run.status}`.toLowerCase().includes(search.trim().toLowerCase())
  })
  const selectedBom = data.bomHeaders.find((bom) => bom.product_id === createForm.product_id && bom.is_active)
  const createBomItems = selectedBom ? data.bomItems.filter((item) => item.bom_header_id === selectedBom.id) : []

  useEffect(() => {
    setActuals(Object.fromEntries(selectedConsumption.map((line) => [line.id, line.actual_quantity === null ? '' : String(line.actual_quantity)])))
    setOutputForm(blankOutput)
  }, [selectedRun?.id, selectedConsumption])

  const createRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null); setSuccess(null)
    const plannedQuantity = Number(createForm.planned_quantity)
    if (!selectedBom) { setFormError('Select a product with an active bill of materials.'); return }
    if (!Number.isFinite(plannedQuantity) || plannedQuantity <= 0) { setFormError('Enter a planned output quantity greater than zero.'); return }
    setSaving(true)
    try {
      const { data: runId, error } = await requireSupabase().rpc('create_production_run', {
        p_product_id: createForm.product_id, p_planned_quantity: plannedQuantity, p_notes: createForm.notes.trim() || null,
      })
      if (error) throw error
      setCreateOpen(false); setCreateForm(blankCreate); setSuccess('Production draft created from the active BOM.')
      await resource.reload()
      setSelectedId(runId)
    } catch (cause) { setFormError(dataErrorMessage(cause) ?? "Something went wrong") }
    finally { setSaving(false) }
  }

  const completeRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null); setTableError(null); setSuccess(null)
    if (!selectedRun || selectedRun.status !== 'draft') return
    const parsed = selectedConsumption.map((line) => ({
      consumption_id: line.id,
      actual_quantity: actuals[line.id]?.trim() === '' ? Number.NaN : Number(actuals[line.id]),
    }))
    if (parsed.some((line) => !Number.isFinite(line.actual_quantity) || line.actual_quantity < 0)) {
      setFormError('Enter a valid actual quantity (zero or greater) for every material.'); return
    }
    const good = Number(outputForm.good), rejected = Number(outputForm.rejected), wastage = Number(outputForm.wastage)
    if (!outputForm.good.trim() || !Number.isFinite(good) || good < 0 || !Number.isFinite(rejected) || rejected < 0 || !Number.isFinite(wastage) || wastage < 0) {
      setFormError('Enter valid good output, rejected output, and wastage quantities.'); return
    }
    setSaving(true)
    try {
      const { error } = await requireSupabase().rpc('complete_production_run', {
        p_run_id: selectedRun.id,
        p_consumption: parsed as unknown as Json,
        p_good_quantity: good,
        p_rejected_quantity: rejected,
        p_wastage_quantity: wastage,
        p_notes: outputForm.notes.trim() || null,
      })
      if (error) throw error
      setSuccess('Production run completed. Material issues and good output were posted to the stock ledger.')
      await resource.reload()
      setSelectedId(selectedRun.id)
    } catch (cause) { setFormError(dataErrorMessage(cause) ?? "Something went wrong") }
    finally { setSaving(false) }
  }

  const openCreate = () => { setFormError(null); setCreateForm(blankCreate); setCreateOpen(true) }
  const closeCreate = () => { if (!saving) { setCreateOpen(false); setFormError(null) } }
  const statusClass = (status: ProductionRunStatus) => status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'

  return <div className="mx-auto max-w-[1440px]">
    <PageHeader eyebrow="Production · Live Supabase records" title="Production runs" description="Plan from an active BOM, record actual consumption and output, then post the run to the immutable inventory ledger." action={canManage ? <NewRecordButton onClick={openCreate}>New production run</NewRecordButton> : undefined}/>
    {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-800">{success}</p>}
    {tableError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{tableError}</p>}
    <div className="grid items-start gap-4 xl:grid-cols-[0.95fr_1.45fr]">
      <DataPanel title="Production history" subtitle={`${data.runs.length} runs · ledger balances change only on successful completion`}>
        <Toolbar><label className="relative block min-w-0 flex-1"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or status…" aria-label="Search production runs" className="h-9 w-full rounded-lg border border-[#e3eae6] px-3 text-xs outline-none focus:border-[#91bea2]"/></label><button onClick={() => void resource.reload()} aria-label="Refresh production runs" className="grid h-9 w-9 place-items-center rounded-lg border border-[#e3eae6] text-[#718078] hover:bg-[#f5f8f6]"><RefreshCw size={14}/></button></Toolbar>
        <LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}>{filteredRuns.length ? <DataTable headers={['Product / run', 'Planned', 'Good output', 'Status']}>
          {filteredRuns.map((run) => { const product = productMap.get(run.product_id); const output = outputMap.get(run.id); return <tr key={run.id} onClick={() => { setSelectedId(run.id); setFormError(null) }} className={`cursor-pointer border-b border-[#f0f3f1] last:border-0 hover:bg-[#f8faf8] ${selectedRun?.id === run.id ? 'bg-emerald-50/60' : ''}`}><td className="py-3 pr-2 text-[10px] font-medium text-[#43574d]">{product?.name ?? 'Finished product'}<span className="mt-0.5 block text-[8px] font-normal text-[#9aa69f]">{new Date(run.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {run.id.slice(0, 8)}</span></td><td className="py-3 pr-2 text-[10px] text-[#66776e]">{run.planned_quantity} {unitMap.get(run.unit_id)?.symbol ?? ''}</td><td className="py-3 pr-2 text-[10px] text-[#66776e]">{output ? `${output.good_quantity} ${unitMap.get(output.unit_id)?.symbol ?? ''}` : '—'}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[8px] font-medium capitalize ${statusClass(run.status)}`}>{run.status}</span></td></tr> })}
        </DataTable> : <EmptyState icon={<Factory size={18}/>} title={search ? 'No matching production runs' : 'No production runs yet'} description={search ? 'Try another product name or status.' : 'Create a run to snapshot planned quantities from an active BOM.'}/>}</LoadState>
      </DataPanel>

      <DataPanel title={selectedRun ? `${productMap.get(selectedRun.product_id)?.name ?? 'Production run'} · ${selectedRun.status}` : 'Run details'} subtitle={selectedRun ? `Run ${selectedRun.id.slice(0, 8)} · planned ${selectedRun.planned_quantity} ${unitMap.get(selectedRun.unit_id)?.symbol ?? ''}` : 'Select a run to inspect its material plan and output'}>
        {!selectedRun ? <EmptyState icon={<Factory size={18}/>} title="Select a production run" description="Planned and actual material quantities will be shown here."/> : <>
          {selectedRun.notes && <p className="mb-3 text-[10px] text-[#718078]">{selectedRun.notes}</p>}
          <div className="mb-4 overflow-x-auto"><table className="w-full min-w-[450px] text-left"><thead><tr>{['Material', 'Planned', ...(selectedRun.status === 'draft' ? ['Actual consumption'] : ['Actual', 'Variance'])].map((heading) => <th key={heading} className="border-b border-[#edf1ee] px-2 py-2 text-[8px] font-semibold uppercase tracking-wide text-[#9aa69f] first:pl-0">{heading}</th>)}</tr></thead><tbody>
            {selectedConsumption.map((line) => { const item = line.raw_material_id ? rawMap.get(line.raw_material_id) : line.packaging_material_id ? packagingMap.get(line.packaging_material_id) : undefined; const actual = line.actual_quantity; const variance = actual === null ? null : percent(actual, line.planned_quantity); return <tr key={line.id} className="border-b border-[#f0f3f1] last:border-0"><td className="py-2 pr-2 text-[10px] font-medium text-[#43574d]">{item?.name ?? 'Material'}<span className="mt-0.5 block text-[8px] font-normal text-[#9aa69f]">{item?.sku ?? 'Master record unavailable'}</span></td><td className="py-2 pr-2 text-[10px] text-[#66776e]">{line.planned_quantity} {unitMap.get(line.unit_id)?.symbol ?? ''}</td>{selectedRun.status === 'draft' ? <td className="py-2"><input aria-label={`Actual consumption for ${item?.name ?? 'material'}`} type="number" min="0" step="0.000001" value={actuals[line.id] ?? ''} onChange={(event) => setActuals((prev) => ({ ...prev, [line.id]: event.target.value }))} className="h-8 w-32 rounded-md border border-[#e2e9e5] px-2 text-[10px] outline-none focus:border-[#83b797]" placeholder="Enter actual"/><span className="ml-1 text-[8px] text-[#87958d]">{unitMap.get(line.unit_id)?.symbol ?? ''}</span></td> : <><td className="py-2 pr-2 text-[10px] text-[#66776e]">{actual} {unitMap.get(line.unit_id)?.symbol ?? ''}</td><td className={`py-2 text-[10px] font-medium ${variance !== null && Math.abs(variance) > varianceTolerance ? 'text-rose-700' : 'text-[#66776e]'}`}>{variance === null ? '—' : `${variance > 0 ? '+' : ''}${variance.toFixed(2)}%`}</td></>}</tr> })}
          </tbody></table></div>
          {selectedRun.status === 'completed' && outputMap.get(selectedRun.id) && (() => { const output = outputMap.get(selectedRun.id)!; const yieldPercent = selectedRun.planned_quantity > 0 ? output.good_quantity / selectedRun.planned_quantity * 100 : 0; const yieldVariance = yieldPercent - 100; const total = output.actual_quantity; const wastagePercent = total > 0 ? output.wastage_quantity / total * 100 : 0; return <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5"><Metric label="Good output" value={`${output.good_quantity} ${unitMap.get(output.unit_id)?.symbol ?? ''}`}/><Metric label="Rejected" value={`${output.rejected_quantity}`}/><Metric label="Wastage" value={`${output.wastage_quantity} · ${wastagePercent.toFixed(1)}%`}/><Metric label="Yield" value={`${yieldPercent.toFixed(1)}%`} highlight={yieldPercent < 100 - varianceTolerance}/><Metric label="Yield variance" value={`${yieldVariance > 0 ? '+' : ''}${yieldVariance.toFixed(1)}%`} highlight={Math.abs(yieldVariance) > varianceTolerance}/></div> })()}
          {selectedRun.status === 'draft' && canManage && <form onSubmit={completeRun} className="mt-4 space-y-3 border-t border-[#edf1ee] pt-4"><p className="text-[10px] font-semibold text-[#40544a]">Record actual output</p><div className="grid gap-3 sm:grid-cols-3"><TextField label={`Good output (${unitMap.get(selectedRun.unit_id)?.symbol ?? 'stock unit'})`} type="number" min="0" step="0.000001" required value={outputForm.good} onChange={(good) => setOutputForm({ ...outputForm, good })}/><TextField label="Rejected output" type="number" min="0" step="0.000001" required value={outputForm.rejected} onChange={(rejected) => setOutputForm({ ...outputForm, rejected })}/><TextField label="Wastage" type="number" min="0" step="0.000001" required value={outputForm.wastage} onChange={(wastage) => setOutputForm({ ...outputForm, wastage })}/></div><label className="block text-[10px] font-medium text-[#53665c]">Run notes<textarea value={outputForm.notes} onChange={(event) => setOutputForm({ ...outputForm, notes: event.target.value })} rows={2} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-xs outline-none focus:border-[#83b797]"/></label><FormError message={formError}/><div className="flex justify-end"><button disabled={saving || selectedConsumption.length === 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#13845b] px-4 text-[10px] font-semibold text-white hover:bg-[#0d6e4b] disabled:opacity-60">{saving ? <RefreshCw size={13} className="animate-spin"/> : <Play size={13}/ >}{saving ? 'Posting run…' : 'Complete and post stock'}</button></div><p className="text-right text-[8px] text-[#98a49d]">Completion is atomic. If any stock is insufficient, no consumption or output movement is saved.</p></form>}
          {selectedRun.status === 'draft' && !canManage && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[9px] text-amber-800">You have read-only access to production records.</p>}
        </>}
      </DataPanel>
    </div>

    {createOpen && <Dialog title="New production run" description="The database snapshots the active BOM and calculates planned inputs in each material’s stock unit." onClose={closeCreate}><FormGrid onSubmit={createRun}>
      <SelectField label="Finished product" value={createForm.product_id} onChange={(product_id) => setCreateForm({ ...createForm, product_id })} required options={data.products.filter((product) => product.is_active && data.bomHeaders.some((bom) => bom.product_id === product.id && bom.is_active)).map((product) => ({ value: product.id, label: `${product.name} · ${product.sku}` }))}/>
      <TextField label={`Planned good output (${unitMap.get(productMap.get(createForm.product_id)?.stock_unit_id ?? '')?.symbol ?? 'stock unit'})`} value={createForm.planned_quantity} onChange={(planned_quantity) => setCreateForm({ ...createForm, planned_quantity })} type="number" required min="0.000001" step="0.000001"/>
      <label className="block text-[10px] font-medium text-[#53665c] sm:col-span-2">Run notes<textarea value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} rows={2} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-xs outline-none focus:border-[#83b797]"/></label>
      {selectedBom && Number(createForm.planned_quantity) > 0 && <div className="sm:col-span-2 rounded-xl border border-[#e8eeea] bg-[#f8faf8] p-3"><p className="mb-2 text-[9px] font-semibold text-[#53665c]">Planned input preview · BOM baseline {selectedBom.expected_output}</p>{createBomItems.map((item) => { const factor = Number(createForm.planned_quantity) / selectedBom.expected_output; const material = item.raw_material_id ? rawMap.get(item.raw_material_id) : item.packaging_material_id ? packagingMap.get(item.packaging_material_id) : undefined; return <div key={item.id} className="flex justify-between gap-3 border-t border-[#e9efeb] py-1.5 text-[9px] text-[#66776e]"><span>{material?.name ?? 'Material'}</span><span className="font-medium">{(item.quantity * factor).toFixed(6).replace(/\.?0+$/, '')} {unitMap.get(item.unit_id)?.symbol ?? ''}</span></div> })}<p className="mt-1 text-[8px] text-[#94a098]">The server recalculates and stores the authoritative plan when creating the run.</p></div>}
      <div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={closeCreate} submitting={saving} submitLabel="Create draft"/></div>
    </FormGrid></Dialog>}
  </div>
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="rounded-lg border border-[#edf1ee] bg-[#fbfcfb] p-3"><p className="text-[8px] font-semibold uppercase tracking-wide text-[#95a199]">{label}</p><p className={`mt-1 text-[12px] font-semibold ${highlight ? 'text-rose-700' : 'text-[#43574d]'}`}>{value}</p></div>
}
