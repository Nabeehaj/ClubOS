import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, ClipboardCheck, Landmark } from 'lucide-react'
import clsx from 'clsx'
import { useClub } from '@/lib/club'
import { useAuth } from '@/lib/auth'
import { keys } from '@/lib/queryClient'
import { greeting, money, relativeTime, shortDate, time12 } from '@/lib/format'
import { stagger, spring, rise } from '@/lib/motion'
import { Card } from '@/components/ui/Card'
import { CountUp } from '@/components/ui/CountUp'
import { Meter } from '@/components/ui/Meter'
import { ReadinessRing } from '@/components/ui/ReadinessRing'
import { PriorityTag, SimulatedBadge, StatusPill } from '@/components/ui/Badges'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'

const moneyFmt = (n) => money(n)

function SectionTitle({ children, action, note }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-4">
      <h2 className="text-[14px] font-semibold text-fg">
        {children}
        {note && <span className="ml-2 font-normal text-faint">{note}</span>}
      </h2>
      {action}
    </div>
  )
}

function TextLink({ to, children }) {
  return (
    <Link to={to} className="text-[12.5px] text-muted underline-offset-4 transition-colors hover:text-fg hover:underline">
      {children}
    </Link>
  )
}

// ---------- the headline: what matters most right now ----------
const PART_LABEL = { tasks: 'Tasks', reservation: '25Live room', approval: 'SB Engaged', finance: 'NXT funding' }

function blockers(event) {
  return (event?.readiness?.parts ?? [])
    .filter((p) => p.ratio < 1)
    .map((p) => (p.key === 'tasks' ? `${event.task_progress.total - event.task_progress.completed} open tasks` : `${PART_LABEL[p.key] ?? p.label} ${String(p.status).toLowerCase()}`))
}

function Headline({ name, event }) {
  const open = blockers(event)
  return (
    <motion.div variants={rise} className="mb-6">
      <p className="text-[13.5px] text-muted">{greeting()}, {name}.</p>
      {event ? (
        <>
          <h2 className="font-display mt-1 max-w-[30ch] text-[30px] font-semibold leading-[1.15] text-fg">
            {event.name} is {event.days_until === 0 ? 'today' : `${event.days_until} days out`} and{' '}
            <span className="tabular">{event.readiness?.score ?? 0}%</span> ready.
          </h2>
          {open.length > 0 && <p className="mt-2 text-[14px] text-muted">Still open: {open.join(', ')}.</p>}
        </>
      ) : (
        <h2 className="font-display mt-1 text-[30px] font-semibold text-fg">No events on the calendar yet.</h2>
      )}
    </motion.div>
  )
}

