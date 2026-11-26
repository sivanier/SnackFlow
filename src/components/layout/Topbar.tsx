import type { ReactNode } from 'react'

/** Shared responsive top navigation surface for page controls. */
export function Topbar({ children }: { children: ReactNode }) {
  return <header className="sticky top-0 z-30 flex h-[74px] items-center justify-between border-b border-[#e9eeeb] bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-9">{children}</header>
}
