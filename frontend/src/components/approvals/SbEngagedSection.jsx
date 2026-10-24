import { useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { Check, CheckCircle2, ClipboardCheck } from 'lucide-react'
import { Meter } from '@/components/ui/Meter'
import { EmptyState } from '@/components/ui/States'
import { shortDate } from '@/lib/format'
import { spring } from '@/lib/motion'
import { AnimatedStatus, ApprovedFlash, useBecame } from './StatusFx'
import { Stepper } from './Stepper'
import { Deadline, Reference, SimulateButton, SystemHeader } from './parts'
import { blockedReason, isApproved, nextStatus } from './pipelines'
import { useSimulate, useToggleDocument } from './useApprovals'

function DocumentItem({ doc, locked, onToggle }) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={doc.done}
        disabled={locked}
        onClick={onToggle}
        className={clsx(
          'group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
          locked ? 'cursor-default' : 'hover:bg-ink-800',
        )}
      >
        <span
          className={clsx(
            'grid size-[18px] shrink-0 place-items-center rounded ring-1 ring-inset transition-colors',
            doc.done ? 'bg-copper text-ink-950 ring-copper' : 'ring-line-strong group-hover:ring-copper',
          )}
        >
          <AnimatePresence initial={false}>
            {doc.done && (
              <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={spring}>
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className={clsx('min-w-0 flex-1 truncate text-[13px] transition-colors', doc.done ? 'text-muted' : 'text-fg')}>
          {doc.name}
        </span>
      </button>
    </li>
  )
}

export function SbEngagedSection({ record, event, className }) {
  const headingId = useId()
  const simulate = useSimulate('sbe')
  const toggle = useToggleDocument()
  const flash = useBecame(record?.status, isApproved)

  if (!record) {
    return (
      <section aria-labelledby={headingId} className={clsx('p-5', className)}>
        <SystemHeader id={headingId} icon={ClipboardCheck} title="SB Engaged" subtitle="Event registration and approval" />
        <EmptyState icon={ClipboardCheck} title="Not registered in SB Engaged" hint="This event has no SB Engaged registration yet." />
      </section>
    )
  }

  const docs = record.required_documents ?? []
  const done = docs.filter((d) => d.done).length
  const locked = isApproved(record.status)
  const actions = record.pending_actions ?? []

  return (
    <section aria-labelledby={headingId} className={clsx('relative flex flex-col p-5', className)}>
      <ApprovedFlash trigger={flash} />
      <SystemHeader id={headingId} icon={ClipboardCheck} title="SB Engaged" subtitle="Event registration and approval" />

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <AnimatedStatus status={record.status} />
        <Deadline date={record.deadline} status={record.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 text-xs">
        <div>
          <dt className="text-faint">Reference</dt>
          <dd className="mt-0.5">
            <Reference value={record.reference_number} />
          </dd>
        </div>
        <div>
          <dt className="text-faint">Submitted</dt>
          <dd className="mt-0.5 text-[13px] text-fg">{record.submitted_on ? shortDate(record.submitted_on) : <span className="text-faint">Not yet</span>}</dd>
        </div>
      </dl>

      <Stepper kind="sbe" status={record.status} className="mt-5" />

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-[13px] font-semibold text-fg">Required documents</h4>
          <span className="tabular text-xs text-muted">
            {done} of {docs.length} ready
          </span>
        </div>
        <Meter className="mt-2" value={done} max={docs.length || 1} height={4} label={`${done} of ${docs.length} documents ready`} />
        <ul className="-mx-2 mt-2">
          {docs.map((d, i) => (
            <DocumentItem
              key={`${d.name}-${i}`}
              doc={d}
              locked={locked}
              onToggle={() => toggle.mutate({ id: record.id, index: i, eventId: event.id })}
            />
          ))}
        </ul>
        {locked && <p className="mt-1 text-xs text-faint">Approved, so the checklist is locked.</p>}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <h4 className="text-[13px] font-semibold text-fg">Pending actions</h4>
        <AnimatePresence initial={false} mode="popLayout">
          {actions.length === 0 ? (
            <motion.p
              key="none"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
              className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ok"
            >
              <CheckCircle2 className="size-3.5" aria-hidden /> Nothing left to do
            </motion.p>
          ) : (
            <motion.ul key="list" exit={{ opacity: 0, y: -6 }} className="mt-1.5 space-y-1">
              {actions.map((a) => (
                <li key={a} className="flex items-start gap-2 text-[13px] text-muted">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
                  {a}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <SimulateButton
        className="mt-auto pt-5"
        next={nextStatus('sbe', record.status)}
        reason={blockedReason('sbe', record.status)}
        loading={simulate.isPending}
        onClick={() => simulate.mutate({ id: record.id, eventId: event.id, eventName: event.name })}
      />
    </section>
  )
}
