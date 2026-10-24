import assert from 'node:assert/strict'
import test from 'node:test'
import {
  eventDateRange,
  eventHeadlineTiming,
  eventTimingLabel,
  eventWhen,
  isPastEvent,
} from '../src/lib/eventSchedule.js'

const hackathon = {
  date: '2026-10-23',
  end_date: '2026-10-25',
  start_time: '17:00',
  end_time: '15:30',
  timezone: 'America/New_York',
  is_multi_day: true,
  is_ongoing: true,
  is_past: false,
  days_until: -1,
}

test('the date range includes both dates and the year', () => {
  assert.match(eventDateRange(hackathon), /Oct 23, 2026/)
  assert.match(eventDateRange(hackathon), /Oct 25, 2026/)
})

test('each time is associated with its correct date', () => {
  const label = eventWhen(hackathon)
  assert.match(label, /Oct 23, 5:00 PM/)
  assert.match(label, /Oct 25, 3:30 PM/)
  assert.match(label, /America\/New_York/)
})

test('an ongoing event is not described as a negative countdown', () => {
  assert.equal(eventHeadlineTiming(hackathon), 'underway')
  assert.equal(eventTimingLabel(hackathon), 'Underway')
  assert.equal(isPastEvent(hackathon, '2026-10-24'), false)
})

test('an ended multi-day event moves into past events', () => {
  const ended = {
    ...hackathon,
    is_ongoing: false,
    is_past: true,
  }
  assert.equal(eventTimingLabel(ended), 'Ended')
  assert.equal(isPastEvent(ended, '2026-10-25'), true)
})

test('single-day events retain their ordinary display', () => {
  const event = {
    date: '2026-11-05',
    start_time: '18:00',
    end_time: '21:00',
    days_until: 2,
    is_multi_day: false,
    is_past: false,
  }
  assert.equal(eventDateRange(event), 'Nov 5')
  assert.match(eventWhen(event), /6:00 PM/)
  assert.match(eventWhen(event), /9:00 PM/)
  assert.equal(eventHeadlineTiming(event), '2 days out')
})
