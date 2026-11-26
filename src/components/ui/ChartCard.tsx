import type { ReactNode } from 'react'
import { DashboardCard } from './DashboardCard'
export function ChartCard({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <DashboardCard className={`p-4 sm:p-5 ${className}`}><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-[12px] font-semibold text-[#283c33]">{title}</h2>{subtitle && <p className="mt-1 text-[9px] text-[#92a098]">{subtitle}</p>}</div>{action}</div>{children}</DashboardCard>
}
