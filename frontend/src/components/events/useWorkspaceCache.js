import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/queryClient'
import { eventKeys } from './eventUtils'

// Optimistic helpers for the one-call workspace query: snapshot, patch, roll back, then refresh the whole club.
export function useWorkspaceCache(clubId, eventId) {
  const qc = useQueryClient()
  const key = useMemo(() => eventKeys.workspace(clubId, eventId), [clubId, eventId])

  const begin = useCallback(async () => {
    await qc.cancelQueries({ queryKey: key })
    return qc.getQueryData(key)
  }, [qc, key])

  const patch = useCallback((fn) => qc.setQueryData(key, (d) => (d ? fn(d) : d)), [qc, key])

  const rollback = useCallback((prev) => prev && qc.setQueryData(key, prev), [qc, key])

  // A short delay lets the optimistic animation finish before fresh server numbers re-render everything.
  const refresh = useCallback(
    (delay = 0) => {
      const run = () => qc.invalidateQueries({ queryKey: keys.club(clubId) })
      if (delay) setTimeout(run, delay)
      else run()
    },
    [qc, clubId],
  )

  return { key, begin, patch, rollback, refresh }
}
