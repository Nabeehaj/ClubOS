// Pure helpers for ClubChat: query keys, merging polled messages, grouping, and the "make task" suggestions.
import { parseDate } from '@/lib/format'

export const chatKeys = {
  channels: (clubId) => ['club', String(clubId), 'chat', 'channels'],
  messages: (clubId, channelId) => ['club', String(clubId), 'chat', 'messages', String(channelId)],
  members: (clubId) => ['club', String(clubId), 'chat', 'members'],
  events: (clubId) => ['club', String(clubId), 'chat', 'events'],
}

export const POLL_MS = 3000

// Critically damped spring: settles fast with no overshoot (design v2: springs, no bounce).
export const settle = { type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }
const GROUP_GAP_MS = 5 * 60 * 1000

export const lastId = (list) => (list ?? []).reduce((mx, m) => (m.id > mx ? m.id : mx), 0)

// Append polled messages we don't have yet. Keeps the server's order (oldest first).
export function mergeMessages(prev = [], incoming = []) {
  if (!incoming.length) return prev
  const seen = new Set(prev.map((m) => m.id))
  const add = incoming.filter((m) => !seen.has(m.id))
  return add.length ? [...prev, ...add] : prev
}

// ---------- dates ----------
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export const dayKey = (iso) => ymd(new Date(iso))

export function dayLabel(iso) {
  const d = startOfDay(new Date(iso))
  const today = startOfDay(new Date())
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export const clockTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
export const fullTime = (iso) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// ---------- grouping ----------
// Day dividers, ClubOS system rows, and runs of consecutive messages by the same author (within 5 minutes).
export function buildBlocks(items) {
  const blocks = []
  let group = null
  let lastDay = null
  for (const m of items) {
    const day = dayKey(m.created_at)
    if (day !== lastDay) {
      blocks.push({ type: 'day', key: `day-${day}`, label: dayLabel(m.created_at) })
      lastDay = day
      group = null
    }
    if (m.is_bot) {
      blocks.push({ type: 'bot', key: m.key, message: m })
      group = null
      continue
    }
    const at = new Date(m.created_at).getTime()
    if (group && group.authorId === m.author?.id && at - group.lastAt < GROUP_GAP_MS) {
      group.messages.push(m)
      group.lastAt = at
    } else {
      group = { type: 'group', key: `g-${m.key}`, authorId: m.author?.id, author: m.author, messages: [m], lastAt: at }
      blocks.push(group)
    }
  }
  return blocks
}

// ---------- "make task" suggestions ----------
const REQUEST = /\b(can|could|would|will)\s+(some|any)(one|body)\b|\b(someone|somebody|anyone|anybody)\b|\bwho\s+(can|could|will)\b/i

export function suggestTitle(body = '') {
  let t = body.trim().replace(/^(hey|hi|hello|ok|okay)(\s+(everyone|all|team|folks|y'?all))?\s*[,!.]+\s*/i, '')
  // First sentence only: a chat message often carries context after the ask.
  t = t.split(/(?<=[.!?])\s+/)[0] || t
  t = t
    .replace(/^(can|could|would|will)\s+(some|any)(one|body)\s+(please\s+)?/i, '')
    .replace(/^(can|could|would|will)\s+you\s+(please\s+)?/i, '')
    .replace(/^(some|any)(one|body)\s+(needs|has)\s+to\s+/i, '')
    .replace(/^(we|i)\s+(still\s+)?(need|have)\s+to\s+/i, '')
    .replace(/^(please|pls)\s+/i, '')
    .replace(/^i'?ll\s+/i, '')
    .replace(/^reminder:\s*/i, '')
    .replace(/[?!.\s]+$/, '')
  if (t.length < 4) t = body.trim()
  t = t.charAt(0).toUpperCase() + t.slice(1)
  return t.length > 120 ? `${t.slice(0, 117).trimEnd()}...` : t
}

function suggestAssignee(message, members) {
  const author = members.find((m) => m.id === message.author?.id)
  if (REQUEST.test(message.body) && members.length > 1) {
    const pick = members
      .filter((m) => m.id !== message.author?.id)
      .sort((a, b) => (a.open_tasks ?? 0) - (b.open_tasks ?? 0) || a.id - b.id)[0]
    if (pick) {
      const n = pick.open_tasks ?? 0
      return { id: pick.id, why: `Asked for a volunteer: ${pick.name.split(' ')[0]} has the lightest load (${n} open)` }
    }
  }
  if (author) return { id: author.id, why: 'Wrote the message' }
  return { id: message.author?.id ?? '', why: '' }
}

function suggestDue(event) {
  const today = startOfDay(new Date())
  const ev = event ? parseDate(event.date) : null
  if (ev) {
    const before = addDays(ev, -3)
    if (before > today) return { date: ymd(before), why: `3 days before ${event.name}` }
    if (ev > today) return { date: ymd(addDays(ev, -1)), why: `Day before ${event.name}` }
  }
  return { date: ymd(addDays(today, 7)), why: 'One week from today' }
}

function suggestPriority(message, event) {
  if (/\b(urgent|asap|today|tonight|immediately)\b/i.test(message.body)) return { value: 'High', why: 'The message sounds urgent' }
  const ev = event ? parseDate(event.date) : null
  if (ev) {
    const days = Math.round((ev - startOfDay(new Date())) / 86400000)
    if (days >= 0 && days <= 14) return { value: 'High', why: `${event.name} is in ${days} day${days === 1 ? '' : 's'}` }
  }
  return { value: 'Medium', why: 'Standard priority' }
}

export function suggestTask({ message, channel, members = [], events = [] }) {
  const event = events.find((e) => e.id === channel?.event_id) ?? null
  const assignee = suggestAssignee(message, members)
  const due = suggestDue(event)
  const priority = suggestPriority(message, event)
  return {
    values: {
      title: suggestTitle(message.body),
      assignee_id: assignee.id === '' ? '' : String(assignee.id),
      event_id: event ? String(event.id) : '',
      due_date: due.date,
      priority: priority.value,
    },
    why: {
      title: 'Cleaned up from the message. Edit freely.',
      assignee_id: assignee.why,
      event_id: event ? `Linked to #${channel.name}` : '',
      due_date: due.why,
      priority: priority.why,
    },
  }
}

// The bot prefixes its posts with a pin emoji; we draw our own icon instead.
export const botText = (body = '') => body.replace(/^\s*📌\s*/u, '')
