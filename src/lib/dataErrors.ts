type DatabaseErrorLike = { message?: string; code?: string; details?: string }

export function dataErrorMessage(error: unknown) {
  const dbError = error as DatabaseErrorLike
  if (dbError?.code === '42501') return 'Your role does not have permission to make that change.'
  if (dbError?.code === '23505') return 'A record with that code or value already exists.'
  if (dbError?.code === '23503') return 'This record is already referenced elsewhere and cannot be removed.'
  if (dbError?.code === '23514') return /insufficient/i.test(dbError.message ?? '')
    ? dbError.message
    : 'The values do not satisfy a database rule. Check units, quantities and required fields.'
  if (typeof dbError?.message === 'string' && dbError.message) return dbError.message
  if (error instanceof Error) return error.message
  return 'The request failed. Please try again.'
}

export function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}
