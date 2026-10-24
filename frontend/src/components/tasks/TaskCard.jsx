import { useDraggable } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CircleCheck, Clock, GripVertical, TriangleAlert } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityTag } from '@/components/ui/Badges'
import { AssigneePicker } from './AssigneePicker'
import { StatusMenu } from './StatusMenu'
import { dueInfo, firstName } from './taskModel'

const DUE_TONE = { bad: 'text-bad', warn: 'text-warn', muted: 'text-muted', faint: 'text-faint' }
const settle = { type: 'spring', stiffness: 380, damping: 36 }

function DueLabel({ task }) {
  const due = dueInfo(task)
  if (!due) return null
  const Icon = due.overdue ? TriangleAlert : due.tone === 'warn' ? Clock : CalendarDays
  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-1 text-[12px]', DUE_TONE[due.tone], due.overdue && 'font-medium')}>
      <Icon className="size-3.5" aria-hidden />
      {due.text}
    </span>
  )
}

// Card content, shared by the live card and the drag overlay (where it is not interactive).
export function TaskCardBody({ task, interactive = false, members, onOpen, onMove, onAssign, handle }) {
  const done = task.status === 'Completed'
  return (
    <>
      <div className="flex items-start gap-2">
        {done && <CircleCheck className="mt-[3px] size-3.5 shrink-0 text-ok" aria-label="Completed" />}
        <h3 className={clsx('min-w-0 flex-1 text-[13.5px] font-medium leading-snug', done ? 'text-muted' : 'text-fg')}>
          {interactive ? (
            <button
              type="button"
              onClick={onOpen}
              className="text-left after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-copper"
            >
              <span className="line-clamp-2">{task.title}</span>
            </button>
          ) : (
            <span className="line-clamp-2">{task.title}</span>
          )}
        </h3>
        {interactive && (
          <div className="-mr-1.5 -mt-1 flex shrink-0 items-center">
            {handle}
            <StatusMenu task={task} onMove={onMove} onEdit={onOpen} />
          </div>
        )}
      </div>

      {task.event_name && <p className="mt-1 truncate text-[12px] text-faint">{task.event_name}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        {interactive ? (
          <AssigneePicker task={task} members={members} onAssign={onAssign} />
        ) : (
          <span className="flex h-7 items-center gap-1.5 text-[12px] text-muted">
            {task.assignee ? (
              <>
                <Avatar user={task.assignee} size={22} />
                {firstName(task.assignee.name)}
              </>
            ) : (
              'Unassigned'
            )}
          </span>
        )}
        <span className="flex items-center gap-2.5">
          <DueLabel task={task} />
          <PriorityTag priority={task.priority} />
        </span>
      </div>
    </>
  )
}

// One draggable card in a column. The outer <li> owns list motion (enter/leave/reflow); the inner node is what
// dnd-kit measures and hides during the drop animation, so the two never fight over the same styles.
export function TaskCard({ ref, task, members, onOpen, onMove, onAssign, movedId, moveVia, flash, highlighted, delay = 0 }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status, title: task.title },
  })
  const justDropped = movedId === task.id && moveVia === 'drag'

  return (
    <motion.li
      ref={ref}
      layout="position"
      // Shared layout id: a card moved from the menu glides to its new column. Skipped for drag moves,
      // where dnd-kit's drop animation already carried it there.
      layoutId={justDropped ? undefined : `task-${task.id}`}
      custom={movedId}
      variants={{
        hidden: { opacity: 0, y: 6 },
        show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1], delay } },
        exit: (moved) =>
          moved === task.id ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
      }}
      initial={justDropped ? false : 'hidden'}
      animate="show"
      exit="exit"
      transition={settle}
      className="list-none"
    >
      <div
        ref={setNodeRef}
        data-task-card={task.id}
        onPointerDown={listeners?.onPointerDown}
        className={clsx(
          'group relative cursor-grab rounded-lg border px-3 pb-2.5 pt-2.5 transition-colors',
          isDragging
            ? 'border-dashed border-line-strong bg-transparent [&>*]:invisible'
            : 'border-line bg-ink-850 hover:border-line-strong',
        )}
      >
        <TaskCardBody
          task={task}
          interactive
          members={members}
          onOpen={() => onOpen(task)}
          onMove={(status) => onMove(task, status)}
          onAssign={(member) => onAssign(task, member)}
          handle={
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              onKeyDown={listeners?.onKeyDown}
              aria-label={`Move ${task.title} to another column`}
              className="relative z-10 grid size-7 cursor-grab place-items-center rounded-md text-faint opacity-0 transition hover:bg-ink-700 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
          }
        />

        {/* What changed: a copper outline that fades after a move, or pulses for a newly added task. */}
        {flash && !isDragging && (
          <motion.span
            key={flash}
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-lg border border-copper bg-copper/[0.06]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
          />
        )}
        <AnimatePresence>
          {highlighted && (
            <motion.span
              key="pulse"
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-lg border-2 border-copper bg-copper/[0.07]"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.3, 1, 0.3, 1] }}
              exit={{ opacity: 0, transition: { duration: 0.6 } }}
              transition={{ duration: 2.4, ease: 'easeInOut' }}
            />
          )}
          {highlighted && (
            <motion.span
              key="tag"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.6 } }}
              className="absolute -top-2 right-3 rounded bg-copper px-1.5 py-px text-[11px] font-semibold text-ink-950"
            >
              New
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  )
}
