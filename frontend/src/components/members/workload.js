import { Feather, Flame, Gauge, Siren } from 'lucide-react'

// Workload is judged relative to the rest of the board, so "heavy" means heavier than your peers,
// not an arbitrary absolute number. Every level has a label and an icon (never color alone).
export const LEVELS = {
  capacity: { label: 'Has capacity', short: 'capacity', tone: 'ok', icon: Feather, rank: 0 },
  steady: { label: 'Steady', short: 'steady', tone: 'info', icon: Gauge, rank: 1 },
  heavy: { label: 'Heavy load', short: 'heavy', tone: 'warn', icon: Flame, rank: 2 },
  overloaded: { label: 'Overloaded', short: 'overloaded', tone: 'bad', icon: Siren, rank: 3 },
}

export const LEVEL_ORDER = ['overloaded', 'heavy', 'steady', 'capacity']

export const openOf = (m) => m.open_tasks ?? Math.max(0, (m.task_count ?? 0) - (m.tasks_completed ?? 0))

export function levelFor(open, avg) {
  if (open === 0) return 'capacity'
  if (avg <= 0) return 'steady'
  if (open >= 4 && open >= avg * 2) return 'overloaded'
  if (open >= avg + 1) return 'heavy'
  if (open <= avg - 0.75) return 'capacity'
  return 'steady'
}

// One pass over the board: average open load, the longest bar (so bars compare across people),
// each member's level, and the best person to hand a new task to.
export function computeWorkload(members = []) {
  const opens = members.map(openOf)
  const avg = members.length ? opens.reduce((a, b) => a + b, 0) / members.length : 0
  const maxTotal = Math.max(1, ...members.map((m) => m.task_count ?? 0))
  const levels = {}
  const counts = { capacity: 0, steady: 0, heavy: 0, overloaded: 0 }
  members.forEach((m, i) => {
    const lv = levelFor(opens[i], avg)
    levels[m.id] = lv
    counts[lv]++
  })
  const bestFit =
    [...members].sort(
      (a, b) =>
        openOf(a) - openOf(b) || (a.task_count ?? 0) - (b.task_count ?? 0) || String(a.name).localeCompare(String(b.name)),
    )[0] ?? null
  const totalOpen = opens.reduce((a, b) => a + b, 0)
  return { avg, maxTotal, levels, counts, bestFit, totalOpen }
}
