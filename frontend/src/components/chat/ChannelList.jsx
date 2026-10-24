import { motion } from 'framer-motion'
import clsx from 'clsx'
import { CalendarDays, Hash } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { botText } from './chatUtils'

function preview(ch) {
  const m = ch.last_message
  if (!m) return 'No messages yet'
  const who = m.is_bot ? 'ClubOS' : (m.author?.name ?? '').split(' ')[0]
  return `${who}: ${botText(m.body)}`
}

// Vertical list on wide screens; a compact horizontal strip below that.
export function ChannelList({ query, activeId, onSelect, className }) {
  const channels = query.data ?? []
  return (
    <Card as="nav" aria-label="Channels" className={clsx('flex min-h-0 flex-col p-2 2xl:p-3', className)}>
      <div className="hidden items-center justify-between px-2 pb-2 pt-1 2xl:flex">
        <h2 className="font-display text-[15px] font-semibold">Channels</h2>
        {channels.length > 0 && <span className="tabular text-[11px] text-faint">{channels.length}</span>}
      </div>

      {query.isPending ? (
        <div className="flex gap-2 2xl:flex-col" aria-busy="true" aria-label="Loading channels">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32 shrink-0 2xl:h-[52px] 2xl:w-full" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={query.refetch} />
      ) : channels.length === 0 ? (
        <EmptyState icon={Hash} title="No channels yet" hint="Channels your board creates will show up here." />
      ) : (
        <ul className="flex gap-1 overflow-x-auto 2xl:min-h-0 2xl:flex-1 2xl:flex-col 2xl:overflow-y-auto 2xl:overflow-x-visible">
          {channels.map((ch) => {
            const active = String(ch.id) === String(activeId)
            return (
              <li key={ch.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(ch.id)}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'group relative flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors 2xl:py-2.5',
                    active ? 'text-fg' : 'text-muted hover:bg-white/[0.03] hover:text-fg',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="chat-channel-active"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      className="absolute inset-0 rounded-lg bg-white/[0.05]"
                    >
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-copper" />
                    </motion.span>
                  )}
                  <Hash
                    className={clsx('relative mt-0.5 size-4 shrink-0', active ? 'text-copper' : 'text-faint group-hover:text-muted')}
                    aria-hidden
                  />
                  <span className="relative min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={clsx('truncate text-[13.5px]', active ? 'font-semibold' : 'font-medium')}>{ch.name}</span>
                      {ch.event_id && (
                        <CalendarDays className="size-3 shrink-0 text-faint" aria-label="Linked to an event" />
                      )}
                      <span className="tabular ml-auto hidden pl-2 text-[10.5px] text-faint 2xl:inline">
                        {ch.last_message ? relativeTime(ch.last_message.created_at) : ''}
                      </span>
                    </span>
                    <span className="mt-0.5 hidden truncate text-[11.5px] text-faint 2xl:block">{preview(ch)}</span>
                  </span>
                  <span className="sr-only">, {ch.message_count} messages</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
