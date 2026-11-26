export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return <div className="animate-pulse space-y-3 rounded-2xl border border-[#e7ece9] bg-white p-5" aria-label="Loading preview" role="status"><span className="block h-3 w-28 rounded bg-[#e9efeb]"/><span className="block h-7 w-40 rounded bg-[#eef2ef]"/>{Array.from({ length: lines }, (_, i) => <span key={i} className={`block h-3 rounded bg-[#f0f3f1] ${i % 2 ? 'w-4/5' : 'w-full'}`}/>)}</div>
}
