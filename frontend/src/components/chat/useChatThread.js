import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/queryClient'
import { POLL_MS, chatKeys, lastId, mergeMessages } from './chatUtils'

let tempSeq = 0

// Messages for one channel: first load fetches the history, every poll after that asks only for
// ?after_id=<last id> and appends. TanStack pauses the interval while the tab is hidden.
// Sends are optimistic: a local "pending" row shows at once and is swapped for the real one, keeping its key.
export function useChatThread({ api, clubId, channelId, me }) {
  const qc = useQueryClient()
  const key = chatKeys.messages(clubId, channelId)
  const [pending, setPending] = useState([])
  // real message id -> the temp key it replaced, so the row never re-mounts (no second entrance animation)
  const keyMap = useRef(new Map())

  const query = useQuery({
    queryKey: key,
    enabled: channelId != null,
    queryFn: async () => {
      const have = qc.getQueryData(key)
      if (!have) return api.chat.messages(channelId, { limit: 100 })
      const fresh = await api.chat.messages(channelId, { after_id: lastId(have) })
      return mergeMessages(qc.getQueryData(key) ?? have, fresh)
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })

  const post = useCallback(
    async (tempKey, toChannel, body) => {
      try {
        const msg = await api.chat.send(toChannel, { body })
        keyMap.current.set(msg.id, tempKey)
        qc.setQueryData(chatKeys.messages(clubId, toChannel), (prev) => mergeMessages(prev ?? [], [msg]))
        setPending((p) => p.filter((x) => x.tempKey !== tempKey))
        qc.invalidateQueries({ queryKey: keys.club(clubId) })
      } catch (err) {
        setPending((p) => p.map((x) => (x.tempKey === tempKey ? { ...x, status: 'failed', error: err } : x)))
      }
    },
    [api, clubId, qc],
  )

  const send = useCallback(
    (raw) => {
      const body = raw.trim()
      if (!body || channelId == null) return
      const tempKey = `tmp-${++tempSeq}`
      setPending((p) => [
        ...p,
        {
          tempKey,
          channelId,
          body,
          afterId: lastId(qc.getQueryData(chatKeys.messages(clubId, channelId))),
          created_at: new Date().toISOString(),
          status: 'sending',
        },
      ])
      post(tempKey, channelId, body)
    },
    [channelId, clubId, post, qc],
  )

  const retry = useCallback(
    (tempKey) => {
      const item = pending.find((x) => x.tempKey === tempKey)
      if (!item) return
      setPending((p) => p.map((x) => (x.tempKey === tempKey ? { ...x, status: 'sending', error: null } : x)))
      post(tempKey, item.channelId, item.body)
    },
    [pending, post],
  )

  const discard = useCallback((tempKey) => setPending((p) => p.filter((x) => x.tempKey !== tempKey)), [])

  const messages = query.data
  const items = useMemo(() => {
    const real = messages ?? []
    const mine = pending.filter((p) => p.channelId === channelId)
    // A poll can deliver our own message before the POST resolves. Match it so it isn't shown twice.
    const visiblePending = mine.filter((p) => {
      const match = real.find(
        (m) => m.id > p.afterId && !m.is_bot && m.author?.id === me?.id && m.body === p.body && !keyMap.current.has(m.id),
      )
      if (match) {
        keyMap.current.set(match.id, p.tempKey)
        return false
      }
      return true
    })
    return [
      ...real.map((m) => ({ ...m, key: keyMap.current.get(m.id) ?? `m-${m.id}` })),
      ...visiblePending.map((p) => ({
        id: null,
        key: p.tempKey,
        tempKey: p.tempKey,
        body: p.body,
        created_at: p.created_at,
        author: me,
        is_bot: false,
        pending: p.status,
        error: p.error,
      })),
    ]
  }, [messages, pending, channelId, me])

  return { query, items, send, retry, discard }
}
