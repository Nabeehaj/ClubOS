import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, CheckSquare, GraduationCap, KanbanSquare, Mail } from 'lucide-react'
import clsx from 'clsx'
import { shortDate } from '@/lib/format'
import { rise, stagger } from '@/lib/motion'
import { Dialog } from '@/components/ui/Dialog'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { PriorityTag, StatusPill, Tag } from '@/components/ui/Badges'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'
import { LoadBar } from './LoadBar'
import { LevelTag } from './LevelTag'
import { openOf } from './workload'

const STATUS_ORDER = ['In Progress', 'To Do', 'Completed']

function groupByStatus(tasks = []) {
  const groups = new Map(STATUS_ORDER.map((s) => [s, []]))
  for (const t of tasks) {
    if (!groups.has(t.status)) groups.set(t.status, [])
    groups.get(t.status).push(t)
  }
  // Soonest due first inside each group; tasks without a date go last.
  for (const list of groups.values()) {
    list.sort((a, b) => String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999')))
  }
  return [...groups.entries()].filter(([, list]) => list.length > 0)
}

function TaskRow({ task, href }) {
  const done = task.status === 'Completed'
  const overdue = task.is_overdue && !done
  return (
    <motion.li variants={rise} className="border-t border-line first:border-t-0">
      <Link to={href} className="group block rounded-md px-2 py-2.5 hover:bg-white/[0.03]">
        <p className={clsx('text-[13.5px] font-medium leading-snug group-hover:underline', done ? 'text-faint line-through' : 'text-fg')}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
          {task.due_date && (
            <span className={clsx('tabular inline-flex items-center gap-1', overdue && 'text-bad')}>
              <CalendarDays className="size-3" aria-hidden />
              Due {shortDate(task.due_date)}
            </span>
          )}
          {overdue && (
            <Tag tone="bad">
              <AlertTriangle className="size-3" aria-hidden /> Overdue
            </Tag>
          )}
          {task.event_name && <span className="truncate">{task.event_name}</span>}
          <PriorityTag priority={task.priority} />
        </div>
      </Link>
    </motion.li>
  )
}

export function MemberTasksSheet({ member, open, onOpenChange, clubId, api, level, maxTotal }) {
  const navigate = useNavigate()
  const id = member?.id
  const q = useQuery({
    queryKey: ['club', String(clubId), 'members', String(id)],
    queryFn: () => api.members.get(id),
    enabled: open && id != null,
  })

  // Show the list row instantly; the detail call fills in tasks (and fresher counts).
  const m = { ...member, ...(q.data ?? {}) }
  const boardHref = `/c/${clubId}/tasks?assignee_id=${id}`
  const total = m.task_count ?? 0
  const done = m.tasks_completed ?? 0
  const openCount = member ? openOf(m) : 0
  const groups = groupByStatus(q.data?.tasks)
  const firstName = m.name ? m.name.split(' ')[0] : null

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={m.name ?? 'Board member'}
      description={m.position || 'Board member'}
      footer={
        <Button onClick={() => navigate(boardHref)}>
          <KanbanSquare className="size-4" aria-hidden />
          {firstName ? `Open ${firstName}'s tasks on the board` : 'Open on the task board'}
        </Button>
      }
    >
      {member && (
        <div className="space-y-5">
          {/* profile */}
          <div className="flex items-start gap-4">
            <Avatar user={m} size={48} />
            <dl className="min-w-0 space-y-1 text-[13px]">
              {(m.major || m.class_year) && (
                <div className="flex items-center gap-2 text-muted">
                  <dt>
                    <GraduationCap className="size-3.5 text-faint" aria-hidden />
                    <span className="sr-only">Studies</span>
                  </dt>
                  <dd className="flex min-w-0 gap-2">
                    {m.major && <span className="truncate">{m.major}</span>}
                    {m.class_year && <span className="tabular shrink-0 text-faint">Class of {m.class_year}</span>}
                  </dd>
                </div>
              )}
              {m.email && (
                <div className="flex items-center gap-2">
                  <dt>
                    <Mail className="size-3.5 text-faint" aria-hidden />
                    <span className="sr-only">Email</span>
                  </dt>
                  <dd className="min-w-0">
                    <a href={`mailto:${m.email}`} className="block truncate text-muted underline-offset-4 hover:text-fg hover:underline">
                      {m.email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* load */}
          <div className="border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              {level ? <LevelTag level={level} /> : <span />}
              <span className="tabular text-[13px] text-muted">
                <span className="font-semibold text-fg">{openCount}</span> open, {done} done, {total} total
              </span>
            </div>
            <LoadBar
              done={done}
              open={openCount}
              max={Math.max(maxTotal ?? 1, total)}
              label={`${openCount} open and ${done} done of ${total} tasks`}
            />
          </div>

          {/* tasks */}
          <div className="border-t border-line pt-4">
            {q.isPending ? (
              <SkeletonRows rows={3} />
            ) : q.isError ? (
              <ErrorState error={q.error} onRetry={q.refetch} />
            ) : groups.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="No tasks assigned"
                hint={`${firstName ?? 'They'} has room for a new task. Assign one from the task board.`}
              />
            ) : (
              <div className="space-y-5">
                {groups.map(([status, list]) => (
                  <section key={status} aria-label={`${status}, ${list.length} tasks`}>
                    <div className="mb-1 flex items-center gap-2">
                      <StatusPill status={status} />
                      <span className="tabular text-[12px] text-faint">{list.length}</span>
                    </div>
                    <motion.ul variants={stagger()} initial="hidden" animate="show">
                      {list.map((t) => (
                        <TaskRow key={t.id} task={t} href={boardHref} />
                      ))}
                    </motion.ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
