import type { ReactNode } from 'react'
export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dce5df] bg-white px-6 text-center"><span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#edf6f0] text-[#16835a]">{icon}</span><h2 className="text-sm font-semibold text-[#34483f]">{title}</h2><p className="mt-1 max-w-sm text-xs leading-5 text-[#8b9992]">{description}</p></div>
}
