import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { FileText, Plus, Printer, RefreshCw, Send } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useResource } from '../../hooks/useResource'
import { dataErrorMessage, localDateString } from '../../lib/dataErrors'
import { requireSupabase } from '../../lib/supabase'
import type { Json, SalesOrderStatus } from '../../lib/database.types'
import { DataPanel, Dialog, FormActions, FormError, FormGrid, LoadState, NewRecordButton, SelectField, TextField, Toolbar } from '../../components/data/DataPrimitives'
import { DataTable } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

type Customer = { id: string; name: string; state_code: string | null; gstin: string | null; is_active: boolean }
type Product = { id: string; sku: string; name: string; stock_unit_id: string; gst_rate: number; is_active: boolean; hsn_code: string | null }
type Price = { id: string; product_id: string; unit_price: number; effective_from: string; effective_to: string | null }
type Order = { id: string; customer_id: string; created_by: string; customer_state_code: string; status: SalesOrderStatus; subtotal: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number; notes: string | null; submitted_at: string; approved_at: string | null; created_at: string }
type OrderItem = { id: string; sales_order_id: string; product_id: string; product_sku: string; product_name: string; quantity: number; unit_id: string; unit_price: number; gst_rate: number; taxable_amount: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }
type Invoice = { id: string; sales_order_id: string; invoice_number: string; financial_year: string; issue_date: string; customer_id: string; customer_name: string; customer_gstin: string | null; customer_state_code: string; factory_state_code: string; subtotal: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }
type InvoiceItem = { id: string; invoice_id: string; sales_order_item_id: string; product_id: string; product_sku: string; product_name: string; hsn_code: string | null; quantity: number; unit_id: string; unit_price: number; gst_rate: number; taxable_amount: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }
type Unit = { id: string; symbol: string }
type SalesData = { customers: Customer[]; products: Product[]; prices: Price[]; orders: Order[]; orderItems: OrderItem[]; invoices: Invoice[]; invoiceItems: InvoiceItem[]; units: Unit[] }
type DraftLine = { product_id: string; quantity: string }

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
const money = (amount: number) => currency.format(amount)
const blankLine = (): DraftLine => ({ product_id: '', quantity: '' })
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)

