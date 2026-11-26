import type { ReactNode } from 'react'
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow && <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#178259]">{eyebrow}</p>}<h1 className="text-[23px] font-semibold tracking-[-0.04em] text-[#1a2e26] sm:text-[26px]">{title}</h1>{description && <p className="mt-1.5 text-[11px] text-[#84928b]">{description}</p>}</div>{action}</div>
}
