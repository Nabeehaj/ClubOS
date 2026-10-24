import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { CountUp } from '@/components/ui/CountUp'
import { Meter } from '@/components/ui/Meter'
import { StatusPill } from '@/components/ui/Badges'
import { useClub } from '@/lib/club'
import { longDate } from '@/lib/format'
import { DeltaChip } from './StatusFx'
import { SbEngagedSection } from './SbEngagedSection'
import { ReservationSection } from './ReservationSection'
import { NxtSection } from './NxtSection'

const PART_LABEL = { tasks: 'Tasks', reservation: '25Live', approval: 'SB Engaged', finance: 'NXT funding' }

// Readiness as an instrument: the score, its bar, and the four weighted parts that make it up.
function Readiness({ readiness, eventName }) {
  const score = readiness?.score ?? 0
  const parts = readiness?.parts ?? []
  return (
    <div className="grid gap-x-8 gap-y-4 border-t border-line px-5 py-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-center">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-fg">Readiness</span>
          <span className="flex items-baseline gap-2">
            <DeltaChip value={score} />
            <span className="font-display tabular text-[28px] font-semibold leading-none text-fg">
              <CountUp value={score} duration={1.2} />
              <span className="text-base text-muted">%</span>
            </span>
          </span>
        </div>
        <Meter className="mt-2.5" value={score} height={6} label={`${eventName} readiness ${score}%`} />
      </div>
      <table className="w-full text-[13px]">
        <caption className="sr-only">What readiness is made of</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Part</th>
            <th scope="col">Status</th>
            <th scope="col">Progress</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.key}>
              <th scope="row" className="w-28 py-1 pr-3 text-left font-normal text-muted">
                {PART_LABEL[p.key] ?? p.label}
              </th>
              <td className="w-40 py-1 pr-3 text-faint">{p.status}</td>
              <td className="py-1 pr-4">
                <Meter value={p.ratio * 100} height={3} label={`${p.label}: ${Math.round(p.ratio * 100)}%`} />
              </td>
              <td className="tabular w-20 py-1 text-right text-muted">
                <CountUp value={p.points} duration={1} format={(n) => (Math.round(n * 10) / 10).toString()} />
                <span className="text-faint"> / {p.weight}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EventApprovals({ entry }) {
  const { clubId } = useClub()
  const { event } = entry
  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <h2 className="font-display truncate text-lg font-semibold text-fg">{event.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <span>{longDate(event.date)}</span>
            <StatusPill status={event.status} />
          </div>
        </div>
        <Link
          to={`/c/${clubId}/events/${event.id}`}
          className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-muted ring-1 ring-inset ring-line transition-colors hover:bg-ink-800 hover:text-fg"
        >
          Open event workspace
        </Link>
      </header>

      <Readiness readiness={entry.readiness} eventName={event.name} />

      <div className="grid border-t border-line xl:grid-cols-2">
        <SbEngagedSection record={entry.sb_engaged} event={event} />
        <ReservationSection
          record={entry.reservation_25live}
          event={event}
          className="border-t border-line xl:border-t-0 xl:border-l"
        />
      </div>

      <NxtSection requests={entry.financial_requests ?? []} event={event} className="border-t border-line" />
    </Card>
  )
}
