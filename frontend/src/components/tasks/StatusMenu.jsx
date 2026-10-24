import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, Ellipsis, Pencil } from 'lucide-react'
import { STATUSES } from './taskModel'

const item =
  'flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-fg outline-none data-[disabled]:text-faint data-[highlighted]:bg-ink-700'

// The non-drag way to move a task: a small menu on each card.
export function StatusMenu({ task, onMove, onEdit }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Actions for ${task.title}`}
          className="relative z-10 grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-ink-700 hover:text-fg data-[state=open]:bg-ink-700 data-[state=open]:text-fg"
        >
          <Ellipsis className="size-4" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={12}
          className="z-50 w-52 rounded-xl border border-line-strong bg-ink-850 p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
        >
          <DropdownMenu.Label className="px-2.5 pb-1 pt-1 text-[12px] font-medium text-muted">Move to</DropdownMenu.Label>
          {STATUSES.map((s) => {
            const current = s.id === task.status
            const Icon = s.icon
            return (
              <DropdownMenu.Item key={s.id} disabled={current} onSelect={() => onMove(s.id)} className={item}>
                <Icon className={`size-4 ${s.tone}`} aria-hidden />
                <span className="flex-1">{s.label}</span>
                {current && <Check className="size-4 text-faint" aria-label="Current status" />}
              </DropdownMenu.Item>
            )
          })}
          <DropdownMenu.Separator className="my-1 border-t border-line" />
          <DropdownMenu.Item onSelect={onEdit} className={item}>
            <Pencil className="size-4 text-muted" aria-hidden />
            Edit details
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
