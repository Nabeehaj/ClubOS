import { useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, UserPlus, UserX } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/Avatar'
import { firstName } from './taskModel'

const swap = { type: 'spring', stiffness: 420, damping: 34 }

// Assignee avatar on a card. Click it to reassign right there; the new avatar scales in when the choice lands.
export function AssigneePicker({ task, members = [], onAssign, disabled }) {
  const [open, setOpen] = useState(false)
  const listRef = useRef(null)
  const assignee = task.assignee

  const choose = (member) => {
    setOpen(false)
    if ((member?.id ?? null) !== (task.assignee_id ?? null)) onAssign(member)
  }

  // Arrow keys move between options; Home/End jump to the ends.
  const onListKeyDown = (e) => {
    const items = [...(listRef.current?.querySelectorAll('[data-option]') ?? [])]
    const i = items.indexOf(document.activeElement)
    let next = null
    if (e.key === 'ArrowDown') next = items[(i + 1) % items.length]
    else if (e.key === 'ArrowUp') next = items[(i - 1 + items.length) % items.length]
    else if (e.key === 'Home') next = items[0]
    else if (e.key === 'End') next = items[items.length - 1]
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={
            assignee ? `Assigned to ${assignee.name}. Change assignee for ${task.title}` : `Assign ${task.title}`
          }
          className="relative z-10 -ml-1 flex h-7 min-w-0 items-center gap-1.5 rounded-md py-0.5 pl-1 pr-2 text-[12px] text-muted transition-colors hover:bg-ink-700 hover:text-fg data-[state=open]:bg-ink-700 data-[state=open]:text-fg disabled:pointer-events-none"
        >
          <span className="relative grid size-[22px] shrink-0 place-items-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={assignee?.id ?? 'none'}
                className="absolute inset-0 grid place-items-center"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.3, opacity: 0 }}
                transition={swap}
              >
                {assignee ? (
                  <Avatar user={assignee} size={22} />
                ) : (
                  <span className="grid size-[22px] place-items-center rounded-full border border-dashed border-line-strong text-faint">
                    <UserPlus className="size-3" aria-hidden />
                  </span>
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={assignee?.id ?? 'none'}
              className="truncate"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.14 }}
            >
              {assignee ? firstName(assignee.name) : 'Assign'}
            </motion.span>
          </AnimatePresence>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            const items = listRef.current?.querySelectorAll('[data-option]')
            const current = listRef.current?.querySelector('[data-option][aria-checked="true"]')
            ;(current ?? items?.[0])?.focus()
          }}
          className="z-50 w-72 rounded-xl border border-line-strong bg-ink-850 p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
        >
          <p id={`assign-label-${task.id}`} className="px-2.5 pb-1.5 pt-1 text-[12px] font-medium text-muted">
            Assign to a board member
          </p>
          <div
            ref={listRef}
            role="radiogroup"
            aria-labelledby={`assign-label-${task.id}`}
            onKeyDown={onListKeyDown}
            className="max-h-[320px] overflow-y-auto"
          >
            {members.map((m) => {
              const selected = m.id === task.assignee_id
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-option
                  onClick={() => choose(m)}
                  className={clsx(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-ink-700 focus-visible:bg-ink-700 focus-visible:outline-none',
                    selected && 'bg-ink-800',
                  )}
                >
                  <Avatar user={m} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fg">{m.name}</span>
                    <span className="block truncate text-[11.5px] text-faint">{m.position}</span>
                  </span>
                  <span className="tabular shrink-0 text-right text-[11.5px] text-faint">
                    {m.open_tasks ?? 0} open
                  </span>
                  <span className="grid w-4 shrink-0 place-items-center">
                    {selected && <Check className="size-4 text-copper" aria-hidden />}
                  </span>
                </button>
              )
            })}
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              role="radio"
              aria-checked={!task.assignee_id}
              data-option
              onClick={() => choose(null)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-ink-700 hover:text-fg focus-visible:bg-ink-700 focus-visible:outline-none"
            >
              <span className="grid size-7 place-items-center rounded-full border border-dashed border-line-strong">
                <UserX className="size-3.5" aria-hidden />
              </span>
              <span className="flex-1">Unassigned</span>
              <span className="grid w-4 place-items-center">
                {!task.assignee_id && <Check className="size-4 text-copper" aria-hidden />}
              </span>
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
