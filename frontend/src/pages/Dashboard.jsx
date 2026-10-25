import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Building2, CalendarDays, Check, ClipboardCheck, Landmark, MapPin, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { useClub } from '@/lib/club'
import { useAuth } from '@/lib/auth'
import { keys } from '@/lib/queryClient'
import { daysUntilLabel, money, parseDate, relativeTime, shortDate, timeRange } from '@/lib/format'
import { stagger, spring } from '@/lib/motion'
import { Card } from '@/components/ui/Card'
import { CountUp } from '@/components/ui/CountUp'
import { Meter } from '@/components/ui/Meter'
import { ReadinessRing } from '@/components/ui/ReadinessRing'
import { PriorityTag, SimulatedBadge, StatusPill } from '@/components/ui/Badges'
import { Avatar } from '@/components/ui/Avatar'
import { DailyBrief, FocusQueue } from '@/components/dashboard/DailyBrief'
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'

const moneyFmt = (n) => money(n)

function SectionTitle({ children, action, note }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
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
    <Link to={to} className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded text-[12.5px] font-medium text-muted underline-offset-4 transition-colors hover:text-fg hover:underline">
      {children} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  )
}

// ---------- the headline: what matters most right now ----------
const PART_LABEL = { tasks: 'Tasks', reservation: '25Live room', approval: 'SB Engaged', finance: 'NXT funding' }

