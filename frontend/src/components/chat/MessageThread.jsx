import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, CalendarDays, Hash, MessagesSquare, Radio, WifiOff } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'
import { BotMessage, DayDivider, MessageGroup } from './Messages'
import { Composer } from './Composer'
import { buildBlocks, settle } from './chatUtils'

const NEAR_BOTTOM_PX = 120

// Re-render every 30 s so "2 minutes ago" stays honest.
function useMinuteTick() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])
}

function ThreadHeader({ channel, event, clubId, query }) {
  const reconnecting = query.isError && !!query.data
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="font-display flex items-center gap-1.5 text-[16px] font-semibold text-fg">
          <Hash className="size-4 text-faint" aria-hidden />
          <span className="truncate">{channel.name}</span>
        </h2>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
          {channel.description && <span className="truncate">{channel.description}</span>}
          {event && (
            <Link
              to={`/c/${clubId}/events/${event.id}`}
              className="inline-flex items-center gap-1 text-muted underline decoration-line underline-offset-2 hover:text-fg hover:decoration-current"
            >
              <CalendarDays className="size-3.5" aria-hidden />
              {event.name}
            </Link>
          )}
        </div>
      </div>
      <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-[12px] text-faint" role="status">
        {reconnecting ? (
          <>
            <WifiOff className="size-3.5 text-warn" aria-hidden /> Reconnecting
          </>
        ) : (
          <>
            <Radio className="size-3.5 text-ok" aria-hidden /> Live
          </>
        )}
      </span>
    </header>
  )
}

export function MessageThread({
  channel,
  event,
  clubId,
  me,
  thread,
  draftId,
  created,
  onMakeTask,
  className,
}) {
  useMinuteTick()
  const reduced = useReducedMotion()
  const { query, items, send, retry, discard } = thread
  const blocks = useMemo(() => buildBlocks(items), [items])

  const scrollRef = useRef(null)
  const nearBottom = useRef(true)
  const prevLen = useRef(0)
  const placed = useRef(false)
  const [unseen, setUnseen] = useState(0)

  const toBottom = (smooth) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced ? 'smooth' : 'auto' })
  }

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    if (nearBottom.current && unseen) setUnseen(0)
  }

  // Follow new messages only if the reader is already at the bottom (or just sent one).
  // Otherwise count them into the "new messages" button.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const len = items.length
    if (!placed.current) {
      if (len > 0) {
        el.scrollTop = el.scrollHeight
        placed.current = true
      }
      prevLen.current = len
      return
    }
    if (len > prevLen.current) {
      const added = items.slice(prevLen.current)
      const mine = added.some((m) => m.pending || (me && m.author?.id === me.id && !m.is_bot))
      if (nearBottom.current || mine) toBottom(true)
      else setUnseen((u) => u + added.length)
    }
    prevLen.current = len
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  let body
  if (query.isPending) {
    body = <SkeletonRows rows={6} className="p-5" />
  } else if (query.isError && !query.data) {
    body = <ErrorState error={query.error} onRetry={query.refetch} className="m-5" />
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={MessagesSquare}
        title={`#${channel.name} is quiet`}
        hint="Write the first message. Everyone on the board sees it within a few seconds."
        className="h-full"
      />
    )
  } else {
    body = (
      <ol className="pb-3 pt-4" aria-label={`Messages in #${channel.name}`}>
        <AnimatePresence initial={false}>
          {blocks.map((b) =>
            b.type === 'day' ? (
              <DayDivider key={b.key} label={b.label} />
            ) : b.type === 'bot' ? (
              <BotMessage key={b.key} message={b.message} />
            ) : (
              <MessageGroup
                key={b.key}
                group={b}
                clubId={clubId}
                draftId={draftId}
                created={created}
                onMakeTask={onMakeTask}
                onRetry={retry}
                onDiscard={discard}
              />
            ),
          )}
        </AnimatePresence>
      </ol>
    )
  }

  return (
    <Card className={className + ' flex min-h-0 flex-col overflow-hidden'} aria-label={`#${channel.name}`}>
      <ThreadHeader channel={channel} event={event} clubId={clubId} query={query} />
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="absolute inset-0 overflow-y-auto px-2" aria-live="polite" aria-relevant="additions">
          {body}
        </div>
        <AnimatePresence>
          {unseen > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={settle}
              onClick={() => {
                setUnseen(0)
                toBottom(true)
              }}
              className="absolute bottom-3 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-copper px-3.5 text-[12.5px] font-semibold text-ink-950 hover:bg-copper-soft"
            >
              <ArrowDown className="size-3.5" aria-hidden />
              {unseen} new {unseen === 1 ? 'message' : 'messages'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <Composer key={channel.id} channelName={channel.name} onSend={send} disabled={query.isPending} />
    </Card>
  )
}
