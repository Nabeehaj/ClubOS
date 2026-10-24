import { useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { Building2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/States'
import { longDate, timeRange } from '@/lib/format'
import { spring } from '@/lib/motion'
import { AnimatedStatus, ApprovedFlash, useBecame } from './StatusFx'
import { Stepper } from './Stepper'
import { Deadline, InfoRow, Reference, SimulateButton, SystemHeader } from './parts'
import { blockedReason, isApproved, nextStatus } from './pipelines'
import { useSimulate } from './useApprovals'

export function ReservationSection({ record, event, className }) {
  const headingId = useId()
  const simulate = useSimulate('25live')
  const flash = useBecame(record?.status, isApproved)

  if (!record) {
    return (
      <section aria-labelledby={headingId} className={clsx('p-5', className)}>
        <SystemHeader id={headingId} icon={Building2} title="25Live reservation" subtitle="Room booking" />
        <EmptyState icon={Building2} title="No room requested" hint="This event has no 25Live reservation yet." />
      </section>
    )
  }

  return (
    <section aria-labelledby={headingId} className={clsx('relative flex flex-col p-5', className)}>
      <ApprovedFlash trigger={flash} />
      <SystemHeader id={headingId} icon={Building2} title="25Live reservation" subtitle={record.space} />

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <AnimatedStatus status={record.status} />
        <Deadline date={record.submit_deadline} status={record.status} label="Submit by" />
      </div>

      <Stepper kind="25live" status={record.status} className="mt-5" />

      <dl className="mt-5 divide-y divide-line border-t border-line">
        <InfoRow label="Space">{record.space}</InfoRow>
        <InfoRow label="Requested date">{longDate(record.requested_date)}</InfoRow>
        <InfoRow label="Time">{timeRange(record.start_time, record.end_time)}</InfoRow>
        <InfoRow label="Capacity">
          <span className="tabular">{record.capacity}</span> <span className="text-muted">people</span>
        </InfoRow>
        <InfoRow label="Confirmation number">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={record.confirmation_number ?? 'none'}
              className="inline-block"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
              transition={spring}
            >
              <Reference value={record.confirmation_number} pending="Issued after approval" />
            </motion.span>
          </AnimatePresence>
        </InfoRow>
        {record.notes && (
          <InfoRow label="Notes">
            <span className="text-muted">{record.notes}</span>
          </InfoRow>
        )}
      </dl>

      <SimulateButton
        className="mt-auto pt-5"
        next={nextStatus('25live', record.status)}
        reason={blockedReason('25live', record.status)}
        loading={simulate.isPending}
        onClick={() => simulate.mutate({ id: record.id, eventId: event.id, eventName: event.name })}
      />
    </section>
  )
}
