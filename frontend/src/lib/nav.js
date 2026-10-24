import {
  LayoutDashboard,
  CalendarDays,
  KanbanSquare,
  MessagesSquare,
  ShieldCheck,
  Wallet,
  Store,
  Mail,
  Users,
} from 'lucide-react'

// Sidebar order follows the demo path.
export const NAV = [
  { to: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: 'events', label: 'Events', icon: CalendarDays },
  { to: 'tasks', label: 'Tasks', icon: KanbanSquare },
  { to: 'chat', label: 'ClubChat', icon: MessagesSquare },
  { to: 'approvals', label: 'Approvals', icon: ShieldCheck },
  { to: 'finance', label: 'Finance', icon: Wallet },
  { to: 'vendors', label: 'Vendors', icon: Store },
  { to: 'emails', label: 'Emails', icon: Mail },
  { to: 'members', label: 'Members', icon: Users },
]

export function sectionFromPath(pathname) {
  // /c/1/events/3 → 'events'
  return pathname.split('/')[3] || 'dashboard'
}
