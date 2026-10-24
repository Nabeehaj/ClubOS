import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronsUpDown, LogOut } from 'lucide-react'
import clsx from 'clsx'
import { NAV, sectionFromPath } from '@/lib/nav'
import { useAuth } from '@/lib/auth'
import { useClub } from '@/lib/club'
import { LogoMark, Wordmark } from '@/components/Logo'
import { spring } from '@/lib/motion'

function ClubBadge({ club, size = 28 }) {
  const letters = (club?.name ?? '?')
    .replace(/^SBU\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <span
      className="grid shrink-0 place-items-center rounded-md text-[11px] font-semibold text-ink-950"
      style={{ width: size, height: size, background: club?.accent_color ?? '#a3a39c' }}
      aria-hidden
    >
      {letters}
    </span>
  )
}

export function ClubSwitcher() {
  const { clubs = [] } = useAuth()
  const { club } = useClub()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = sectionFromPath(pathname)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-ink-800 data-[state=open]:bg-ink-800"
          aria-label={`Current club: ${club?.name ?? 'none'}. Switch club`}
        >
          <ClubBadge club={club} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-fg">{club?.name ?? 'Select a club'}</span>
            <span className="block truncate text-[11.5px] text-faint">Demo · {club?.position}</span>
          </span>
          <ChevronsUpDown className="size-3.5 text-faint" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[248px] rounded-lg border border-line-strong bg-ink-850 p-1 shadow-2xl shadow-black/40 data-[state=open]:animate-[pop-in_0.16s_ease-out]"
        >
          <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-[11.5px] text-faint">Demo workspace</DropdownMenu.Label>
          {clubs.map((c) => (
            <DropdownMenu.Item
              key={c.id}
              onSelect={() => navigate(`/c/${c.id}/${section}`)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-ink-700"
            >
              <ClubBadge club={c} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-fg">{c.name}</span>
                <span className="block truncate text-[11.5px] text-faint">Demo · {c.position}</span>
              </span>
              {String(c.id) === String(club?.id) && <Check className="size-4 text-copper" aria-label="Current club" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function Sidebar() {
  const { signOut } = useAuth()
  const { pathname } = useLocation()
  const active = sectionFromPath(pathname)

  return (
    <aside className="app-sidebar flex w-[238px] shrink-0 flex-col border-r border-line px-3 py-4">
      <div className="sidebar-brand flex items-center gap-2 px-2 pb-5">
        <LogoMark size={22} />
        <Wordmark />
      </div>

      <div className="sidebar-club"><ClubSwitcher /></div>

      <nav className="mt-5 flex-1 space-y-px" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }) => {
          const isActive = active === to
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'app-nav-item relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] transition-colors',
                isActive ? 'text-fg' : 'text-muted hover:bg-ink-850 hover:text-fg',
              )}
            >
              {isActive && (
                <motion.span layoutId="nav-active" className="absolute inset-0 rounded-md bg-ink-800" transition={spring}>
                </motion.span>
              )}
              <Icon className={clsx('relative size-4', isActive ? 'text-copper' : 'text-faint')} aria-hidden />
              <span className="relative">{label}</span>
            </NavLink>
          )
        })}
      </nav>

      <button
        onClick={signOut}
        className="sidebar-footer flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-faint transition-colors hover:bg-ink-850 hover:text-fg"
      >
        <LogOut className="size-4" aria-hidden /> Log out
      </button>
    </aside>
  )
}
