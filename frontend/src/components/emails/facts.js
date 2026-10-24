// Which event facts an email was built from, and where they land in the text.
// The backend formats dates as "Thursday, November 5" and times as "6:00 PM"; longDate/time12/money match that.
import { CalendarDays, Clock, MapPin, Store, Users, Wallet } from 'lucide-react'
import { longDate, money, time12 } from '@/lib/format'

export function todayYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeFacts({ template, event, vendor, meeting }) {
  if (template === 'meeting_reminder') {
    return {
      source: 'your board calendar',
      facts: [
        { key: 'date', label: 'Date', icon: CalendarDays, texts: [longDate(meeting?.date || todayYmd())] },
        { key: 'time', label: 'Time', icon: Clock, texts: [meeting?.timeLabel] },
        { key: 'place', label: 'Room', icon: MapPin, texts: [meeting?.location] },
      ],
    }
  }
  if (!event) return { source: null, facts: [] }
  const facts = [
    { key: 'date', label: 'Date', icon: CalendarDays, texts: [longDate(event.date)] },
    { key: 'time', label: 'Time', icon: Clock, texts: [time12(event.start_time), time12(event.end_time)] },
    { key: 'place', label: 'Location', icon: MapPin, texts: [event.location] },
  ]
  if (event.expected_attendance) {
    facts.push({ key: 'guests', label: 'Guests', icon: Users, texts: [String(event.expected_attendance)], numeric: true })
  }
  if (template === 'catering_quote' && vendor) {
    facts.push({ key: 'vendor', label: 'Vendor', icon: Store, texts: [vendor.name] })
    if (vendor.estimated_cost) facts.push({ key: 'budget', label: 'Budget', icon: Wallet, texts: [money(vendor.estimated_cost)] })
  }
  return { source: event.name, facts }
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Sorted, non-overlapping [start, end, key] ranges of every fact occurrence in `text`.
export function findRanges(text, facts = []) {
  if (!text) return []
  const found = []
  for (const f of facts) {
    for (const t of f.texts ?? []) {
      if (!t) continue
      const re = f.numeric ? new RegExp(`(?<![\\d.,$])${escape(t)}(?![\\d,])`, 'g') : new RegExp(escape(t), 'g')
      for (const m of text.matchAll(re)) found.push([m.index, m.index + m[0].length, f.key])
    }
  }
  found.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const merged = []
  for (const r of found) {
    const last = merged[merged.length - 1]
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([...r])
  }
  return merged
}

export function factHits(text, facts = []) {
  return new Set(findRanges(text, facts).map((r) => r[2]))
}
