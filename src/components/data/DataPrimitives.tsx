import { useEffect, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, LoaderCircle, Plus, Search, X } from 'lucide-react'
import { LoadingSkeleton } from '../ui/LoadingSkeleton'

export function SearchBox({ value, onChange, placeholder = 'Search records…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="relative block min-w-[210px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#93a199]"/><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-[#e3eae6] bg-white pl-9 pr-3 text-xs text-[#34483f] outline-none placeholder:text-[#a0aba5] focus:border-[#91bea2]" aria-label="Search records"/></label>
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#e8eeea] bg-white p-3">{children}</div>
}

export function NewRecordButton({ onClick, disabled = false, children = 'New record' }: { onClick: () => void; disabled?: boolean; children?: ReactNode }) {
  return <button onClick={onClick} disabled={disabled} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#13845b] px-3.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#0d6e4b] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15}/>{children}</button>
}

export function DataPanel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-2xl border border-[#e7ece9] bg-white p-4 shadow-[0_2px_10px_rgba(22,47,36,0.025)] sm:p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[12px] font-semibold text-[#283c33]">{title}</h2>{subtitle && <p className="mt-1 text-[9px] text-[#92a098]">{subtitle}</p>}</div>{action}</div>{children}</section>
}

export function LoadState({ loading, error, onRetry, children }: { loading: boolean; error: string | null; onRetry: () => void; children: ReactNode }) {
  if (loading) return <LoadingSkeleton lines={5}/> 
  if (error) return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 text-rose-700"/><div className="flex-1"><p className="text-xs font-semibold text-rose-900">Could not load this data</p><p className="mt-1 text-[11px] leading-5 text-rose-800">{error}</p><button onClick={onRetry} className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[10px] font-medium text-rose-800 hover:bg-rose-100">Try again</button></div></div></div>
  return <>{children}</>
}

export function Dialog({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="fixed inset-0 z-[60] grid place-items-end bg-[#10251e]/45 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="form-dialog-title" className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-[#e5ece7] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="form-dialog-title" className="text-base font-semibold tracking-tight text-[#263a30]">{title}</h2>{description && <p className="mt-1 text-[10px] leading-5 text-[#86948c]">{description}</p>}</div><button onClick={onClose} className="rounded-lg p-1.5 text-[#7d8b83] hover:bg-[#f3f6f4]" aria-label="Close dialog"><X size={17}/></button></div>{children}</section></div>
}

export function TextField({ label, value, onChange, type = 'text', required = false, placeholder, min, max, step, maxLength, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string; min?: string; max?: string; step?: string; maxLength?: number; disabled?: boolean }) {
  return <label className="block text-[10px] font-medium text-[#53665c]">{label}{required && <span className="ml-0.5 text-rose-600">*</span>}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} min={min} max={max} step={step} maxLength={maxLength} disabled={disabled} className="mt-1.5 h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-xs text-[#30463a] outline-none placeholder:text-[#a4afa9] focus:border-[#83b797] focus:ring-2 focus:ring-emerald-50 disabled:bg-[#f4f7f5]"/></label>
}

export function SelectField({ label, value, onChange, options, required = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; required?: boolean; disabled?: boolean }) {
  return <label className="block text-[10px] font-medium text-[#53665c]">{label}{required && <span className="ml-0.5 text-rose-600">*</span>}<select required={required} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="mt-1.5 h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-xs text-[#30463a] outline-none focus:border-[#83b797] disabled:bg-[#f4f7f5]"><option value="">Select…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

export function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-2 text-[10px] font-medium text-[#53665c]"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-[#cbd7d0] accent-[#13845b]"/>{label}</label>
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] leading-5 text-rose-800">{message}</p> : null
}

export function FormActions({ onCancel, submitting, submitLabel = 'Save changes' }: { onCancel: () => void; submitting: boolean; submitLabel?: string }) {
  return <div className="flex justify-end gap-2 border-t border-[#edf1ee] pt-4"><button type="button" onClick={onCancel} disabled={submitting} className="h-9 rounded-lg border border-[#e1e8e4] px-3 text-[10px] font-medium text-[#586b61] hover:bg-[#f6f8f7] disabled:opacity-50">Cancel</button><button type="submit" disabled={submitting} className="inline-flex h-9 min-w-28 items-center justify-center gap-1.5 rounded-lg bg-[#13845b] px-3 text-[10px] font-semibold text-white hover:bg-[#0d6e4b] disabled:opacity-60">{submitting && <LoaderCircle size={13} className="animate-spin"/>}{submitting ? 'Saving…' : submitLabel}</button></div>
}

export function FormGrid({ children, onSubmit }: { children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{children}</div></form>
}
