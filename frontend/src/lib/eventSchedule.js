import {
  daysUntilLabel,
  longDate,
  parseDate,
  shortDate,
  time12,
  timeRange,
} from './format.js'

export function isMultiDay(event) {
  return (
    event?.is_multi_day === true &&
    typeof event.end_date === 'string' &&
    event.end_date > event.date
  )
}

export function eventDateRange(event) {
  if (!event?.date) return '—'
  if (!isMultiDay(event)) return shortDate(event.date)

  const first = parseDate(event.date)
  const last = parseDate(event.end_date)
  if (!first || !last) return shortDate(event.date)

  const options = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${first.toLocaleDateString('en-US', options)} – ${last.toLocaleDateString('en-US', options)}`
}

export function eventTimeRange(event) {
  if (!event?.start_time) return ''
  if (!isMultiDay(event)) {
    return timeRange(event.start_time, event.end_time)
  }

  const zone = event.timezone ? ` (${event.timezone})` : ''
  return (
    `${shortDate(event.date)}, ${time12(event.start_time)} – ` +
    `${shortDate(event.end_date)}, ${time12(event.end_time)}${zone}`
  )
}

export function eventWhen(event) {
  if (!event?.date) return '—'
  if (isMultiDay(event)) return eventTimeRange(event)

  const times = eventTimeRange(event)
  return `${longDate(event.date)}${times ? `, ${times}` : ''}`
}

export function eventTimingLabel(event) {
  if (event?.is_ongoing) return 'Underway'

  if (isMultiDay(event) && event.is_past) return 'Ended'

  if (typeof event?.days_until !== 'number') return ''
  if (event.days_until < 0) {
    return `Took place ${daysUntilLabel(event.days_until)}`
  }
  return daysUntilLabel(event.days_until)
}

export function eventHeadlineTiming(event) {
  if (event?.is_ongoing) return 'underway'
  if (event?.is_past) return 'finished'
  if (event?.days_until === 0) return 'today'
  return `${event?.days_until ?? 0} days out`
}

export function isPastEvent(event, fallbackToday) {
  if (typeof event?.is_past === 'boolean') return event.is_past
  return Boolean(event?.date && event.date < fallbackToday)
}
