import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'
import { modules } from '../components/layout/AppShell'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

const descriptions: Record<string, string> = {
  Orders: 'Review order workflows and fulfillment status.', Products: 'Browse the packaged-snacks product catalog.', Customers: 'Explore customer records and account details.', Inventory: 'Inspect the inventory ledger and stock position.', Production: 'Review production runs and output.', BOM: 'View bills of materials and product recipes.', Purchases: 'Track supplier purchases and receipts.', Invoices: 'Review invoices and tax summaries.', Payments: 'Track collections and payment allocations.', Reports: 'Explore sales, stock, production, and finance reports.', Settings: 'Manage workspace preferences and access.',
}

export function ModulePreviewPage({ title, accessDenied = false }: { title: string; accessDenied?: boolean }) {
  const navigate = useNavigate()
  const Icon = modules.find((module) => module.label === title)?.icon ?? Construction
  return <div className="mx-auto max-w-[1440px]"><PageHeader eyebrow="Role-based workspace · Frontend preview" title={title} description={descriptions[title]} action={<span className="rounded-full bg-[#eff7f1] px-3 py-1.5 text-[9px] font-medium text-[#47715a]">Preview only</span>}/>{accessDenied ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">This navigation item is outside your role’s preview. PostgreSQL RLS policies independently protect the data.</div> : <div className="mb-5 rounded-lg border border-[#dcece2] bg-[#eff7f1] px-3 py-2 text-[9px] text-[#47715a]">This module is part of the design preview. No business records or operational actions are connected.</div>}<EmptyState icon={<Icon size={19}/>} title={accessDenied ? 'Access restricted' : `${title} workspace preview`} description={accessDenied ? 'Your assigned role does not include this module.' : 'This area is reserved for a later implementation milestone. It will connect to verified workspace data after its workflow and permissions are designed.'}/><button onClick={() => navigate('/')} className="mt-5 flex items-center gap-2 rounded-lg border border-[#e2e9e5] bg-white px-3 py-2 text-[10px] font-medium text-[#586b61] hover:border-[#c5d8cc]"><ArrowLeft size={13}/> Back to dashboard</button></div>
}
