// Display helpers. Backend dates are YYYY-MM-DD; timestamps are ISO-8601 UTC.

const money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

export function money(n, { cents = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return (cents ? money2 : money0).format(Number(n))
}

// Parse "2026-11-05" as a local date so it never shifts a day across time zones.
export function parseDate(ymd) {
  if (!ymd) return null
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function shortDate(ymd) {
  const d = parseDate(ymd)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
}

export function longDate(ymd) {
  const d = parseDate(ymd)
  return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '—'
}

// "18:00" → "6:00 PM"
export function time12(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

export function timeRange(start, end) {
  if (!start) return ''
  return end ? `${time12(start)} – ${time12(end)}` : time12(start)
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function relativeTime(iso) {
  if (!iso) return ''
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day')
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function daysUntilLabel(days) {
  if (days === null || days === undefined) return ''
  if (days < 0) return `${Math.abs(days)}d ago`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days} days`
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