// ---------- next event ----------
function NextEvent({ event, clubId }) {
  const parts = event.readiness?.parts ?? []
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-6 p-5">
        <ReadinessRing score={event.readiness?.score ?? 0} />
        <div className="min-w-[240px] flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-faint">Next event</span>
            <StatusPill status={event.status} />
          </div>
          <h3 className="font-display mt-1 text-[22px] font-semibold text-fg">{event.name}</h3>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-faint">When</dt>
            <dd className="text-muted">
              {new Date(`${event.date}T00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })},{' '}
              {time12(event.start_time)} to {time12(event.end_time)}
            </dd>
            <dt className="text-faint">Where</dt>
            <dd className="text-muted">{event.location}</dd>
            {event.lead && (
              <>
                <dt className="text-faint">Lead</dt>
                <dd className="text-muted">{event.lead.name}</dd>
              </>
            )}
          </dl>
        </div>
        <Link to={`/c/${clubId}/events/${event.id}`}>
          <Button tabIndex={-1}>Open workspace</Button>
        </Link>
      </div>
      {/* The readiness formula, made visible: each part is a column with its own gauge */}
      <div className="grid grid-cols-2 border-t border-line md:grid-cols-4">
        {parts.map((p, i) => (
          <div key={p.key} className={clsx('px-5 py-3.5', i > 0 && 'md:border-l md:border-line', i % 2 === 1 && 'border-l border-line')}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] text-muted">{PART_LABEL[p.key] ?? p.label}</span>
              <span className="text-[11.5px] text-faint">{p.weight}%</span>
            </div>
            <div className="mt-0.5 text-[13.5px] text-fg">{p.status}</div>
            <Meter className="mt-2" value={p.ratio * 100} tone={p.ratio >= 1 ? 'energy' : 'copper'} label={`${p.label}: ${p.status}`} />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------- club at a glance: one instrument strip ----------
function Glance({ stats }) {
  const cells = [
    { label: 'Demo board', value: stats.board_members, sub: 'Fictional sample accounts' },
    { label: 'Open tasks', value: stats.open_tasks, sub: stats.overdue_tasks ? `${stats.overdue_tasks} overdue` : `${stats.completed_tasks} done` },
    { label: 'Demo budget left', value: stats.budget_remaining, format: moneyFmt, sub: `${money(stats.budget_spent)} of ${money(stats.budget_total)} simulated`, meter: stats.budget_percent_used },
    { label: 'Waiting on the university', value: stats.pending_approvals, sub: '25Live, SB Engaged, NXT' },
    { label: 'Upcoming events', value: stats.upcoming_events, sub: 'This semester' },
  ]
  return (
    <Card className="grid grid-cols-2 md:grid-cols-5">
      {cells.map((c, i) => (
        <div key={c.label} className={clsx('px-5 py-4', i > 0 && 'md:border-l md:border-line', i % 2 === 1 && 'border-l border-line', i >= 2 && 'border-t border-line md:border-t-0')}>
          <div className="text-[12.5px] text-muted">{c.label}</div>
          <div className="font-display tabular mt-1 text-[24px] font-semibold leading-none text-fg">
            <CountUp value={c.value} format={c.format} duration={0.8} />
          </div>
          {c.meter !== undefined ? (
            <Meter className="mt-2.5" value={c.meter} tone="budget" height={3} label={`${c.meter}% of budget used`} />
          ) : null}
          <div className="mt-1.5 text-[12px] text-faint">{c.sub}</div>
        </div>
      ))}
    </Card>
  )
}

// ---------- upcoming events: a table ----------
function Upcoming({ events, clubId }) {
  return (
    <Card className="lg:col-span-3">
      <SectionTitle action={<TextLink to={`/c/${clubId}/events`}>All events</TextLink>}>Coming up</SectionTitle>
      {events.length === 0 ? (
        <EmptyState title="Nothing else scheduled" hint="Create an event from the Events screen." />
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-faint">
              <th className="py-2 pl-5 font-normal">Date</th>
              <th className="py-2 font-normal">Event</th>
              <th className="py-2 text-right font-normal">Tasks</th>
              <th className="w-[160px] py-2 pl-6 pr-5 font-normal">Readiness</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="group border-t border-line">
                <td className="tabular whitespace-nowrap py-3 pl-5 text-muted">{shortDate(e.date)}</td>
                <td className="py-3">
                  <Link to={`/c/${clubId}/events/${e.id}`} className="text-fg underline-offset-4 group-hover:underline">
                    {e.name}
                  </Link>
                  <div className="text-[12px] text-faint">{e.location}</div>
                </td>
                <td className="tabular py-3 text-right text-muted">
                  {e.task_progress?.completed ?? 0}/{e.task_progress?.total ?? 0}
                </td>
                <td className="py-3 pl-6 pr-5">
                  <div className="flex items-center gap-3">
                    <Meter value={e.readiness?.score ?? 0} label={`${e.name} readiness`} />
                    <span className="tabular w-9 text-right text-muted">{e.readiness?.score ?? 0}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ---------- waiting on the university ----------
const SYSTEM = {
  '25live': { label: '25Live', icon: Building2 },
  sb_engaged: { label: 'SB Engaged', icon: ClipboardCheck },
  nxt: { label: 'NXT', icon: Landmark },
}

function Waiting({ items, clubId }) {
  return (
    <Card className="lg:col-span-2">
      <SectionTitle action={<SimulatedBadge />}>Waiting on the university</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon={Check} title="Nothing waiting" hint="Every request has been approved." />
      ) : (
        <ul className="max-h-[296px] overflow-y-auto">
          {items.map((a) => {
            const s = SYSTEM[a.type] ?? { label: a.type, icon: Building2 }
            const Icon = s.icon
            return (
              <li key={`${a.type}-${a.id}`} className="border-t border-line">
                <Link to={`/c/${clubId}/approvals`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-ink-850">
                  <Icon className="size-4 shrink-0 text-faint" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-fg">{a.type === 'sb_engaged' ? a.event_name : a.label.replace(/^(25Live|NXT):\s*/, '')}</div>
                    <div className="text-[12px] text-faint">
                      {s.label}
                      {a.deadline && <span className="ml-2">due {shortDate(a.deadline)}</span>}
                    </div>
                  </div>
                  <StatusPill status={a.status} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// ---------- tasks ----------
function TaskRow({ task, onToggle }) {
  const done = task.status === 'Completed'
  return (
    <motion.li layout exit={{ opacity: 0, height: 0 }} transition={spring} className="border-t border-line">
      <div className="flex items-start gap-3 px-5 py-2.5">
        <button
          onClick={() => onToggle(task)}
          role="checkbox"
          aria-checked={done}
          aria-label={`Mark "${task.title}" as ${done ? 'not done' : 'done'}`}
          className={clsx(
            'mt-[3px] grid size-4 shrink-0 place-items-center rounded border transition-colors',
            done ? 'border-copper bg-copper text-ink-950' : 'border-line-strong hover:border-muted',
          )}
        >
          {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={clsx('text-[13.5px] transition-colors', done ? 'text-faint line-through' : 'text-fg')}>{task.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-faint">
            {task.assignee && <span>{task.assignee.name}</span>}
            {task.due_date && <span className={task.is_overdue ? 'text-bad' : ''}>Due {shortDate(task.due_date)}</span>}
            {task.event_name && <span className="truncate">{task.event_name}</span>}
          </div>
        </div>
        <PriorityTag priority={task.priority} />
      </div>
    </motion.li>
  )
}

function Tasks({ myTasks, pendingTasks, clubId, api }) {
  const qc = useQueryClient()
  const [view, setView] = useState(myTasks.length ? 'mine' : 'all')
  const list = view === 'mine' ? myTasks : pendingTasks

  const toggle = useMutation({
    mutationFn: (task) => api.tasks.update(task.id, { status: task.status === 'Completed' ? 'To Do' : 'Completed' }),
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: keys.dashboard(clubId) })
      const prev = qc.getQueryData(keys.dashboard(clubId))
      const flip = (l) => l?.map((t) => (t.id === task.id ? { ...t, status: t.status === 'Completed' ? 'To Do' : 'Completed' } : t))
      qc.setQueryData(keys.dashboard(clubId), (d) => d && { ...d, my_tasks: flip(d.my_tasks), pending_tasks: flip(d.pending_tasks) })
      return { prev }
    },
    onError: (err, _t, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.dashboard(clubId), ctx.prev)
      toast.error(err)
    },
    // Leave the tick visible for a beat before the refetch moves the task out of the list.
    onSettled: () => setTimeout(() => qc.invalidateQueries({ queryKey: keys.club(clubId) }), 600),
  })

  const views = [
    { id: 'mine', label: 'Yours', count: myTasks.length },
    { id: 'all', label: 'Everyone', count: pendingTasks.length },
  ]

  return (
    <Card className="flex flex-col">
      <SectionTitle
        action={
          <div className="flex rounded-md border border-line p-0.5" role="tablist" aria-label="Whose tasks">
            {views.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={clsx(
                  'rounded px-2 py-0.5 text-[12px] transition-colors',
                  view === v.id ? 'bg-ink-700 text-fg' : 'text-faint hover:text-fg',
                )}
              >
                {v.label} <span className="tabular text-faint">{v.count}</span>
              </button>
            ))}
          </div>
        }
      >
        Open tasks
      </SectionTitle>
      {list.length === 0 ? (
        <EmptyState icon={Check} title="Nothing open" hint="New tasks assigned to you will show up here." />
      ) : (
        <ul className="max-h-[320px] flex-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {list.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle.mutate} />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <div className="border-t border-line px-5 py-2.5">
        <TextLink to={`/c/${clubId}/tasks`}>Open the task board</TextLink>
      </div>
    </Card>
  )
}

// ---------- budget ----------
function Budget({ categories, clubId }) {
  return (
    <Card>
      <SectionTitle action={<TextLink to={`/c/${clubId}/finance`}>Finance</TextLink>}>Budget by category</SectionTitle>
      {categories.length === 0 ? (
        <EmptyState title="No budget set up" />
      ) : (
        <ul className="space-y-3.5 px-5 pb-5 pt-1">
          {categories.map((c) => (
            <li key={c.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                <span className="text-fg">{c.name}</span>
                <span className="tabular text-faint">
                  <span className="text-muted">{money(c.spent)}</span> of {money(c.planned)}
                </span>
              </div>
              <Meter value={c.spent} max={c.planned} tone="budget" label={`${c.name}: ${c.percent_used}% used`} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ---------- activity ----------
function Activity({ items }) {
  return (
    <Card>
      <SectionTitle>Recent activity</SectionTitle>
      {items.length === 0 ? (
        <EmptyState title="Quiet so far" hint="Changes your board makes show up here." />
      ) : (
        <ol className="max-h-[360px] overflow-y-auto">
          <AnimatePresence initial={false}>
            {items.map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, backgroundColor: 'rgba(208,116,58,0.12)' }}
                animate={{ opacity: 1, backgroundColor: 'rgba(208,116,58,0)' }}
                transition={{ duration: 1.2 }}
                className="flex gap-3 border-t border-line px-5 py-2.5"
              >
                <Avatar user={a.actor} size={24} />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-fg">{a.text}</p>
                  <time className="text-[12px] text-faint" dateTime={a.created_at}>
                    {relativeTime(a.created_at)}
                  </time>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </Card>
  )
}

// ---------- page ----------
function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-9 w-[520px] max-w-full" />
      <Skeleton className="mt-2 h-[188px] w-full rounded-xl" />
      <Skeleton className="h-[92px] w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-line p-5 lg:col-span-3">
          <SkeletonRows rows={4} />
        </div>
        <div className="rounded-xl border border-line p-5 lg:col-span-2">
          <SkeletonRows rows={4} />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { clubId, api } = useClub()
  const { user } = useAuth()
  const q = useQuery({ queryKey: keys.dashboard(clubId), queryFn: api.dashboard })

  if (q.isPending) return <DashboardSkeleton />
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />

  const d = q.data
  const [next, ...later] = d.upcoming_events ?? []
  const firstName = (d.me?.name ?? user?.name ?? '').split(' ')[0]

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-4">
      <Headline name={firstName} event={next} />
      {d.club?.public_facts?.event && <motion.div variants={rise} className="rounded-xl border border-line bg-ink-900 px-5 py-4 text-[13px] text-muted">
        <span className="font-semibold text-fg">From SBCS:</span> {d.club.public_facts.event.name}, {d.club.public_facts.event.dates} at {d.club.public_facts.event.location}.{' '}
        <a href={d.club.public_facts.event.url} target="_blank" rel="noreferrer" className="text-copper underline-offset-4 hover:underline">Official event page ↗</a>
        <p className="mt-2 text-faint">The board, planning tasks, approvals, and finances elsewhere in this workspace are interactive demo scenarios—not SBCS records.</p>
      </motion.div>}
      {next && <NextEvent event={next} clubId={clubId} />}
      <Glance stats={d.stats} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Upcoming events={later} clubId={clubId} />
        <Waiting items={d.approvals_needing_action ?? []} clubId={clubId} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Tasks myTasks={d.my_tasks ?? []} pendingTasks={d.pending_tasks ?? []} clubId={clubId} api={api} />
        <Budget categories={d.budget_by_category ?? []} clubId={clubId} />
        <Activity items={d.recent_activity ?? []} />
      </div>
    </motion.div>
  )
}
