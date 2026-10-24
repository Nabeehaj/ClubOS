import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowUpRight, Command, Search, X } from 'lucide-react'
import { NAV } from '@/lib/nav'
import { useClub } from '@/lib/club'

const SEARCH_TERMS = {
  dashboard: 'home overview',
  events: 'calendar planning',
  tasks: 'board kanban to do',
  chat: 'messages conversation',
  approvals: 'requests 25live sb engaged',
  finance: 'budget expenses nxt',
  vendors: 'suppliers',
  emails: 'drafts generator',
  members: 'people executive board',
}

export function QuickJump() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()
  const { clubId, club } = useClub()

  function changeOpen(nextOpen) {
    setOpen(nextOpen)
    if (!nextOpen) setQuery('')
  }

  useEffect(() => {
    function onShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuery('')
        setOpen((wasOpen) => !wasOpen)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const needle = query.trim().toLowerCase()
  const results = NAV.filter(({ to, label }) =>
    `${label} ${SEARCH_TERMS[to] ?? ''}`.toLowerCase().includes(needle),
  )

  function jump(to) {
    changeOpen(false)
    navigate(`/c/${clubId}/${to}`)
  }

  function onInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      listRef.current?.querySelector('button')?.focus()
    } else if (event.key === 'Enter' && results.length) {
      event.preventDefault()
      jump(results[0].to)
    }
  }

  function onListKeyDown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const index = buttons.indexOf(document.activeElement)
    if (event.key === 'ArrowUp' && index <= 0) inputRef.current?.focus()
    else buttons[Math.min(buttons.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="quickjump-trigger inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-ink-900 px-2.5 text-[12.5px] text-muted hover:border-copper/40 hover:text-fg sm:min-w-[162px] sm:justify-between"
          aria-label="Jump to a page, shortcut Control or Command K"
        >
          <span className="flex items-center gap-2">
            <Search className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Jump to...</span>
          </span>
          <kbd className="hidden rounded border border-line px-1 py-0.5 font-mono text-[10px] text-faint sm:inline">Ctrl K</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="quickjump-overlay fixed inset-0 z-40 bg-[#202824]/45" />
        <Dialog.Content
          className="quickjump-panel fixed left-1/2 top-[min(15vh,130px)] z-50 flex max-h-[min(620px,80vh)] w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-line-strong bg-ink-900 shadow-[0_24px_80px_rgb(32_40_36_/_0.22)] focus:outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <Dialog.Title className="sr-only">Jump to a ClubOS page</Dialog.Title>
          <Dialog.Description className="sr-only">Search sections of the current club, then press Enter to open one.</Dialog.Description>
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Search className="size-[18px] shrink-0 text-copper" aria-hidden />
            <label htmlFor="quickjump-search" className="sr-only">Search ClubOS pages</label>
            <input
              id="quickjump-search"
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Where do you want to go?"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-1 text-[16px] text-fg outline-none placeholder:text-faint"
            />
            <Dialog.Close aria-label="Close quick jump" className="grid size-8 shrink-0 place-items-center rounded-md text-faint hover:bg-ink-800 hover:text-fg">
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="flex items-center justify-between px-4 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.13em] text-faint">
            <span>{needle ? 'Matching pages' : 'Explore ClubOS'}</span>
            <span className="max-w-[50%] truncate">{club?.name}</span>
          </div>
          {results.length ? (
            <ul ref={listRef} onKeyDown={onListKeyDown} className="min-h-0 overflow-y-auto p-2">
              {results.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <button
                    type="button"
                    onClick={() => jump(to)}
                    className="quickjump-result group relative flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] text-fg outline-none hover:bg-ink-850 focus-visible:bg-ink-850"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-ink-900 text-muted group-hover:text-copper group-focus-visible:text-copper">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="flex-1 font-medium">{label}</span>
                    <ArrowUpRight className="quickjump-arrow size-4 text-faint" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="px-5 py-10 text-center text-[13px] text-muted">No page matches “{query}”. Try another word.</p>
          )}
          <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[11px] text-faint">
            <Command className="size-3.5" aria-hidden />
            <span>Type to find a page</span>
            <span className="ml-auto hidden sm:inline">↑ ↓ navigate · Enter open · Esc close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
