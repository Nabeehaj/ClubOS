import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { AlertTriangle, ClipboardCheck, ClipboardPlus, Loader2, Pin, RotateCcw, X } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import { botText, clockTime, fullTime, settle } from './chatUtils'

// New rows slide up a few pixels and fade in. No bounce.
const enter = { opacity: 0, y: 6 }
const shown = { opacity: 1, y: 0 }

export function DayDivider({ label }) {
  return (
    <li className="flex items-center gap-3 px-3 pb-2 pt-4" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11.5px] font-medium text-faint">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </li>
  )
}

// System post from ClubOS (is_bot: true), e.g. "Sarah turned a message into a task".
export function BotMessage({ message }) {
  return (
    <motion.li initial={enter} animate={shown} transition={settle} className="px-3 py-1.5">
      <div className="flex items-start gap-3 rounded-lg border border-line bg-ink-850 px-3 py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-900">
          <Pin className="size-4 text-copper" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13px] font-semibold text-fg">ClubOS</span>
            <span className="text-[11.5px] text-faint">System message</span>
            <time className="text-[11.5px] text-faint" dateTime={message.created_at} title={fullTime(message.created_at)}>
              {relativeTime(message.created_at)}
            </time>
          </div>
          <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{botText(message.body)}</p>
        </div>
      </div>
    </motion.li>
  )
}

function MessageRow({ m, first, author, clubId, isDraft, createdTask, onMakeTask, onRetry, onDiscard }) {
  const failed = m.pending === 'failed'
  const sending = m.pending === 'sending'
  const canTask = !m.pending && !m.is_bot && m.id != null
  const snippet = m.body.length > 60 ? `${m.body.slice(0, 57)}...` : m.body

  return (
    <motion.div
      initial={enter}
      animate={shown}
      transition={settle}
      data-msg-row
      className={clsx(
        'group relative flex gap-3 rounded-lg px-3 transition-colors',
        first ? 'pb-1 pt-2' : 'py-1',
        isDraft ? 'bg-copper/[0.07]' : 'hover:bg-white/[0.025] focus-within:bg-white/[0.025]',
      )}
    >
      {isDraft && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-copper" aria-hidden />}
      <div className="w-9 shrink-0">
        {first ? (
          <Avatar user={author} size={36} />
        ) : (
          <time
            dateTime={m.created_at}
            title={fullTime(m.created_at)}
            className="tabular block pt-1 text-right text-[10.5px] text-faint opacity-0 transition-opacity group-hover:opacity-100"
          >
            {clockTime(m.created_at)}
          </time>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {first && (
          <div className="flex items-baseline gap-2">
            <span className="text-[13.5px] font-semibold text-fg">{author?.name ?? 'Unknown member'}</span>
            <time className="text-[11.5px] text-faint" dateTime={m.created_at} title={fullTime(m.created_at)}>
              {relativeTime(m.created_at)}
            </time>
          </div>
        )}
        <p className={clsx('whitespace-pre-wrap break-words text-[14px] leading-relaxed', m.pending ? 'text-muted' : 'text-fg')}>
          {m.body}
        </p>

        {sending && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-faint" role="status">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Sending
          </span>
        )}
        {failed && (
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-bad" role="alert">
            <AlertTriangle className="size-3.5" aria-hidden />
            Not sent. {m.error?.message ?? 'Check your connection and retry.'}
            <button
              type="button"
              onClick={() => onRetry(m.tempKey)}
              className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 font-medium text-fg hover:bg-white/[0.04]"
            >
              <RotateCcw className="size-3" aria-hidden /> Retry
            </button>
            <button
              type="button"
              onClick={() => onDiscard(m.tempKey)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-muted hover:text-fg"
            >
              <X className="size-3" aria-hidden /> Discard
            </button>
          </span>
        )}

        <AnimatePresence>
          {createdTask && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={settle}
              className="mt-1 flex items-center gap-2 text-[12px]"
            >
              <span className="inline-flex items-center gap-1 text-ok">
                <ClipboardCheck className="size-3.5" aria-hidden /> Task created
              </span>
              <Link
                to={`/c/${clubId}/tasks?highlight=${createdTask.id}`}
                className="font-medium text-muted underline decoration-line underline-offset-2 hover:text-fg hover:decoration-current"
              >
                View on board
              </Link>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {canTask && (
        <button
          type="button"
          onClick={(e) => onMakeTask(m, e.currentTarget.closest('[data-msg-row]'))}
          aria-label={`Make a task from ${author?.name ?? 'this'} message: ${snippet}`}
          aria-pressed={isDraft}
          className={clsx(
            'message-task-action absolute -top-3 right-3 z-10 inline-flex h-7 items-center gap-1.5 rounded-md border bg-ink-800 px-2.5 text-[12px] font-medium transition-[opacity,color,border-color]',
            isDraft
              ? 'border-copper/60 text-fg opacity-100'
              : 'border-line text-muted opacity-0 hover:border-copper/60 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100',
          )}
        >
          <ClipboardPlus className="size-3.5 text-copper" aria-hidden />
          {isDraft ? 'In task panel' : 'Make task'}
        </button>
      )}
    </motion.div>
  )
}

export function MessageGroup({ group, clubId, draftId, created, onMakeTask, onRetry, onDiscard }) {
  return (
    <motion.li initial={enter} animate={shown} transition={settle} className="py-0.5">
      <AnimatePresence initial={false}>
        {group.messages.map((m, i) => (
          <MessageRow
            key={m.key}
            m={m}
            first={i === 0}
            author={group.author}
            clubId={clubId}
            isDraft={m.id != null && m.id === draftId}
            createdTask={m.id != null ? created[m.id] : null}
            onMakeTask={onMakeTask}
            onRetry={onRetry}
            onDiscard={onDiscard}
          />
        ))}
      </AnimatePresence>
    </motion.li>
  )
}
