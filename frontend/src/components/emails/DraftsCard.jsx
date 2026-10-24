import { useEffect, useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { FileText, Mail, PencilLine, Trash2 } from 'lucide-react'
import { spring } from '@/lib/motion'
import { relativeTime, shortDate } from '@/lib/format'
import { Card, CardHeader } from '@/components/ui/Card'
import { Select } from '@/components/ui/Field'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'
import { TEMPLATE_META } from './PickCard'

function DeleteButton({ draft, onDelete }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return undefined
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      type="button"
      onClick={() => (armed ? onDelete(draft) : setArmed(true))}
      onBlur={() => setArmed(false)}
      aria-label={armed ? `Confirm deleting draft "${draft.subject}"` : `Delete draft "${draft.subject}"`}
      className={clsx(
        'inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors',
        armed ? 'bg-bad/15 text-bad ring-1 ring-inset ring-bad/40' : 'text-faint hover:bg-ink-800 hover:text-fg',
      )}
    >
      <Trash2 className="size-3.5" aria-hidden />
      {armed && 'Delete?'}
    </button>
  )
}

function DraftRow({ draft, eventName, active, onOpen, onDelete }) {
  const Icon = TEMPLATE_META[draft.template]?.icon ?? Mail
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      transition={spring}
      className="relative overflow-hidden"
    >
      {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-copper" aria-hidden />}
      <div className={clsx('flex items-start gap-3 px-5 py-3', active && 'bg-ink-850')}>
        <Icon className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-fg" title={draft.subject}>
            {draft.subject}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-faint">
            {eventName && <span className="truncate">{eventName}</span>}
            <span className="max-w-[220px] truncate" title={draft.to}>
              {draft.to ? `To ${draft.to}` : 'No recipient yet'}
            </span>
            <time dateTime={draft.created_at}>{relativeTime(draft.created_at)}</time>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(draft)}
            aria-label={`Open draft "${draft.subject}" in the editor`}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-ink-800 hover:text-fg"
          >
            <PencilLine className="size-3.5" aria-hidden />
            Open
          </button>
          <DeleteButton draft={draft} onDelete={onDelete} />
        </div>
      </div>
    </motion.li>
  )
}

export function DraftsCard({ draftsQ, events, filter, setFilter, activeDraftId, onOpen, onDelete, className }) {
  const filterId = useId()
  const eventName = (id) => events.find((e) => e.id === id)?.name
  const drafts = draftsQ.data ?? []
  const filteredEvent = events.find((e) => String(e.id) === String(filter))

  return (
    <Card className={clsx('pb-2', className)} spotlight={false}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <FileText className="size-4 text-faint" aria-hidden />
            Saved drafts
            {draftsQ.isSuccess && <span className="tabular text-[13px] font-normal text-faint">{drafts.length}</span>}
          </span>
        }
      />
      <div className="mt-3 px-5">
        <label htmlFor={filterId} className="sr-only">
          Show drafts for
        </label>
        <Select id={filterId} value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 text-[13px]">
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}, {shortDate(e.date)}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-3 border-t border-line">
        {draftsQ.isPending ? (
          <SkeletonRows rows={3} className="p-5" />
        ) : draftsQ.isError ? (
          <ErrorState error={draftsQ.error} onRetry={draftsQ.refetch} className="m-5" />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filteredEvent ? `No drafts for ${filteredEvent.name}` : 'No drafts yet'}
            hint="Generate an email and press Save draft. It will wait here until you are ready to send it."
          />
        ) : (
          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
            <AnimatePresence initial={false}>
              {drafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  eventName={d.event_id ? eventName(d.event_id) : null}
                  active={d.id === activeDraftId}
                  onOpen={onOpen}
                  onDelete={onDelete}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Card>
  )
}
