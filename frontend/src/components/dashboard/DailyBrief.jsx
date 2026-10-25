import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CheckCircle2, ClipboardCheck, ListChecks } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { greeting, shortDate } from '@/lib/format'

export function DailyBrief({ name, club, updatedAt }) {
  const event = club?.public_facts?.event
  const updateDate = updatedAt ? new Date(updatedAt) : null

  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker mb-2">Your daily brief</p>
          <h1 className="page-title">{greeting()}{name ? `, ${name}` : ''}.</h1>
          <p className="mt-2 text-[14px] text-muted">A little clarity before the next big thing.</p>
        </div>
        <div className="text-[12px] leading-relaxed text-faint sm:text-right">
          {updateDate && <p className="font-medium text-muted">{updateDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>}
          {updateDate && <p>Updated {updateDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>}
        </div>
      </div>
      {event && (
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-xl border border-line bg-ink-900 px-5 py-3.5">
          <div className="min-w-0 flex-1 basis-80">
            <p className="text-[13px] leading-relaxed text-muted">
              <span className="font-semibold text-fg">From SBCS</span>
              <span className="mx-2 text-faint" aria-hidden>·</span>
              {event.name}, {event.dates} at {event.location}.
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-faint">Official event details. Board accounts, planning tasks, approvals, and finances below are simulated.</p>
          </div>
          <a href={event.url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md text-[12.5px] font-medium text-copper underline-offset-4 hover:underline">
            Official event page <ArrowUpRight className="size-3.5" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      )}
    </header>
  )
}

export function FocusQueue({ stats, myTasks, clubId }) {
  const actions = []
  const firstTask = myTasks[0]
  if (stats.overdue_tasks > 0) {
    actions.push({
      id: 'tasks', icon: ListChecks, label: `${stats.overdue_tasks} overdue ${stats.overdue_tasks === 1 ? 'task' : 'tasks'}`,
      description: 'Check in with the team and reset the plan.', href: `/c/${clubId}/tasks`, tone: 'text-bad',
    })
  } else if (firstTask) {
    actions.push({
      id: 'tasks', icon: ListChecks, label: firstTask.title,
      description: firstTask.due_date ? `Your next task · Due ${shortDate(firstTask.due_date)}` : 'Your next task',
      href: `/c/${clubId}/tasks`, tone: 'text-copper',
    })
  } else if (stats.open_tasks > 0) {
    actions.push({
      id: 'tasks', icon: ListChecks, label: `${stats.open_tasks} open ${stats.open_tasks === 1 ? 'task' : 'tasks'}`,
      description: 'See where the team could use a hand.', href: `/c/${clubId}/tasks`, tone: 'text-copper',
    })
  }
  if (stats.pending_approvals > 0) {
    actions.push({
      id: 'approvals', icon: ClipboardCheck, label: `${stats.pending_approvals} ${stats.pending_approvals === 1 ? 'request needs' : 'requests need'} a check`,
      description: 'Review room, event, and funding requests.', href: `/c/${clubId}/approvals`, tone: 'text-warn',
    })
  }

  return (
    <Card className="flex h-full flex-col">
      <div className="px-5 pb-3 pt-5">
        <h2 className="text-[14px] font-semibold text-fg">Start here</h2>
        <p className="mt-1 text-[12.5px] text-faint">A short list to keep things moving.</p>
      </div>
      {actions.length > 0 ? (
        <ul className="flex-1 px-2 pb-2">
          {actions.map(({ id, icon: Icon, label, description, href, tone }) => (
            <li key={id}>
              <Link to={href} className="group flex items-start gap-3 rounded-lg px-3 py-3.5 transition-colors hover:bg-ink-850">
                <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 ${tone}`}><Icon className="size-4" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium leading-snug text-fg">{label}</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-faint">{description}</span>
                </span>
                <ArrowRight className="mt-2 size-3.5 shrink-0 text-faint transition-colors group-hover:text-copper" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col justify-center px-5 pb-6 pt-3">
          <CheckCircle2 className="mb-3 size-6 text-ok" aria-hidden />
          <p className="text-[14px] font-medium text-fg">A little breathing room.</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">No open tasks or requests to follow up on. You’re ready to plan what’s next.</p>
          <Link to={`/c/${clubId}/events`} className="mt-4 inline-flex min-h-9 items-center gap-2 text-[13px] font-medium text-copper">Explore events <ArrowRight className="size-4" aria-hidden /></Link>
        </div>
      )}
      <p className="border-t border-line px-5 py-3 text-[11.5px] text-faint">Based on the current demo workspace</p>
    </Card>
  )
}
