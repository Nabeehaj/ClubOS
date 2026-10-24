import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useClub } from '@/lib/club'
import { keys } from '@/lib/queryClient'
import { useQuality } from '@/lib/motion'
import { toast } from '@/components/ui/Toast'
import { PIPELINES } from './pipelines'

export const approvalsKey = (clubId) => ['club', String(clubId), 'approvals']

// One row per event: { event, reservation_25live, sb_engaged, financial_requests[], readiness, simulated }.
export function useApprovalsCenter() {
  const { clubId, api } = useClub()
  return useQuery({ queryKey: approvalsKey(clubId), queryFn: api.approvals.list })
}

function usePatchEntry() {
  const { clubId } = useClub()
  const qc = useQueryClient()
  return (eventId, fn) =>
    qc.setQueryData(approvalsKey(clubId), (list) => list?.map((e) => (e.event.id === eventId ? fn(e) : e)))
}

const scoreOf = (list, eventId) => list?.find((e) => e.event.id === eventId)?.readiness?.score

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// "Simulate next step" for one record. The status flips in place at once (from the server's reply), then the
// whole club refetches so readiness rolls up here, on the Dashboard and in the event workspace.
export function useSimulate(kind) {
  const { clubId, api } = useClub()
  const qc = useQueryClient()
  const patch = usePatchEntry()
  const { quality } = useQuality()

  return useMutation({
    mutationFn: ({ id }) =>
      kind === '25live'
        ? api.approvals.simulateReservation(id)
        : kind === 'sbe'
          ? api.approvals.simulateSbEngaged(id)
          : api.finance.simulateRequest(id),
    onSuccess: async (record, { eventId, eventName }) => {
      const before = scoreOf(qc.getQueryData(approvalsKey(clubId)), eventId)
      patch(eventId, (e) =>
        kind === '25live'
          ? { ...e, reservation_25live: record }
          : kind === 'sbe'
            ? { ...e, sb_engaged: record }
            : { ...e, financial_requests: e.financial_requests.map((r) => (r.id === record.id ? record : r)) },
      )
      // Let the status pill land first, then roll readiness: two beats read better than one.
      if (quality !== 'low') await wait(450)
      await qc.invalidateQueries({ queryKey: keys.club(clubId) })
      const after = scoreOf(qc.getQueryData(approvalsKey(clubId)), eventId)
      const system = PIPELINES[kind].system
      const gain = typeof before === 'number' && typeof after === 'number' && after !== before
      toast(
        `${system} for ${eventName} is now ${record.status} (simulated).` +
          (gain ? ` Readiness ${before}% → ${after}%.` : ''),
      )
    },
    onError: (err) => toast.error(err),
  })
}

// Tick / untick one SB Engaged document. Optimistic, rolled back on error.
export function useToggleDocument() {
  const { clubId, api } = useClub()
  const qc = useQueryClient()
  const patch = usePatchEntry()
  const mutationKey = ['approvals', 'toggle-document']

  return useMutation({
    mutationKey,
    mutationFn: ({ id, index }) => api.approvals.toggleDocument(id, index),
    onMutate: async ({ eventId, index }) => {
      await qc.cancelQueries({ queryKey: approvalsKey(clubId) })
      const prev = qc.getQueryData(approvalsKey(clubId))
      patch(eventId, (e) => ({
        ...e,
        sb_engaged: {
          ...e.sb_engaged,
          required_documents: e.sb_engaged.required_documents.map((d, i) => (i === index ? { ...d, done: !d.done } : d)),
        },
      }))
      return { prev }
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(approvalsKey(clubId), ctx.prev)
      toast.error(err)
    },
    onSettled: () => {
      // Only refetch once the last quick toggle lands, so a refetch never undoes a tick still in flight.
      if (qc.isMutating({ mutationKey }) <= 1) qc.invalidateQueries({ queryKey: keys.club(clubId) })
    },
  })
}