// ---------- next event ----------
function NextEvent({ event, clubId }) {
  if (!event) return (
    <Card className="lg:col-span-2">
      <EmptyState icon={CalendarDays} title="Room for the next good idea" hint="Your next event will appear here with its tasks, approvals, and readiness in one place." className="h-full min-h-64" action={<TextLink to={`/c/${clubId}/events`}>Plan an event</TextLink>} />
    </Card>
  )
  const parts = event.readiness?.parts ?? []
  const date = parseDate(event.date)
  return (
    <Card className="flex flex-col lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5">
        <h2 className="text-[12.5px] font-medium text-muted">Next on the calendar</h2>
        <span className="text-[12px] font-medium text-copper">{daysUntilLabel(event.days_until)}</span>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-5 px-5 pb-5 pt-4">
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={event.status} />
            <span className="text-[11.5px] text-faint">Demo planning</span>
          </div>
          <h3 className="font-display mt-2 text-[24px] font-semibold leading-tight text-fg sm:text-[27px]">{event.name}</h3>
          <div className="mt-3 space-y-1.5 text-[12.5px] text-muted">
            <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden /><span>{date?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) ?? 'Date to be confirmed'}{event.start_time && ` · ${timeRange(event.start_time, event.end_time)}`}</span></p>
            <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden /><span>{event.location || 'Location to be confirmed'}</span></p>
          </div>
          <Link to={`/c/${clubId}/events/${event.id}`} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-copper px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-copper-soft">
            Open event workspace <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <div className="text-center"><ReadinessRing score={event.readiness?.score ?? 0} size={112} />{event.lead && <p className="mt-2 max-w-36 text-[11.5px] text-faint">Led by {event.lead.name}</p>}</div>
      </div>
      {/* The readiness formula, made visible: each part is a column with its own gauge */}
      <div className="grid grid-cols-2 border-t border-line md:grid-cols-4">
        {parts.map((p, i) => (
          <div key={p.key} className={clsx('min-w-0 px-4 py-3.5', i > 0 && 'md:border-l md:border-line', i % 2 === 1 && 'border-l border-line', i >= 2 && 'border-t border-line md:border-t-0')}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] text-muted">{PART_LABEL[p.key] ?? p.label}</span>
              <span className="text-[11.5px] text-faint" title={`${p.weight}% of the readiness score`}>{p.weight}%</span>
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
function Glance({ stats, clubId }) {
  const cells = [
    { label: 'Open tasks', value: stats.open_tasks, sub: stats.overdue_tasks ? `${stats.overdue_tasks} overdue` : `${stats.completed_tasks} completed`, href: 'tasks', attention: stats.overdue_tasks > 0 },
    { label: 'Requests to follow up', value: stats.pending_approvals, sub: 'Simulated university workflows', href: 'approvals' },
    { label: 'Demo budget remaining', value: stats.budget_remaining, format: moneyFmt, sub: `${money(stats.budget_spent)} of ${money(stats.budget_total)} used`, meter: stats.budget_percent_used, href: 'finance' },
    { label: 'Upcoming events', value: stats.upcoming_events, sub: 'On the planning calendar', href: 'events' },
  ]
  return (
    <Card className="grid grid-cols-2 md:grid-cols-4" aria-label="Workspace at a glance">
      {cells.map((c, i) => (
        <Link to={`/c/${clubId}/${c.href}`} key={c.label} className={clsx('group min-w-0 px-4 py-4 transition-colors hover:bg-ink-850 sm:px-5', i > 0 && 'md:border-l md:border-line', i % 2 === 1 && 'border-l border-line', i >= 2 && 'border-t border-line md:border-t-0')}>
          <div className="flex items-start justify-between gap-2 text-[12px] text-muted">{c.label}<ArrowRight className="mt-0.5 size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden /></div>
          <div className="font-display tabular mt-2 text-[27px] font-semibold leading-none text-fg">
            <CountUp value={c.value} format={c.format} duration={0.8} />
          </div>
          {c.meter !== undefined ? (
            <Meter className="mt-2.5" value={c.meter} tone="budget" height={3} label={`${c.meter}% of budget used`} />
          ) : null}
          <div className={clsx('mt-2 text-[11.5px]', c.attention ? 'text-bad' : 'text-faint')}>{c.sub}</div>
        </Link>
      ))}
    </Card>
  )
}

// ---------- upcoming events: a table ----------
function Upcoming({ events, clubId }) {
  return (
    <Card>
      <SectionTitle action={<TextLink to={`/c/${clubId}/events`}>All events</TextLink>}>Coming up</SectionTitle>
      {events.length === 0 ? (
        <EmptyState title="Nothing else scheduled" hint="Create an event from the Events screen." />
      ) : (
        <ul>
          {events.map((e) => {
            const date = parseDate(e.date)
            return (
              <li key={e.id} className="border-t border-line">
                <Link to={`/c/${clubId}/events/${e.id}`} className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-ink-850">
                  <time dateTime={e.date} aria-label={date?.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-line bg-ink-850 py-1.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-copper">{date?.toLocaleDateString('en-US', { month: 'short' }) ?? 'TBD'}</span>
                    <span className="tabular text-[20px] font-semibold leading-tight text-fg">{date?.getDate() ?? '—'}</span>
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium leading-snug text-fg group-hover:text-copper">{e.name}</p>
                    <p className="mt-0.5 text-[12px] text-faint">{e.location || 'Location to be confirmed'}</p>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11.5px] text-muted">
                      <span>{e.task_progress?.completed ?? 0}/{e.task_progress?.total ?? 0} tasks done</span>
                      <span className="tabular">{e.readiness?.score ?? 0}% ready</span>
                    </div>
                    <Meter className="mt-1.5" height={3} value={e.readiness?.score ?? 0} label={`${e.name} readiness`} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
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
    <Card>
      <SectionTitle action={<SimulatedBadge />}>Requests & approvals</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon={Check} title="Nothing waiting" hint="No requests currently need follow-up." />
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
                    <div className="text-[13px] leading-snug text-fg">{a.type === 'sb_engaged' ? a.event_name : a.label.replace(/^(25Live|NXT):\s*/, '')}</div>
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
      <div className="border-t border-line px-5 py-2"><TextLink to={`/c/${clubId}/approvals`}>Review all requests</TextLink></div>
    </Card>
  )
}

// ---------- tasks ----------
function TaskRow({ task, onToggle, pending, saving }) {
  const done = task.status === 'Completed'
  return (
    <motion.li layout exit={{ opacity: 0, height: 0 }} transition={spring} className="border-t border-line">
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          onClick={() => onToggle(task)}
          disabled={pending}
          aria-busy={saving}
          role="checkbox"
          aria-checked={done}
          aria-label={`Mark "${task.title}" as ${done ? 'not done' : 'done'}`}
          className={clsx(
            'grid size-8 shrink-0 place-items-center rounded-md transition-colors disabled:cursor-wait',
            done ? 'text-ok' : 'text-faint hover:bg-ink-800 hover:text-copper',
          )}
        >
          <span className={clsx('grid size-[18px] place-items-center rounded border', done ? 'border-ok bg-ok/10' : 'border-line-strong')}>
            {saving ? <RefreshCw className="size-3 animate-spin" aria-hidden /> : done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
          </span>
        </button>
        <div className="min-w-0 flex-1 pt-1">
          <div className={clsx('text-[13.5px] transition-colors', done ? 'text-faint line-through' : 'text-fg')}>{task.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-faint">
            {task.assignee && <span>{task.assignee.name}</span>}
            {task.due_date && <span className={task.is_overdue ? 'font-medium text-bad' : ''}>{task.is_overdue ? 'Overdue · ' : 'Due '}{shortDate(task.due_date)}</span>}
            {task.event_name && <span className="truncate">{task.event_name}</span>}
          </div>
        </div>
        <span className="pt-1"><PriorityTag priority={task.priority} /></span>
      </div>
    </motion.li>
  )
}

function Tasks({ myTasks, pendingTasks, clubId, api }) {
  const qc = useQueryClient()
  const [view, setView] = useState(myTasks.length ? 'mine' : 'all')
  const listRef = useRef(null)
  const filterRef = useRef(null)
  const list = view === 'mine' ? myTasks : pendingTasks

  const toggle = useMutation({
    mutationFn: (task) => api.tasks.update(task.id, { status: task.status === 'Completed' ? 'To Do' : 'Completed' }),
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: keys.dashboard(clubId) })
      const prev = qc.getQueryData(keys.dashboard(clubId))
      const flip = (l) => l?.map((t) => (t.id === task.id ? { ...t, status: t.status === 'Completed' ? 'To Do' : 'Completed' } : t))
      qc.setQueryData(keys.dashboard(clubId), (d) => d && { ...d, my_tasks: flip(d.my_tasks), pending_tasks: flip(d.pending_tasks) })
      return { prev, focusTarget: document.activeElement }
    },
    onSuccess: (_data, task) => toast(task.status === 'Completed' ? 'Task reopened' : 'Task completed. Nice work.'),
    onError: (err, _t, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.dashboard(clubId), ctx.prev)
      toast.error(err)
    },
    onSettled: async (_data, _error, _task, ctx) => {
      const hadFocus = document.activeElement === ctx?.focusTarget
      await qc.invalidateQueries({ queryKey: keys.club(clubId) })
      if (hadFocus && !ctx?.focusTarget?.isConnected) {
        (listRef.current?.querySelector('[role="checkbox"]') ?? filterRef.current)?.focus()
      }
    },
  })

  const views = [
    { id: 'mine', label: 'Mine' },
    { id: 'all', label: 'Team' },
  ]

  return (
    <Card className="flex flex-col">
      <SectionTitle
        action={
          <div className="flex rounded-lg border border-line bg-ink-850 p-0.5" role="group" aria-label="Whose tasks to show">
            {views.map((v) => (
              <button
                key={v.id}
                ref={v.id === 'mine' ? filterRef : undefined}
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
                className={clsx(
                  'min-h-8 rounded-md px-3 text-[12px] font-medium transition-colors',
                  view === v.id ? 'bg-ink-900 text-fg shadow-sm' : 'text-faint hover:text-fg',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        }
      >
        Make a little progress
      </SectionTitle>
      {list.length === 0 ? (
        <EmptyState icon={Check} title={view === 'mine' ? 'You’re all caught up' : 'Nothing left on the list'} hint={view === 'mine' ? 'New tasks assigned to you will show up here. Take a look at the team’s list if you want to lend a hand.' : 'Create a task on the board when the next idea takes shape.'} />
      ) : (
        <ul ref={listRef} className="max-h-[360px] flex-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {list.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle.mutate} pending={toggle.isPending} saving={toggle.isPending && toggle.variables?.id === t.id} />
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
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-5">
      <DailyBrief name={firstName} club={d.club} updatedAt={q.dataUpdatedAt} />
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <NextEvent event={next} clubId={clubId} />
        <FocusQueue stats={d.stats} myTasks={d.my_tasks ?? []} clubId={clubId} />
      </div>
      <Glance stats={d.stats} clubId={clubId} />
      <div className="grid gap-4 lg:grid-cols-2">
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
