import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="text-sm font-medium text-brand">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That address does not match a SnackFlow page.</p>
      <Link className="mt-6 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark" to="/">Return to setup</Link>
    </div>
  )
}
