import { useId } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Landmark } from 'lucide-react'
import { SimulatedBadge } from '@/components/ui/Badges'
import { EmptyState } from '@/components/ui/States'
import { useClub } from '@/lib/club'
import { money, shortDate } from '@/lib/format'
import { AnimatedStatus, ApprovedFlash, useBecame } from './StatusFx'
import { Stepper } from './Stepper'
import { Reference, SimulateButton, SystemHeader } from './parts'
import { blockedReason, isApproved, nextStatus } from './pipelines'
import { useSimulate } from './useApprovals'

function RequestRow({ request, event }) {
  const { canManageFinance } = useClub()
  const simulate = useSimulate('nxt')
  const flash = useBecame(request.status, isApproved)

  return (
    <li className="relative grid gap-x-8 gap-y-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center">
      <ApprovedFlash trigger={flash} />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h4 className="min-w-0 truncate text-[13.5px] font-semibold text-fg">{request.title}</h4>
          <span className="tabular shrink-0 text-[15px] font-semibold text-fg">{money(request.amount, { cents: true })}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint">
          <AnimatedStatus status={request.status} />
          <span>
            Ref <Reference value={request.reference_number} />
          </span>
          {request.submitted_on && <span>Submitted {shortDate(request.submitted_on)}</span>}
          <SimulatedBadge />
        </div>
      </div>
      <div className="min-w-0">
        <Stepper kind="nxt" status={request.status} />
        <SimulateButton
          size="sm"
          className="mt-4"
          next={nextStatus('nxt', request.status)}
          reason={blockedReason('nxt', request.status, { canManageFinance })}
          loading={simulate.isPending}
          onClick={() => simulate.mutate({ id: request.id, eventId: event.id, eventName: event.name })}
        />
      </div>
    </li>
  )
}

export function NxtSection({ requests, event, className }) {
  const headingId = useId()
  const { clubId } = useClub()
  return (
    <section aria-labelledby={headingId} className={clsx('px-5 pt-5', requests.length === 0 && 'pb-5', className)}>
      <header className="flex items-start gap-2.5">
        <Landmark className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <div className="min-w-0">
          <h3 id={headingId} className="font-display text-[15px] font-semibold text-fg">
            NXT financial requests
          </h3>
          <p className="mt-0.5 text-xs text-faint">
            {requests.length > 1 ? 'Readiness counts the least advanced request.' : 'Funding for this event'}
          </p>
        </div>
      </header>
      {requests.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No NXT requests for this event"
          hint="Draft a funding request from Finance and it will show up here."
          action={
            <Link to={`/c/${clubId}/finance`} className="mt-1 text-xs font-medium text-copper hover:underline">
              Open Finance
            </Link>
          }
        />
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {requests.map((r) => (
            <RequestRow key={r.id} request={r} event={event} />
          ))}
        </ul>
      )}
    </section>
  )
}
