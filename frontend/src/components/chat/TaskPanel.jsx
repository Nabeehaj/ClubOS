import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, CheckCircle2, ClipboardPlus, Minus } from 'lucide-react'
import { relativeTime, shortDate } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityTag } from '@/components/ui/Badges'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { settle, suggestTask } from './chatUtils'

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } }

// ---------- source quote (the flight lands here) ----------
const SourceQuote = forwardRef(function SourceQuote({ message, channel, visible }, ref) {
  return (
    <figure
      ref={ref}
      className="rounded-lg border border-line bg-ink-850 p-3 transition-[border-color] duration-500"
      style={{ opacity: visible ? 1 : 0, borderColor: visible ? undefined : 'transparent' }}
    >
      <figcaption className="flex items-center gap-2">
        <Avatar user={message.author} size={22} />
        <span className="truncate text-[12.5px] font-semibold text-fg">{message.author?.name}</span>
        <span className="ml-auto shrink-0 text-[11.5px] text-faint">
          #{channel?.name} {relativeTime(message.created_at)}
        </span>
      </figcaption>
      <blockquote className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-muted">{message.body}</blockquote>
    </figure>
  )
})

// ---------- priority: native radios, so arrow keys work ----------
const PRIORITIES = [
  { value: 'Low', icon: ArrowDown },
  { value: 'Medium', icon: Minus },
  { value: 'High', icon: ArrowUp },
]

