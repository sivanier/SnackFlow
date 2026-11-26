import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function DashboardCard({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay, ease: 'easeOut' }} whileHover={{ y: -2 }} className={`rounded-2xl border border-[#e7ece9] bg-white shadow-[0_2px_10px_rgba(22,47,36,0.025)] ${className}`}>{children}</motion.section>
}
