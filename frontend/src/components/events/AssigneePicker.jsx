import { useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, Search, UserMinus } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/Avatar'
import { ErrorState, Skeleton } from '@/components/ui/States'

// Board-member picker in a popover. `trigger` must be a plain element that can take a ref (a <button>).
// Arrow keys move between people, Enter in the search box picks the first match.
export function AssigneePicker({ trigger, members, membersQuery, value, onChange, allowUnassign = true, align = 'end' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const listRef = useRef(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = members ?? []
    if (!s) return list
    return list.filter((m) => m.name.toLowerCase().includes(s) || (m.position ?? '').toLowerCase().includes(s))
  }, [members, q])

  const pick = (m) => {
    setOpen(false)
    setQ('')
    if ((m?.id ?? null) !== (value?.id ?? null)) onChange(m)
  }

  const moveFocus = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const opts = Array.from(listRef.current?.querySelectorAll('[data-opt]') ?? [])
    if (!opts.length) return
    e.preventDefault()
    const i = opts.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % opts.length : i <= 0 ? opts.length - 1 : i - 1
    opts[next].focus()
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQ('')
      }}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          onKeyDown={moveFocus}
          className="z-50 w-[288px] rounded-xl border border-line bg-ink-850 p-1.5 shadow-lg shadow-black/40"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-muted">Assign to a board member</p>
          <label className="relative mx-1 mb-1 block">
            <span className="sr-only">Search board members</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) {
                  e.preventDefault()
                  pick(filtered[0])
                }
              }}
              placeholder="Name or role…"
              className="h-8 w-full rounded-lg border border-line bg-ink-900 pl-8 pr-2 text-[12.5px] text-fg placeholder:text-faint focus:border-copper focus:outline-none"
            />
          </label>

          <div ref={listRef} className="max-h-[300px] overflow-y-auto">
            {membersQuery?.isPending ? (
              <div className="space-y-1.5 p-1.5" aria-busy="true" aria-label="Loading board members">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : membersQuery?.isError ? (
              <ErrorState compact error={membersQuery.error} onRetry={membersQuery.refetch} className="m-1" />
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-faint">No board member matches “{q}”.</p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((m) => {
                  const current = m.id === value?.id
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        data-opt
                        onClick={() => pick(m)}
                        aria-pressed={current}
                        className={clsx(
                          'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors',
                          'hover:bg-ink-800 focus-visible:bg-ink-800 focus-visible:outline-1 focus-visible:outline-copper',
                          current && 'bg-ink-800',
                        )}
                      >
                        <Avatar user={m} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-fg">{m.name}</span>
                          <span className="block truncate text-[11.5px] text-faint">{m.position}</span>
                        </span>
                        {current ? (
                          <Check className="size-4 shrink-0 text-copper" aria-label="Currently assigned" />
                        ) : (
                          typeof m.open_tasks === 'number' && (
                            <span className="tabular shrink-0 text-[11.5px] text-faint" title="Open tasks right now">
                              {m.open_tasks} open
                            </span>
                          )
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {allowUnassign && value && (
            <>
              <div className="my-1 border-t border-line" />
              <button
                type="button"
                data-opt
                onClick={() => pick(null)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-muted outline-none transition-colors hover:bg-ink-800 hover:text-fg focus-visible:bg-ink-800"
              >
                <UserMinus className="size-4" aria-hidden /> Unassign
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