function PriorityPicker({ value, onChange, name }) {
  return (
    <div role="radiogroup" aria-label="Priority" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-ink-900 p-1">
      {PRIORITIES.map(({ value: v, icon: Icon }) => {
        const on = value === v
        return (
          <label
            key={v}
            className={clsx(
              'relative flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[12.5px] font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-copper',
              on ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            <input type="radio" name={name} value={v} checked={on} onChange={() => onChange(v)} className="sr-only" />
            {on && <motion.span layoutId={`${name}-on`} transition={settle} className="absolute inset-0 rounded-md border border-copper/60 bg-ink-800" />}
            <Icon className={clsx('relative size-3.5', on && v === 'High' ? 'text-bad' : '')} aria-hidden />
            <span className="relative">{v}</span>
          </label>
        )
      })}
    </div>
  )
}

// One field row. When the flight lands, each row's background briefly tints copper and fades out,
// so you can see which values were filled in for you.
function Filled({ landed, i, children }) {
  return (
    <motion.div
      className="-mx-2 rounded-lg px-2 py-1.5"
      initial={{ backgroundColor: 'rgba(208, 116, 58, 0)', opacity: 0.4 }}
      animate={
        landed
          ? { backgroundColor: ['rgba(208, 116, 58, 0.12)', 'rgba(208, 116, 58, 0)'], opacity: 1 }
          : { opacity: 0.4 }
      }
      transition={{ duration: 0.9, delay: i * 0.05, ease: 'easeOut', opacity: { duration: 0.2, delay: i * 0.04 } }}
    >
      {children}
    </motion.div>
  )
}

// ---------- the form ----------
function TaskForm({ draft, landed, quoteRef, members, events, api, onCreated, onCancel }) {
  const { message, channel } = draft
  const suggestion = useMemo(
    () => suggestTask({ message, channel, members, events }),
    [message, channel, members, events],
  )
  const [edits, setEdits] = useState({})
  const v = { ...suggestion.values, ...edits }
  const set = (k) => (e) => setEdits((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))
  const titleRef = useRef(null)

  // Hand keyboard focus to the title once the values are in.
  useEffect(() => {
    if (landed) titleRef.current?.focus({ preventScroll: true })
  }, [landed])

  const create = useMutation({
    mutationFn: () => {
      const body = { priority: v.priority }
      if (v.title.trim()) body.title = v.title.trim().slice(0, 200)
      if (v.assignee_id) body.assignee_id = Number(v.assignee_id)
      if (v.event_id) body.event_id = Number(v.event_id)
      if (v.due_date) body.due_date = v.due_date
      return api.chat.toTask(message.id, body)
    },
    onSuccess: (task) => onCreated(task, draft),
  })

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (a.id === channel?.event_id ? -1 : b.id === channel?.event_id ? 1 : a.date.localeCompare(b.date))),
    [events, channel?.event_id],
  )
  // The API links the channel's event whenever event_id is empty, so "No event" only exists for unlinked channels.
  const canClearEvent = !channel?.event_id

  return (
    <motion.form
      {...fade}
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate()
      }}
      className="flex min-h-0 flex-1 flex-col"
      aria-label="New task from message"
    >
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-5 pb-4">
        <div className="pb-2">
          <SourceQuote ref={quoteRef} message={message} channel={channel} visible={landed} />
        </div>

        <Filled landed={landed} i={0}>
          <Field label="Title" hint={suggestion.why.title}>
            {(id) => (
              <Input
                id={id}
                ref={titleRef}
                value={v.title}
                maxLength={200}
                onChange={set('title')}
                placeholder={message.body.slice(0, 120)}
              />
            )}
          </Field>
        </Filled>

        <Filled landed={landed} i={1}>
          <Field label="Assignee" hint={suggestion.why.assignee_id}>
            {(id) => (
              <Select id={id} value={v.assignee_id} onChange={set('assignee_id')}>
                {members.length === 0 && <option value="">Message author</option>}
                {members.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.name}
                    {m.position ? `, ${m.position}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Filled>

        <Filled landed={landed} i={2}>
          <Field label="Event" hint={suggestion.why.event_id}>
            {(id) => (
              <Select id={id} value={v.event_id} onChange={set('event_id')}>
                {canClearEvent && <option value="">No event</option>}
                {sortedEvents.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.name}, {shortDate(e.date)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Filled>

        <div className="grid grid-cols-1 gap-x-3 2xl:grid-cols-2">
          <Filled landed={landed} i={3}>
            <Field label="Due date" hint={suggestion.why.due_date}>
              {(id) => <Input id={id} type="date" value={v.due_date} onChange={set('due_date')} />}
            </Field>
          </Filled>
          <Filled landed={landed} i={4}>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted" id={`prio-${message.id}`}>
                Priority
              </p>
              <PriorityPicker name={`prio-${message.id}`} value={v.priority} onChange={set('priority')} />
              <p className="mt-1 text-xs text-faint">{suggestion.why.priority}</p>
            </div>
          </Filled>
        </div>
      </div>

      <div className="border-t border-line px-5 py-4">
        {create.isError && <ErrorState compact error={create.error} className="mb-3" />}
        <div className="flex items-center gap-2">
          <Button type="submit" loading={create.isPending} disabled={!landed} className="flex-1">
            Create task
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
          Leave the title empty to use the message text as it is. ClubOS posts a note in #{channel?.name} so the board sees it.
        </p>
      </div>
    </motion.form>
  )
}

// ---------- created ----------
function Created({ result, clubId, onAnother }) {
  const { task, draft } = result
  const headingRef = useRef(null)
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), [])
  const rows = [
    ['Title', <span key="t" className="text-fg">{task.title}</span>],
    [
      'Assignee',
      task.assignee ? (
        <span key="a" className="inline-flex items-center gap-2 text-fg">
          <Avatar user={task.assignee} size={20} />
          {task.assignee.name}
        </span>
      ) : (
        <span key="a" className="text-faint">Unassigned</span>
      ),
    ],
    ['Event', <span key="e" className={task.event_name ? 'text-fg' : 'text-faint'}>{task.event_name ?? 'None'}</span>],
    ['Due', <span key="d" className={clsx('tabular', task.due_date ? 'text-fg' : 'text-faint')}>{task.due_date ? shortDate(task.due_date) : 'No date'}</span>],
    ['Priority', <PriorityTag key="p" priority={task.priority} />],
    ['Status', <span key="s" className="text-fg">{task.status}</span>],
  ]
  return (
    <motion.div {...fade} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5">
      <div className="flex items-start gap-3 rounded-lg border border-ok/30 bg-ok/[0.06] p-3.5">
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={settle}>
          <CheckCircle2 className="size-5 text-ok" aria-hidden />
        </motion.span>
        <div className="min-w-0">
          <h3 ref={headingRef} tabIndex={-1} className="font-display text-[15px] font-semibold text-fg focus:outline-none">
            Task created
          </h3>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
            It&apos;s in the To Do column, and ClubOS posted a note in #{draft.channel?.name}.
          </p>
        </div>
      </div>

      <dl className="mt-4 divide-y divide-line border-y border-line">
        {rows.map(([k, val]) => (
          <div key={k} className="grid grid-cols-[84px_1fr] items-center gap-3 py-2.5 text-[13px]">
            <dt className="text-faint">{k}</dt>
            <dd className="min-w-0 break-words">{val}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center gap-2">
        <Link
          to={`/c/${clubId}/tasks?highlight=${task.id}`}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-copper px-4 text-sm font-medium text-ink-950 transition-colors hover:bg-copper-soft"
        >
          View on board
        </Link>
        <Button variant="secondary" onClick={onAnother}>
          Make another
        </Button>
      </div>
    </motion.div>
  )
}

// ---------- panel ----------
export function TaskPanel({ draft, landed, quoteRef, result, members, events, api, clubId, onCreated, onCancel, onAnother, className }) {
  const mode = result ? 'created' : draft ? 'form' : 'idle'
  return (
    <Card as="aside" aria-label="Make task from message" className={clsx('flex min-h-0 flex-col overflow-hidden', className)}>
      <header className="px-5 pb-3 pt-4">
        <h2 className="font-display text-[15px] font-semibold text-fg">Make task from message</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">Every field is filled in for you. Change anything before you create it.</p>
      </header>
      <AnimatePresence mode="popLayout" initial={false}>
        {mode === 'idle' && (
          <motion.div key="idle" {...fade} className="flex flex-1 items-center">
            <EmptyState
              icon={ClipboardPlus}
              title="Pick a message to turn into a task"
              hint="Hover a message in the thread, or tab to it, and choose Make task."
            />
          </motion.div>
        )}
        {mode === 'form' && (
          <TaskForm
            key={`form-${draft.nonce}`}
            draft={draft}
            landed={landed}
            quoteRef={quoteRef}
            members={members}
            events={events}
            api={api}
            onCreated={onCreated}
            onCancel={onCancel}
          />
        )}
        {mode === 'created' && <Created key={`done-${result.task.id}`} result={result} clubId={clubId} onAnother={onAnother} />}
      </AnimatePresence>
    </Card>
  )
}
