import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ChevronDown, Gauge, RotateCcw, Sparkles, LogOut } from 'lucide-react'
import { NAV, sectionFromPath } from '@/lib/nav'
import { useAuth } from '@/lib/auth'
import { useClub } from '@/lib/club'
import { demo } from '@/lib/api'
import { keys } from '@/lib/queryClient'
import { useQuality } from '@/lib/motion'
import { Avatar } from '@/components/ui/Avatar'
import { toast } from '@/components/ui/Toast'
import { ClubSwitcher } from '@/components/shell/Sidebar'
import { QuickJump } from '@/components/shell/QuickJump'

function AiButton() {
  const { clubId, api } = useClub()
  const status = useQuery({ queryKey: keys.agentStatus(clubId), queryFn: api.agent.status, staleTime: 60_000 })
  const available = status.data?.available === true

  const button = (
    <button
      disabled={!available}
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-ink-850 px-3 text-[13px] text-fg transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-ink-850"
    >
      <Sparkles className="size-3.5 text-copper" aria-hidden />
      Assistant
      {!available && <span className="text-[11.5px] text-faint">Coming soon</span>}
    </button>
  )

  if (available) return button
  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>
        <span tabIndex={0} className="rounded-lg">
          {button}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-[240px] rounded-md border border-line-strong bg-ink-850 px-2.5 py-2 text-[12px] leading-relaxed text-muted"
        >
          The assistant isn&apos;t switched on yet. It will suggest owners for tasks and draft emails.
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

const itemClass =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-fg outline-none data-[highlighted]:bg-ink-700'

function UserMenu() {
  const { user, signOut } = useAuth()
  const qc = useQueryClient()
  const { setting, setQuality } = useQuality()
  const reset = useMutation({
    mutationFn: demo.reset,
    onSuccess: () => {
      qc.invalidateQueries()
      toast('Demo data restored')
    },
    onError: (e) => toast.error(e),
  })

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-ink-850">
          <Avatar user={user} size={26} />
          <span className="hidden text-[13px] text-fg sm:inline">{user?.name}</span>
          <ChevronDown className="size-3.5 text-faint" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-56 rounded-lg border border-line-strong bg-ink-850 p-1 shadow-2xl shadow-black/40"
        >
          <DropdownMenu.Label className="px-2 pb-1.5 pt-1 text-[12px] text-faint">{user?.email}</DropdownMenu.Label>
          <DropdownMenu.Item onSelect={() => reset.mutate()} className={itemClass}>
            <RotateCcw className="size-4 text-faint" aria-hidden />
            Reset demo data
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault()
              setQuality(setting === 'low' ? 'auto' : 'low')
            }}
            className={itemClass}
          >
            <Gauge className="size-4 text-faint" aria-hidden />
            Reduce effects: {setting === 'low' ? 'on' : 'off'}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item onSelect={signOut} className={itemClass}>
            <LogOut className="size-4 text-faint" aria-hidden /> Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function Topbar() {
  const { pathname } = useLocation()
  const { club } = useClub()
  const section = sectionFromPath(pathname)
  const title = NAV.find((n) => n.to === section)?.label ?? 'ClubOS'

  return (
    <header className="app-topbar flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line px-8">
      <div className="min-w-0 flex-1 md:hidden"><ClubSwitcher /></div>
      <div className="hidden min-w-0 items-baseline gap-2 text-[14px] md:flex">
        <span className="truncate text-faint">{club?.name}</span>
        <span className="text-ink-600" aria-hidden>
          /
        </span>
        <h1 className="truncate font-medium text-fg">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <QuickJump />
        <div className="hidden sm:block"><AiButton /></div>
        <UserMenu />
      </div>
    </header>
  )
}
