export function StatusBadge({ status }: { status: 'Completed' | 'In production' | 'Pending' | 'Low stock' | 'Demo' }) {
  const style = status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : status === 'Pending' ? 'bg-amber-50 text-amber-700' : status === 'Low stock' ? 'bg-rose-50 text-rose-700' : status === 'In production' ? 'bg-sky-50 text-sky-700' : 'bg-[#f2f5f3] text-[#63736b]'
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-medium ${style}`}><span className="h-1 w-1 rounded-full bg-current"/>{status}</span>
}
