import { motion } from 'framer-motion'
import clsx from 'clsx'
import { ShieldCheck } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { CountUp } from '@/components/ui/CountUp'
import { Meter } from '@/components/ui/Meter'
import { SimulatedBadge } from '@/components/ui/Badges'
import { EmptyState } from '@/components/ui/States'
import { shortDate } from '@/lib/format'
import { spring } from '@/lib/motion'
import { AnimatedStatus, DeltaChip } from './StatusFx'
import { isApproved } from './pipelines'

const COLS =
  'grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_176px] lg:items-center'

// NXT can have several requests; readiness (and this cell) follow the least advanced one.
const nxtStatus = (entry) =>
  entry.financial_requests?.length ? entry.readiness?.parts?.find((p) => p.key === 'finance')?.status ?? null : null

function Cell({ label, children }) {
  return (
    <div className="relative min-w-0">
      <span className="mb-1 block text-xs text-faint lg:sr-only">{label}</span>
      {children}
    </div>
  )
}

function Row({ entry, selected, onSelect }) {
  const { event } = entry
  const score = entry.readiness?.score ?? 0
  const fin = entry.financial_requests ?? []
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(event.id)}
        aria-pressed={selected}
        className={clsx(COLS, 'relative w-full px-5 py-3.5 text-left transition-colors', !selected && 'hover:bg-ink-850')}
      >
        {selected && (
          <motion.span layoutId="approvals-row-selected" transition={spring} className="absolute inset-0 bg-ink-800" aria-hidden>
            <span className="absolute inset-y-0 left-0 w-0.5 bg-copper" />
          </motion.span>
        )}
        <div className="relative col-span-2 min-w-0 lg:col-span-1">
          <div className="truncate text-[14px] font-semibold text-fg">{event.name}</div>
          <div className="mt-0.5 flex gap-3 text-xs text-faint">
            <span>{shortDate(event.date)}</span>
            <span className="truncate">{event.status}</span>
          </div>
        </div>
        <Cell label="25Live">
          <AnimatedStatus status={entry.reservation_25live?.status} short celebrate={false} />
        </Cell>
        <Cell label="SB Engaged">
          <AnimatedStatus status={entry.sb_engaged?.status} short celebrate={false} />
        </Cell>
        <Cell label="NXT">
          <span className="inline-flex items-center gap-2">
            <AnimatedStatus status={nxtStatus(entry)} short celebrate={false} />
            {fin.length > 1 && <span className="text-xs text-faint">{fin.length} requests</span>}
          </span>
        </Cell>
        <Cell label="Readiness">
          <div className="relative flex items-center gap-3">
            <Meter value={score} height={4} label={`${event.name} readiness ${score}%`} />
            <span className="tabular relative w-16 shrink-0 text-right text-[14px] font-semibold text-fg">
              <DeltaChip value={score} className="mr-1.5" />
              <CountUp value={score} duration={1.1} />%
            </span>
          </div>
        </Cell>
      </button>
    </li>
  )
}

export function ApprovalsTable({ entries, selectedId, onSelect }) {
  const waiting = entries.reduce((n, e) => {
    const statuses = [e.reservation_25live?.status, e.sb_engaged?.status, ...(e.financial_requests ?? []).map((r) => r.status)]
    return n + statuses.filter((s) => s && !isApproved(s)).length
  }, 0)

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Approvals center"
        icon={ShieldCheck}
        subtitle={
          entries.length === 0
            ? undefined
            : waiting
              ? `${waiting} ${waiting === 1 ? 'item is' : 'items are'} still waiting on the university. Pick an event to work on it.`
              : 'Everything is approved.'
        }
        action={<SimulatedBadge />}
      />
      {entries.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No events yet" hint="Create an event and its 25Live, SB Engaged and NXT paperwork will show up here." />
      ) : (
        <div className="mt-4">
          <div className={clsx(COLS, 'hidden border-y border-line px-5 py-2 text-xs text-faint lg:grid')} aria-hidden>
            <span>Event</span>
            <span>25Live</span>
            <span>SB Engaged</span>
            <span>NXT</span>
            <span className="text-right">Readiness</span>
          </div>
          <ul className="divide-y divide-line border-t border-line lg:border-t-0" aria-label="Events and their approval status">
            {entries.map((e) => (
              <Row key={e.event.id} entry={e} selected={e.event.id === selectedId} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
