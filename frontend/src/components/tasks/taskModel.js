import { CircleCheck, CircleDashed, CircleDot } from 'lucide-react'
import { parseDate, shortDate } from '@/lib/format'

// The three board columns. Values match the backend enum exactly.
export const STATUSES = [
  { id: 'To Do', label: 'To do', icon: CircleDashed, tone: 'text-muted', bar: 'bg-faint' },
  { id: 'In Progress', label: 'In progress', icon: CircleDot, tone: 'text-info', bar: 'bg-info' },
  { id: 'Completed', label: 'Completed', icon: CircleCheck, tone: 'text-ok', bar: 'bg-ok' },
]
export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]))
export const STATUS_IDS = STATUSES.map((s) => s.id)

export const PRIORITIES = ['Low', 'Medium', 'High']
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 }

// Query keys. Lists live under 'list' so optimistic writes can target them without touching members/events.
export const taskKeys = {
  all: (clubId) => ['club', String(clubId), 'tasks'],
  lists: (clubId) => ['club', String(clubId), 'tasks', 'list'],
  list: (clubId, filters) => ['club', String(clubId), 'tasks', 'list', filters],
  members: (clubId) => ['club', String(clubId), 'tasks', 'members'],
  events: (clubId) => ['club', String(clubId), 'tasks', 'events'],
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Computed on the client too, so an optimistic move to Completed clears the flag at once.
export function isOverdue(task) {
  if (!task.due_date || task.status === 'Completed') return false
  const due = parseDate(task.due_date)
  return !!due && due < startOfToday()
}

// Due-date label and tone for a card.
export function dueInfo(task) {
  if (!task.due_date) return null
  const due = parseDate(task.due_date)
  if (!due) return null
  const days = Math.round((due - startOfToday()) / 86_400_000)
  if (task.status === 'Completed') return { text: `Due ${shortDate(task.due_date)}`, tone: 'faint', days }
  if (days < 0) {
    const late = Math.abs(days)
    return { text: `Overdue by ${late} ${late === 1 ? 'day' : 'days'}`, tone: 'bad', days, overdue: true }
  }
  if (days === 0) return { text: 'Due today', tone: 'warn', days }
  if (days === 1) return { text: 'Due tomorrow', tone: 'warn', days }
  return { text: `Due ${shortDate(task.due_date)}`, tone: 'muted', days }
}

// Completed: most recently finished first, so a card you just dropped lands on top.
// Open columns: earliest due date first (no date last), then priority.
export function sortForColumn(status, tasks) {
  const list = [...tasks]
  if (status === 'Completed') {
    return list.sort((a, b) => String(b.completed_at ?? '').localeCompare(String(a.completed_at ?? '')) || b.id - a.id)
  }
  return list.sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1
    if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1
    return (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) || a.id - b.id
  })
}

export function firstName(name = '') {
  return name.split(/\s+/)[0] ?? ''
}

// The member shape the task API returns for `assignee`.
export function briefOf(member) {
  if (!member) return null
  return { id: member.id, name: member.name, email: member.email, avatar_url: member.avatar_url }
}
