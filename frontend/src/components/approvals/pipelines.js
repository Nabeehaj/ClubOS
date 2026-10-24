// Status pipelines for the three simulated university systems. Mirrors the backend's "simulate next step"
// maps (backend/app/routers/approvals.py and finance.py) so the stepper and the disabled reasons match the API.
import { parseDate } from '@/lib/format'

export const PIPELINES = {
  '25live': {
    system: '25Live',
    steps: ['Draft', 'Pending', 'Approved'],
    next: { Draft: 'Pending', Pending: 'Approved', Denied: 'Pending' },
    // Statuses off the happy path sit on the decision step with their own tone.
    off: { Denied: { tone: 'bad', note: 'Denied by 25Live. Simulating the next step resubmits it.' } },
  },
  sbe: {
    system: 'SB Engaged',
    steps: ['Not Started', 'Draft', 'Pending', 'Approved'],
    next: { 'Not Started': 'Draft', Draft: 'Pending', 'Changes Requested': 'Pending', Pending: 'Approved' },
    off: { 'Changes Requested': { tone: 'warn', note: 'The reviewer asked for changes. Simulating the next step resubmits it.' } },
  },
  nxt: {
    system: 'NXT',
    steps: ['Draft', 'Submitted Externally', 'Pending', 'Approved'],
    next: { Draft: 'Submitted Externally', 'Submitted Externally': 'Pending', Pending: 'Approved' },
    off: { Denied: { tone: 'bad', note: 'Denied in NXT. There is no next step to simulate.' } },
  },
}

const SHORT = { 'Not Started': 'Not started', 'Submitted Externally': 'Submitted', 'Changes Requested': 'Changes requested' }
export const shortStatus = (s) => SHORT[s] ?? s

export const isApproved = (s) => s === 'Approved' || s === 'Confirmed'

// Where a status sits on its pipeline: the step index, plus the off-path info when it is Denied etc.
export function position(kind, status) {
  const p = PIPELINES[kind]
  const off = p.off[status]
  if (off) return { index: p.steps.length - 1, off }
  const i = p.steps.indexOf(status)
  return { index: i < 0 ? 0 : i, off: null }
}

export const nextStatus = (kind, status) => PIPELINES[kind].next[status] ?? null

// Why "Simulate next step" is disabled, or null when it can run.
export function blockedReason(kind, status, { canManageFinance = true } = {}) {
  const p = PIPELINES[kind]
  if (!nextStatus(kind, status)) {
    if (isApproved(status)) return `Approved in ${p.system}. Nothing left to simulate.`
    return p.off[status]?.note ?? `Already ${status}.`
  }
  if (kind === 'nxt' && !canManageFinance) return 'Only the President or Treasurer can move NXT requests.'
  return null
}

// Days from today to a YYYY-MM-DD date (negative = past).
export function daysFromToday(ymd) {
  const d = parseDate(ymd)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}
