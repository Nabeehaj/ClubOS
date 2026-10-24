import { CheckCircle2, CircleDashed, Send } from 'lucide-react'
import { parseDate } from '@/lib/format'

// Query keys for the Events feature. All start with ['club', clubId] so keys.club(clubId) refreshes them.
export const eventKeys = {
  list: (clubId, upcoming) => ['club', String(clubId), 'events', 'list', upcoming ? 'upcoming' : 'all'],
  workspace: (clubId, eventId) => ['club', String(clubId), 'events', 'workspace', String(eventId)],
  members: (clubId) => ['club', String(clubId), 'members'],
  vendors: (clubId) => ['club', String(clubId), 'vendors'],
}

export const EVENT_STATUSES = ['Planning', 'Awaiting Approval', 'Confirmed', 'Completed', 'Cancelled']
export const VENDOR_LINK_STATUSES = ['Considering', 'Quote Requested', 'Booked']

export const VENDOR_STATUS = {
  Considering: { tone: 'muted', icon: CircleDashed },
  'Quote Requested': { tone: 'info', icon: Send },
  Booked: { tone: 'ok', icon: CheckCircle2 },
}

export const PART_LABEL = {
  tasks: 'Tasks',
  reservation: '25Live room',
  approval: 'SB Engaged',
  finance: 'NXT funding',
}

// "2026-11-05" → { month: 'Nov', day: '5', weekday: 'Thu' }
export function dateParts(ymd) {
  const d = parseDate(ymd)
  if (!d) return { month: '—', day: '—', weekday: '' }
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day: String(d.getDate()),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

export function templateLabel(template) {
  if (!template) return 'Draft'
  const map = { event_invitation: 'Invitation', catering_quote: 'Catering quote' }
  if (map[template]) return map[template]
  const s = String(template).replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function isValidEventId(id) {
  return /^\d+$/.test(String(id ?? ''))
}

// Mirrors backend services.readiness for the tasks part, so a tick or a new task moves the ring instantly.
// The refetch that follows replaces this with the server's numbers.
export function withTasks(ws, tasks) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'Completed').length
  const ratio = total ? done / total : 0
  const parts = (ws.readiness?.parts ?? []).map((p) =>
    p.key === 'tasks'
      ? { ...p, ratio, points: Math.round(ratio * p.weight * 10) / 10, status: `${done}/${total} completed` }
      : p,
  )
  const score = Math.round(parts.reduce((s, p) => s + (p.points ?? 0), 0))
  const readiness = { score, parts }
  return { ...ws, tasks, readiness, event: { ...ws.event, readiness, task_progress: { completed: done, total } } }
}

export const userBrief = (m) => (m ? { id: m.id, name: m.name, email: m.email, avatar_url: m.avatar_url } : null)
