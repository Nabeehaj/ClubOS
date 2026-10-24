import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, ChevronDown, Plus, UserPlus } from 'lucide-react'
import clsx from 'clsx'
import { shortDate } from '@/lib/format'
import { spring, useQuality } from '@/lib/motion'
import { Card, CardHeader } from '@/components/ui/Card'
import { Meter } from '@/components/ui/Meter'
import { PriorityTag, StatusPill } from '@/components/ui/Badges'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'
import { AssigneePicker } from './AssigneePicker'
import { eventKeys, userBrief, withTasks } from './eventUtils'
import { useWorkspaceCache } from './useWorkspaceCache'

function AssigneeButton({ task, disabled, ...rest }) {
  const name = task.assignee?.name
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={name ? `Assigned to ${name}. Change assignee for “${task.title}”` : `Assign someone to “${task.title}”`}
      className={clsx(
        'group/assignee flex w-[136px] shrink-0 items-center gap-2 rounded-lg border border-transparent py-1 pl-1 pr-2 text-left transition-colors',
        'hover:border-line hover:bg-ink-850 data-[state=open]:border-copper data-[state=open]:bg-ink-850',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
      {...rest}
    >
      <span className="relative grid size-7 shrink-0 place-items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={task.assignee_id ?? 'none'}
            className="grid"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={spring}
          >
            {task.assignee ? (
              <Avatar user={task.assignee} size={26} />
            ) : (
              <span className="grid size-[26px] place-items-center rounded-full border border-dashed border-line-strong text-faint">
                <UserPlus className="size-3.5" aria-hidden />
              </span>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="relative h-4 min-w-0 flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={task.assignee_id ?? 'none'}
            className={clsx('block truncate text-[12.5px] leading-4', name ? 'text-fg' : 'text-faint')}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={spring}
          >
            {name ?? 'Assign'}
          </motion.span>
        </AnimatePresence>
      </span>
      <ChevronDown className="size-3.5 shrink-0 text-faint opacity-0 transition-opacity group-hover/assignee:opacity-100" aria-hidden />
    </button>
  )
}

function TaskRow({ task, members, membersQuery, onToggle, onAssign }) {
  const { quality } = useQuality()
  const done = task.status === 'Completed'
  const temp = String(task.id).startsWith('temp-')

  // When the assignee changes, tint the row briefly so the change is visible (adjust state on prop change).
  const [seen, setSeen] = useState(task.assignee_id)
  const [changed, setChanged] = useState(0)
  if (seen !== task.assignee_id) {
    setSeen(task.assignee_id)
    setChanged((n) => n + 1)
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: temp ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={spring}
      className="relative flex items-center gap-3 border-t border-line px-5 py-2.5 first:border-t-0"
    >
      {changed > 0 && quality !== 'low' && (
        <motion.span
          key={changed}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-copper/10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
        />
      )}

      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={temp}
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark “${task.title}” ${done ? 'not done' : 'done'}`}
        className={clsx(
          'relative grid size-[18px] shrink-0 place-items-center rounded border transition-colors',
          done ? 'border-ok bg-ok text-ink-950' : 'border-line-strong hover:border-copper',
        )}
      >
        <AnimatePresence initial={false}>
          {done && (
            <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring}>
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <div className="relative min-w-0 flex-1">
        <div className={clsx('truncate text-[13.5px] transition-colors', done ? 'text-faint line-through' : 'text-fg')}>
          {task.title}
        </div>
        <div className="mt-0.5 text-[12px] text-faint">
          {!task.due_date ? (
            'No due date'
          ) : task.is_overdue && !done ? (
            <span className="inline-flex items-center gap-1 text-bad">
              <AlertTriangle className="size-3" aria-hidden /> Overdue since {shortDate(task.due_date)}
            </span>
          ) : (
            `Due ${shortDate(task.due_date)}`
          )}
        </div>
      </div>

      <span className="relative hidden w-[70px] justify-end lg:flex">
        <PriorityTag priority={task.priority} />
      </span>
      <span className="relative hidden w-[104px] md:flex">
        <StatusPill status={task.status} />
      </span>

      <AssigneePicker
        members={members}
        membersQuery={membersQuery}
        value={task.assignee}
        onChange={(m) => onAssign({ task, member: m })}
        trigger={<AssigneeButton task={task} disabled={temp} />}
      />
    </motion.li>
  )
}

function QuickAdd({ onAdd, members, membersQuery }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(null)
  const inputRef = useRef(null)

  const submit = (e) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      inputRef.current?.focus()
      return
    }
    onAdd({ title: t, assignee })
    setTitle('')
    setAssignee(null)
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-b border-line px-5 py-3" aria-label="Add a task">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">New task title</span>
        <Plus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Add a task and press Enter"
          className="h-9 w-full rounded-lg border border-line bg-ink-950 pl-9 pr-3 text-[13.5px] text-fg transition-colors placeholder:text-faint hover:border-line-strong focus:border-copper focus:outline-none"
        />
      </label>
      <AssigneePicker
        members={members}
        membersQuery={membersQuery}
        value={assignee}
        onChange={setAssignee}
        trigger={
          <button
            type="button"
            aria-label={assignee ? `New task goes to ${assignee.name}. Change` : 'Choose who the new task goes to'}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line px-2.5 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-fg data-[state=open]:border-copper"
          >
            {assignee ? <Avatar user={assignee} size={20} /> : <UserPlus className="size-4" aria-hidden />}
            <span className="hidden sm:inline">{assignee ? assignee.name.split(' ')[0] : 'Assignee'}</span>
          </button>
        }
      />
      <Button type="submit" size="sm" variant="primary" disabled={!title.trim()} className="h-9">
        Add task
      </Button>
    </form>
  )
}

export function EventTasks({ ws, clubId, eventId, api, className }) {
  const cache = useWorkspaceCache(clubId, eventId)
  // Temp ids from optimistic creates map to the real id, so the row keeps its React key when the server answers.
  const keyMap = useRef({})
  const members = useQuery({ queryKey: eventKeys.members(clubId), queryFn: api.members.list, staleTime: 60_000 })
  const tasks = ws.tasks ?? []
  const done = tasks.filter((t) => t.status === 'Completed').length

  const toggle = useMutation({
    mutationFn: (task) => api.tasks.update(task.id, { status: task.status === 'Completed' ? 'To Do' : 'Completed' }),
    onMutate: async (task) => {
      const prev = await cache.begin()
      const next = task.status === 'Completed' ? 'To Do' : 'Completed'
      cache.patch((d) => withTasks(d, d.tasks.map((t) => (t.id === task.id ? { ...t, status: next } : t))))
      return { prev }
    },
    onError: (err, _t, ctx) => {
      cache.rollback(ctx?.prev)
      toast.error(err)
    },
    onSettled: () => cache.refresh(600),
  })

  const assign = useMutation({
    mutationFn: ({ task, member }) => api.tasks.update(task.id, { assignee_id: member?.id ?? null }),
    onMutate: async ({ task, member }) => {
      const prev = await cache.begin()
      cache.patch((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, assignee_id: member?.id ?? null, assignee: userBrief(member) } : t)),
      }))
      return { prev }
    },
    onSuccess: (_data, { task, member }) =>
      toast(member ? `${member.name} now owns “${task.title}”` : `“${task.title}” is unassigned`),
    onError: (err, _v, ctx) => {
      cache.rollback(ctx?.prev)
      toast.error(err)
    },
    onSettled: () => cache.refresh(800),
  })

  const create = useMutation({
    mutationFn: ({ title, assignee }) =>
      api.tasks.create({ title, event_id: Number(eventId), assignee_id: assignee?.id ?? null }),
    onMutate: async ({ title, assignee }) => {
      const prev = await cache.begin()
      const tempId = `temp-${Date.now()}`
      const draft = {
        id: tempId,
        title,
        status: 'To Do',
        priority: 'Medium',
        due_date: null,
        is_overdue: false,
        assignee_id: assignee?.id ?? null,
        assignee: userBrief(assignee),
      }
      // The server lists undated tasks first, so slot the new one where it will land.
      cache.patch((d) => {
        const at = d.tasks.filter((t) => !t.due_date).length
        return withTasks(d, [...d.tasks.slice(0, at), draft, ...d.tasks.slice(at)])
      })
      return { prev, tempId }
    },
    onSuccess: (task, _v, ctx) => {
      keyMap.current[task.id] = ctx.tempId
      cache.patch((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === ctx.tempId ? task : t)) }))
      toast(task.assignee ? `Added “${task.title}” for ${task.assignee.name}` : `Added “${task.title}”`)
    },
    onError: (err, _v, ctx) => {
      cache.rollback(ctx?.prev)
      toast.error(err)
    },
    onSettled: () => cache.refresh(400),
  })

  return (
    <Card className={clsx('flex flex-col', className)}>
      <CardHeader
        title="Tasks"
        subtitle="Tick a task when it's done. Click a name to reassign it."
        action={
          <Link to={`/c/${clubId}/tasks?event_id=${eventId}`} className="text-[12.5px] font-medium text-muted hover:text-fg">
            Open task board
          </Link>
        }
      />
      <div className="flex items-center gap-3 px-5 pb-3 pt-3">
        <Meter value={done} max={tasks.length || 1} height={4} label={`${done} of ${tasks.length} tasks done`} />
        <span className="tabular shrink-0 text-[12.5px] text-muted">
          <span className="font-semibold text-fg">{done}</span> of {tasks.length} done
        </span>
      </div>

      <div className="border-t border-line">
        <QuickAdd onAdd={create.mutate} members={members.data} membersQuery={members} />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks for this event yet"
          hint="Add the first one above. Finished tasks make up 40% of the readiness score."
        />
      ) : (
        <ul className="max-h-[560px] overflow-y-auto" aria-label="Event tasks">
          <AnimatePresence initial={false}>
            {tasks.map((t) => (
              <TaskRow
                key={keyMap.current[t.id] ?? t.id}
                task={t}
                members={members.data}
                membersQuery={members}
                onToggle={toggle.mutate}
                onAssign={assign.mutate}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}
