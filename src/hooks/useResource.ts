import { useCallback, useEffect, useState } from 'react'
import { dataErrorMessage } from '../lib/dataErrors'

export function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await loader())
    } catch (cause) {
      setError(dataErrorMessage(cause))
    } finally {
      setIsLoading(false)
    }
  }, [loader])

  useEffect(() => { void reload() }, [reload])
  return { data, isLoading, error, reload }
}
