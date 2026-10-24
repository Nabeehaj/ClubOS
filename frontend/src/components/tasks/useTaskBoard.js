import { useCallback, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useClub } from '@/lib/club'
import { useAuth } from '@/lib/auth'
import { keys } from '@/lib/queryClient'
import { toast } from '@/components/ui/Toast'
import { taskKeys } from './taskModel'

// Does a task belong in a list fetched with these filters? Used to drop new tasks straight into the right cache.
function matches(filters, task, meId) {
  if (filters?.event && String(task.event_id) !== String(filters.event)) return false
  if (filters?.mine) return String(task.assignee_id) === String(meId)
  if (filters?.assignee && String(task.assignee_id) !== String(filters.assignee)) return false
  return true
}

export function useTaskQueries(filters) {
  const { clubId, api } = useClub()
  const list = useQuery({
    queryKey: taskKeys.list(clubId, filters),
    queryFn: () =>
      api.tasks.list({
        event_id: filters.event || undefined,
        assignee_id: !filters.mine && filters.assignee ? filters.assignee : undefined,
        mine: filters.mine ? true : undefined,
      }),
    placeholderData: keepPreviousData,
  })
  const members = useQuery({ queryKey: taskKeys.members(clubId), queryFn: api.members.list })
  const events = useQuery({ queryKey: taskKeys.events(clubId), queryFn: () => api.events.list() })
  return { list, members, events }
}

// All task writes. Quick edits (drag, status menu, assignee picker) go through `patchTask`: the change is applied
// to a local override map in the same render as the gesture (so dnd-kit's drop animation lands in the new
// column), then reconciled with the server response. A failed request drops the override, which moves the card back.
export function useTaskActions() {
  const { clubId, api } = useClub()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [overrides, setOverrides] = useState({})
  const version = useRef(0)
  const patchKey = ['tasks-patch', String(clubId)]

  const refreshClub = useCallback(() => qc.invalidateQueries({ queryKey: keys.club(clubId) }), [qc, clubId])

  const writeTask = useCallback(
    (task) =>
      qc.setQueriesData({ queryKey: taskKeys.lists(clubId) }, (list) =>
        Array.isArray(list) ? list.map((t) => (t.id === task.id ? task : t)) : list,
      ),
    [qc, clubId],
  )

  const patch = useMutation({
    mutationKey: patchKey,
    mutationFn: ({ id, body }) => api.tasks.update(id, body),
    onSuccess: (updated) => writeTask(updated),
    onError: (err) => toast.error(err),
    onSettled: (_data, _err, { id, v }) => {
      setOverrides((o) => {
        if (o[id]?.v !== v) return o
        const next = { ...o }
        delete next[id]
        return next
      })
      // Refresh the dashboard, member counts and the board once the last quick edit has landed.
      if (qc.isMutating({ mutationKey: patchKey }) <= 1) refreshClub()
    },
  })
  const { mutate: sendPatch } = patch

  // body: what the server gets. view: extra fields to show immediately (e.g. the assignee object).
  const patchTask = useCallback(
    (task, body, view = {}) => {
      const v = ++version.current
      qc.cancelQueries({ queryKey: taskKeys.lists(clubId) })
      setOverrides((o) => ({ ...o, [task.id]: { v, fields: { ...o[task.id]?.fields, ...body, ...view } } }))
      sendPatch({ id: task.id, body, v })
    },
    [qc, clubId, sendPatch],
  )

  const applyOverrides = useCallback(
    (tasks) => tasks.map((t) => (overrides[t.id] ? { ...t, ...overrides[t.id].fields } : t)),
    [overrides],
  )

  const create = useMutation({
    mutationFn: (body) => api.tasks.create(body),
    onSuccess: (task) => {
      for (const [key, list] of qc.getQueriesData({ queryKey: taskKeys.lists(clubId) })) {
        if (Array.isArray(list) && matches(key[4], task, user?.id)) qc.setQueryData(key, [...list, task])
      }
      refreshClub()
    },
  })

  const save = useMutation({
    mutationFn: ({ id, body }) => api.tasks.update(id, body),
    onSuccess: (task) => {
      writeTask(task)
      refreshClub()
    },
  })

  const remove = useMutation({
    mutationFn: (id) => api.tasks.remove(id),
    onSuccess: (_data, id) => {
      qc.setQueriesData({ queryKey: taskKeys.lists(clubId) }, (list) =>
        Array.isArray(list) ? list.filter((t) => t.id !== id) : list,
      )
      refreshClub()
    },
  })

  return { patchTask, applyOverrides, create, save, remove }
}
