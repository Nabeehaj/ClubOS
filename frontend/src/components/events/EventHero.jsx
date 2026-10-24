import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ArrowDown, ArrowUp, Check, CheckCircle2, ChevronDown, CircleDashed, Clock } from 'lucide-react'
import clsx from 'clsx'
import { daysUntilLabel, longDate, money, timeRange } from '@/lib/format'
import { spring } from '@/lib/motion'
import { Card } from '@/components/ui/Card'
import { ReadinessRing } from '@/components/ui/ReadinessRing'
import { StatusPill } from '@/components/ui/Badges'
import { Avatar } from '@/components/ui/Avatar'
import { toast } from '@/components/ui/Toast'
import { DateBlock } from './DateBlock'
import { EVENT_STATUSES, PART_LABEL } from './eventUtils'
import { useWorkspaceCache } from './useWorkspaceCache'

function StatusMenu({ event, clubId, api }) {
  const cache = useWorkspaceCache(clubId, event.id)
  const update = useMutation({
    mutationFn: (status) => api.events.update(event.id, { status }),
    onMutate: async (status) => {
      const prev = await cache.begin()
      cache.patch((d) => ({ ...d, event: { ...d.event, status } }))
      return { prev }
    },
    onSuccess: (_d, status) => toast(`Event status changed to ${status}`),
    onError: (err, _s, ctx) => {
      cache.rollback(ctx?.prev)
      toast.error(err)
    },
    onSettled: () => cache.refresh(),
  })

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Event status: ${event.status}. Change status`}
          className="group inline-flex items-center gap-1 rounded-full pr-1 transition-colors hover:bg-ink-800"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={event.status}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={spring}
              className="inline-flex"
            >
              <StatusPill status={event.status} />
            </motion.span>
          </AnimatePresence>
          <ChevronDown className="size-3.5 text-faint transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-52 rounded-xl border border-line bg-ink-850 p-1.5 shadow-lg shadow-black/40"
        >
          <DropdownMenu.Label className="px-2.5 pb-1 pt-1 text-xs font-medium text-muted">Set event status</DropdownMenu.Label>
          {EVENT_STATUSES.map((s) => (
            <DropdownMenu.Item
              key={s}
              onSelect={() => s !== event.status && update.mutate(s)}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 outline-none data-[highlighted]:bg-ink-800"
            >
              <StatusPill status={s} />
              {s === event.status && <Check className="size-4 text-copper" aria-label="Current status" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function PartIcon({ ratio }) {
  if (ratio >= 1) return <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
  if (ratio <= 0) return <CircleDashed className="size-4 shrink-0 text-faint" aria-hidden />
  return <Clock className="size-4 shrink-0 text-warn" aria-hidden />
}

// Shows "+5 points" next to the gauge for a few seconds after the score moves.
function ScoreDelta({ score }) {
  const [prev, setPrev] = useState(score)
  const [delta, setDelta] = useState(null)
  if (prev !== score) {
    setDelta({ v: score - prev, k: Date.now() })
    setPrev(score)
  }
  return (
    <AnimatePresence>
      {delta && delta.v !== 0 && (
        <motion.span
          key={delta.k}
          role="status"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={spring}
          onAnimationComplete={() => setTimeout(() => setDelta((d) => (d?.k === delta.k ? null : d)), 2600)}
          className={clsx(
            'tabular inline-flex items-center gap-0.5 text-[12.5px] font-semibold',
            delta.v > 0 ? 'text-ok' : 'text-warn',
          )}
        >
          {delta.v > 0 ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
          {Math.abs(delta.v)} points
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0 px-5 py-3.5">
      <dt className="text-[12px] text-faint">{label}</dt>
      <dd className="mt-1 text-[13.5px] text-fg">{children}</dd>
    </div>
  )
}

export function EventHero({ ws, clubId, api }) {
  const e = ws.event
  const readiness = ws.readiness ?? e.readiness ?? { score: 0, parts: [] }
  const hasDays = typeof e.days_until === 'number'
  const past = hasDays && e.days_until < 0
  const spent = ws.budget?.spent ?? e.spent ?? 0

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 p-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 gap-5">
          <DateBlock date={e.date} size="lg" className="hidden sm:grid" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <StatusMenu event={e} clubId={clubId} api={api} />
              {hasDays && (
                <span className="text-[12.5px] text-muted">
                  {past ? `Took place ${daysUntilLabel(e.days_until)}` : daysUntilLabel(e.days_until)}
                </span>
              )}
            </div>
            <h2 className="font-display mt-2 text-[26px] font-semibold leading-tight text-fg">{e.name}</h2>
            {e.description && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">{e.description}</p>}
          </div>
        </div>

        {/* Readiness: the gauge plus what is still holding it back */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center xl:w-[452px] xl:shrink-0 xl:border-l xl:border-line xl:pl-6">
          <div className="flex flex-col items-center gap-1.5">
            <ReadinessRing score={readiness.score} size={136} stroke={9} />
            <div className="h-5">
              <ScoreDelta score={readiness.score} />
            </div>
          </div>
          <table className="w-full min-w-0 flex-1 text-[12.5px]" aria-label="Readiness breakdown">
            <thead className="sr-only">
              <tr>
                <th>Part</th>
                <th>Status</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {readiness.parts.map((p) => (
                <tr key={p.key} className="border-t border-line first:border-t-0">
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-2 text-fg" title={p.label}>
                      <PartIcon ratio={p.ratio} />
                      {PART_LABEL[p.key] ?? p.label}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-muted">{p.status}</td>
                  <td className="tabular whitespace-nowrap py-2 text-right text-faint">
                    <span className="font-medium text-fg">{Math.round(p.points)}</span> / {p.weight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <dl className="grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-line">
        <Fact label="When">
          <div>{longDate(e.date)}</div>
          {e.start_time && <div className="text-muted">{timeRange(e.start_time, e.end_time)}</div>}
        </Fact>
        <Fact label="Where">{e.location || <span className="text-faint">Not set yet</span>}</Fact>
        <Fact label="Expected attendance">
          <span className="tabular">{e.expected_attendance ?? 0}</span> people
        </Fact>
        <Fact label="Budget">
          <div className="tabular">{money(e.budget)}</div>
          <div className="tabular text-muted">{money(spent)} spent</div>
        </Fact>
        <Fact label="Event lead">
          {e.lead ? (
            <span className="flex items-center gap-2">
              <Avatar user={e.lead} size={22} />
              <span className="truncate">{e.lead.name}</span>
            </span>
          ) : (
            <span className="text-faint">No lead yet</span>
          )}
        </Fact>
      </dl>
    </Card>
  )
}