export function OrdersPage() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'salesman'
  const canCreate = ['owner', 'admin', 'salesman'].includes(role)
  const canApprove = role === 'owner' || role === 'admin'
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([blankLine()])
  const [notes, setNotes] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (): Promise<SalesData> => {
    const db = requireSupabase()
    const [customers, products, prices, orders, orderItems, invoices, invoiceItems, units] = await Promise.all([
      db.from('customers').select('id,name,state_code,gstin,is_active').order('name'),
      db.from('products').select('id,sku,name,stock_unit_id,gst_rate,is_active,hsn_code').order('name'),
      db.from('product_prices').select('id,product_id,unit_price,effective_from,effective_to').order('effective_from', { ascending: false }),
      db.from('sales_orders').select('*').order('created_at', { ascending: false }),
      db.from('sales_order_items').select('*'),
      db.from('invoices').select('*').order('issue_date', { ascending: false }),
      db.from('invoice_items').select('*'),
      db.from('units').select('id,symbol'),
    ])
    const failed = [customers, products, prices, orders, orderItems, invoices, invoiceItems, units].find((result) => result.error)?.error
    if (failed) throw failed
    return { customers: customers.data ?? [], products: products.data ?? [], prices: prices.data ?? [], orders: orders.data ?? [], orderItems: orderItems.data ?? [], invoices: invoices.data ?? [], invoiceItems: invoiceItems.data ?? [], units: units.data ?? [] }
  }, [])
  const resource = useResource(load)
  const data: SalesData = resource.data ?? { customers: [], products: [], prices: [], orders: [], orderItems: [], invoices: [], invoiceItems: [], units: [] }
  const customerMap = useMemo(() => new Map(data.customers.map((row) => [row.id, row])), [data.customers])
  const unitMap = useMemo(() => new Map(data.units.map((row) => [row.id, row.symbol])), [data.units])
  const latestPrice = useMemo(() => {
    const today = localDateString()
    const current = new Map<string, Price>()
    for (const price of data.prices) {
      if (!current.has(price.product_id) && price.effective_from <= today && (!price.effective_to || price.effective_to >= today)) current.set(price.product_id, price)
    }
    return current
  }, [data.prices])
  const selectedOrder = data.orders.find((order) => order.id === selectedId) ?? data.orders[0] ?? null
  const selectedItems = data.orderItems.filter((item) => item.sales_order_id === selectedOrder?.id)
  const invoice = data.invoices.find((item) => item.sales_order_id === selectedOrder?.id) ?? null
  const invoiceLines = invoice ? data.invoiceItems.filter((item) => item.invoice_id === invoice.id) : []
  const filtered = data.orders.filter((order) => `${customerMap.get(order.customer_id)?.name ?? ''} ${order.status} ${order.id}`.toLowerCase().includes(search.trim().toLowerCase()))

  const refresh = async (id?: string) => { await resource.reload(); if (id) setSelectedId(id) }
  const openCreate = () => { setCustomerId(''); setLines([blankLine()]); setNotes(''); setFormError(null); setCreateOpen(true) }
  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null); setSuccess(null)
    if (!customerId) { setFormError('Select a customer.'); return }
    if (lines.some((line) => !line.product_id || !line.quantity.trim() || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0)) { setFormError('Choose a product and enter a quantity greater than zero on every line.'); return }
    setSaving(true)
    try {
      const p_lines = lines.map((line) => ({ product_id: line.product_id, quantity: line.quantity }))
      const { data: orderId, error } = await requireSupabase().rpc('create_sales_order', { p_customer_id: customerId, p_lines: p_lines as unknown as Json, p_notes: notes.trim() || null })
      if (error) throw error
      setCreateOpen(false); setSuccess('Order submitted. An admin can verify stock and approve it.'); await refresh(orderId)
    } catch (cause) { setFormError(dataErrorMessage(cause)) }
    finally { setSaving(false) }
  }

  const doAction = async (action: 'approve_sales_order' | 'issue_sales_invoice' | 'dispatch_sales_order') => {
    if (!selectedOrder) return
    setSaving(true); setFormError(null); setSuccess(null)
    try {
      const db = requireSupabase()
      const result = action === 'dispatch_sales_order'
        ? await db.rpc(action, { p_order_id: selectedOrder.id, p_notes: null })
        : await db.rpc(action, { p_order_id: selectedOrder.id })
      if (result.error) throw result.error
      const message = action === 'approve_sales_order' ? 'Order approved after stock validation.' : action === 'issue_sales_invoice' ? 'GST invoice issued and linked to this order.' : 'Order dispatched and finished stock deducted through the ledger.'
      setSuccess(message); await refresh(selectedOrder.id)
    } catch (cause) { setFormError(dataErrorMessage(cause)) }
    finally { setSaving(false) }
  }

  const printInvoice = () => {
    if (!invoice) return
    const popup = window.open('', '_blank', 'width=900,height=720')
    if (!popup) { setFormError('The invoice print window was blocked. Allow pop-ups for this site and try again.'); return }
    const linesHtml = invoiceLines.map((line) => `<tr><td>${escapeHtml(line.product_name)}</td><td>${escapeHtml(line.hsn_code ?? '')}</td><td>${line.quantity} ${escapeHtml(unitMap.get(line.unit_id) ?? '')}</td><td>${money(line.unit_price)}</td><td>${money(line.taxable_amount)}</td><td>${money(line.cgst_amount)}</td><td>${money(line.sgst_amount)}</td><td>${money(line.igst_amount)}</td><td>${money(line.total_amount)}</td></tr>`).join('')
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(invoice.invoice_number)}</title><style>body{font:14px Arial,sans-serif;color:#17251f;margin:40px}header{display:flex;justify-content:space-between;border-bottom:2px solid #145b40;padding-bottom:18px}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:28px;font-size:12px}th,td{border:1px solid #dce5df;padding:8px;text-align:left}th{background:#eff5f1}.totals{margin:24px 0 0 auto;width:320px}.totals div{display:flex;justify-content:space-between;padding:5px;border-bottom:1px solid #eee}.grand{font-weight:bold;font-size:16px}.muted{color:#64746c;font-size:12px}</style></head><body><header><div><h1>SnackFlow · Tax Invoice</h1><p class="muted">Factory state: ${escapeHtml(invoice.factory_state_code)} · Supplier GSTIN: not configured in the current profile</p></div><div><b>${escapeHtml(invoice.invoice_number)}</b><p>${escapeHtml(invoice.issue_date)} · FY ${escapeHtml(invoice.financial_year)}</p></div></header><h3>${escapeHtml(invoice.customer_name)}</h3><p class="muted">Customer GSTIN: ${escapeHtml(invoice.customer_gstin ?? '—')} · State: ${escapeHtml(invoice.customer_state_code)}</p><table><thead><tr><th>Product</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead><tbody>${linesHtml}</tbody></table><div class="totals"><div><span>Taxable amount</span><b>${money(invoice.subtotal)}</b></div><div><span>CGST</span><b>${money(invoice.cgst_amount)}</b></div><div><span>SGST</span><b>${money(invoice.sgst_amount)}</b></div><div><span>IGST</span><b>${money(invoice.igst_amount)}</b></div><div class="grand"><span>Invoice total</span><b>${money(invoice.total_amount)}</b></div></div><script>window.onload=()=>window.print()</script></body></html>`)
    popup.document.close()
  }

  const statusClass = (status: SalesOrderStatus) => ({ submitted: 'bg-amber-50 text-amber-800', approved: 'bg-sky-50 text-sky-800', invoiced: 'bg-violet-50 text-violet-800', dispatched: 'bg-emerald-50 text-emerald-800' })[status]

  return <div className="mx-auto max-w-[1440px]">
    <PageHeader eyebrow="Sales · Live Supabase orders" title="Orders" description="Create customer orders, approve stock, issue tax invoices and dispatch through the inventory ledger." action={canCreate ? <NewRecordButton onClick={openCreate}>Create order</NewRecordButton> : undefined}/>
    {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-800">{success}</p>}
    <div className="grid items-start gap-4 xl:grid-cols-[0.95fr_1.4fr]">
      <DataPanel title="Order queue" subtitle={`${data.orders.length} orders · salesmen see only their own records`}>
        <Toolbar><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or status…" aria-label="Search orders" className="h-9 min-w-0 flex-1 rounded-lg border border-[#e3eae6] px-3 text-xs outline-none focus:border-[#91bea2]"/><button onClick={() => void resource.reload()} aria-label="Refresh orders" className="grid h-9 w-9 place-items-center rounded-lg border border-[#e3eae6] text-[#718078]"><RefreshCw size={14}/></button></Toolbar>
        <LoadState loading={resource.isLoading} error={resource.error} onRetry={() => void resource.reload()}>{filtered.length ? <DataTable headers={['Customer / order', 'Submitted', 'Total', 'Status']}>
          {filtered.map((order) => <tr key={order.id} onClick={() => { setSelectedId(order.id); setFormError(null) }} className={`cursor-pointer border-b border-[#f0f3f1] last:border-0 hover:bg-[#f8faf8] ${selectedOrder?.id === order.id ? 'bg-emerald-50/60' : ''}`}><td className="py-3 pr-2 text-[10px] font-medium text-[#43574d]">{customerMap.get(order.customer_id)?.name ?? 'Customer'}<span className="mt-0.5 block text-[8px] font-normal text-[#9aa69f]">{order.id.slice(0, 8)}</span></td><td className="py-3 pr-2 text-[9px] text-[#728178]">{new Date(order.submitted_at).toLocaleDateString('en-IN')}</td><td className="py-3 pr-2 text-[10px] font-medium text-[#43574d]">{money(order.total_amount)}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[8px] font-medium capitalize ${statusClass(order.status)}`}>{order.status}</span></td></tr>)}
        </DataTable> : <EmptyState icon={<Send size={17}/>} title={search ? 'No matching orders' : 'No orders yet'} description={search ? 'Try another customer or status.' : 'Create an order from a real customer and active product price.'}/>}</LoadState>
      </DataPanel>

      <DataPanel title={selectedOrder ? `${customerMap.get(selectedOrder.customer_id)?.name ?? 'Order'} · ${selectedOrder.status}` : 'Order details'} subtitle={selectedOrder ? `Submitted ${new Date(selectedOrder.submitted_at).toLocaleString('en-IN')} · order ${selectedOrder.id.slice(0, 8)}` : 'Select an order to review its line items and workflow'} action={(selectedOrder?.status === 'invoiced' || selectedOrder?.status === 'dispatched') && invoice ? <button onClick={printInvoice} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dfe9e2] px-3 text-[10px] font-medium text-[#4e6257] hover:bg-[#f5f8f6]"><Printer size={14}/>Print / Save PDF</button> : undefined}>
        {!selectedOrder ? <EmptyState icon={<FileText size={17}/>} title="Select an order" description="Order approval and invoice actions are shown here."/> : <>
          {selectedItems.length > 0 && <div className="overflow-x-auto"><DataTable headers={['Product', 'Quantity', 'Unit price', 'GST', 'Line total']}>{selectedItems.map((item) => <tr key={item.id} className="border-b border-[#f0f3f1] last:border-0"><td className="py-3 pr-2 text-[10px] font-medium text-[#43574d]">{item.product_name}<span className="block text-[8px] font-normal text-[#9aa69f]">{item.product_sku}</span></td><td className="py-3 pr-2 text-[10px] text-[#66776e]">{item.quantity} {unitMap.get(item.unit_id) ?? ''}</td><td className="py-3 pr-2 text-[10px] text-[#66776e]">{money(item.unit_price)}</td><td className="py-3 pr-2 text-[10px] text-[#66776e]">{(item.gst_rate * 100).toFixed(2).replace(/\.00$/, '')}%</td><td className="py-3 text-[10px] font-medium text-[#43574d]">{money(item.total_amount)}</td></tr>)}</DataTable></div>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><Amount label="Taxable" value={selectedOrder.subtotal}/><Amount label="CGST" value={selectedOrder.cgst_amount}/><Amount label="SGST" value={selectedOrder.sgst_amount}/><Amount label="IGST" value={selectedOrder.igst_amount}/><Amount label="Total" value={selectedOrder.total_amount} prominent/></div>
          {selectedOrder.notes && <p className="mt-3 text-[9px] text-[#829087]">{selectedOrder.notes}</p>}
          {invoice && <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold text-[#4e4d70]">GST invoice · {invoice.invoice_number}</p><p className="mt-1 text-[8px] text-[#89889e]">FY {invoice.financial_year} · {invoice.issue_date} · {invoice.factory_state_code === invoice.customer_state_code ? 'CGST + SGST' : 'IGST'}</p></div>{(selectedOrder.status === 'invoiced' || selectedOrder.status === 'dispatched') && <button onClick={printInvoice} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[9px] font-medium text-[#5d5b7a] shadow-sm"><Printer size={12}/>Print / Save PDF</button>}</div></div>}
          {formError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{formError}</p>}
          {canApprove && <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#edf1ee] pt-4">{selectedOrder.status === 'submitted' && <button disabled={saving} onClick={() => void doAction('approve_sales_order')} className="h-9 rounded-lg bg-[#13845b] px-3 text-[10px] font-semibold text-white disabled:opacity-60">{saving ? 'Working…' : 'Approve · validate stock'}</button>}{selectedOrder.status === 'approved' && <button disabled={saving} onClick={() => void doAction('issue_sales_invoice')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#13845b] px-3 text-[10px] font-semibold text-white disabled:opacity-60"><FileText size={13}/>{saving ? 'Issuing…' : 'Issue GST invoice'}</button>}{selectedOrder.status === 'invoiced' && <button disabled={saving} onClick={() => void doAction('dispatch_sales_order')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#13845b] px-3 text-[10px] font-semibold text-white disabled:opacity-60"><Send size={13}/>{saving ? 'Dispatching…' : 'Dispatch · deduct stock'}</button>}</div>}
          {!canApprove && selectedOrder.status !== 'dispatched' && <p className="mt-4 border-t border-[#edf1ee] pt-3 text-[9px] text-[#8a9790]">Admin approval, invoice issuance and dispatch are managed by an admin or owner.</p>}
        </>}
      </DataPanel>
    </div>

    {createOpen && <Dialog title="Create customer order" description="Selling prices and GST are read from current master records and calculated in PostgreSQL." onClose={() => { if (!saving) setCreateOpen(false) }}><FormGrid onSubmit={createOrder}>
      <SelectField label="Customer" value={customerId} onChange={setCustomerId} required options={data.customers.filter((customer) => customer.is_active && customer.state_code).map((customer) => ({ value: customer.id, label: `${customer.name} · state ${customer.state_code}` }))}/>
      <div className="sm:col-span-2 space-y-2"><div className="flex items-center justify-between"><p className="text-[10px] font-medium text-[#53665c]">Order lines</p><button type="button" onClick={() => setLines((current) => [...current, blankLine()])} className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#13845b]"><Plus size={13}/>Add product</button></div>{lines.map((line, index) => { const price = latestPrice.get(line.product_id); const product = data.products.find((row) => row.id === line.product_id); return <div key={index} className="grid items-end gap-2 rounded-lg border border-[#edf1ee] p-2 sm:grid-cols-[1fr_120px_auto]"><SelectField label={`Product ${index + 1}`} value={line.product_id} onChange={(product_id) => setLines((current) => current.map((row, i) => i === index ? { ...row, product_id } : row))} required options={data.products.filter((row) => row.is_active && latestPrice.has(row.id)).map((row) => ({ value: row.id, label: `${row.name} · ${row.sku}` }))}/><TextField label={`Quantity (${product ? unitMap.get(product.stock_unit_id) ?? 'stock unit' : 'units'})`} value={line.quantity} onChange={(quantity) => setLines((current) => current.map((row, i) => i === index ? { ...row, quantity } : row))} type="number" required min="0.000001" step="0.000001"/>{lines.length > 1 && <button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="h-9 px-2 text-[9px] text-rose-700">Remove</button>}<p className="text-[8px] text-[#84928b] sm:col-span-3">{price ? `Current price ${money(price.unit_price)} · GST ${((product?.gst_rate ?? 0) * 100).toFixed(2)}%` : 'Select a product with a current selling price.'}</p></div> })}</div>
      <label className="block text-[10px] font-medium text-[#53665c] sm:col-span-2">Order notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={2} className="mt-1.5 w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-xs outline-none focus:border-[#83b797]"/></label>
      <div className="sm:col-span-2"><FormError message={formError}/></div><div className="sm:col-span-2"><FormActions onCancel={() => setCreateOpen(false)} submitting={saving} submitLabel="Submit order"/></div>
    </FormGrid></Dialog>}
  </div>
}

function Amount({ label, value, prominent = false }: { label: string; value: number; prominent?: boolean }) {
  return <div className={`rounded-lg border p-2.5 ${prominent ? 'border-emerald-100 bg-emerald-50/50' : 'border-[#edf1ee] bg-[#fbfcfb]'}`}><p className="text-[8px] font-semibold uppercase tracking-wide text-[#95a199]">{label}</p><p className={`mt-1 text-[11px] font-semibold ${prominent ? 'text-[#13845b]' : 'text-[#43574d]'}`}>{money(value)}</p></div>
}
