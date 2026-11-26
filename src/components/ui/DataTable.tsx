import type { ReactNode } from 'react'
export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left"><thead><tr>{headers.map((h) => <th key={h} className="border-b border-[#edf1ee] px-3 py-2.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#9aa69f] first:pl-0">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}
