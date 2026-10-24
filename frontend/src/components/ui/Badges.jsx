import clsx from 'clsx'
import { CheckCircle2, CircleDashed, Clock, FlaskConical, Send, XCircle, AlertTriangle, CircleDot } from 'lucide-react'

// Status is always text + icon, never color alone. Quiet by default: colored icon, neutral text.
const STATUS = {
  approved: { tone: 'ok', icon: CheckCircle2 },
  confirmed: { tone: 'ok', icon: CheckCircle2 },
  completed: { tone: 'ok', icon: CheckCircle2 },
  done: { tone: 'ok', icon: CheckCircle2 },
  pending: { tone: 'warn', icon: Clock },
  'awaiting approval': { tone: 'warn', icon: Clock },
  'in progress': { tone: 'info', icon: CircleDot },
  planning: { tone: 'info', icon: CircleDot },
  submitted: { tone: 'info', icon: Send },
  'submitted externally': { tone: 'info', icon: Send },
  draft: { tone: 'muted', icon: CircleDashed },
  'not started': { tone: 'muted', icon: CircleDashed },
  'to do': { tone: 'muted', icon: CircleDashed },
  rejected: { tone: 'bad', icon: XCircle },
  denied: { tone: 'bad', icon: XCircle },
  overdue: { tone: 'bad', icon: AlertTriangle },
}

const ICON_TONE = {
  ok: 'text-ok',
  warn: 'text-warn',
  info: 'text-info',
  bad: 'text-bad',
  muted: 'text-faint',
  copper: 'text-copper',
  accent: 'text-copper',
}

const pill = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-ink-850 px-1.5 py-[3px] text-[11.5px] font-medium leading-none'

export function StatusPill({ status, className }) {
  if (!status) return null
  const s = STATUS[String(status).toLowerCase()] ?? { tone: 'muted', icon: CircleDot }
  const Icon = s.icon
  return (
    <span className={clsx(pill, 'text-muted', className)}>
      <Icon className={clsx('size-3', ICON_TONE[s.tone])} aria-hidden />
      {status}
    </span>
  )
}

const TEXT_TONE = {
  ok: 'text-ok',
  warn: 'text-warn',
  info: 'text-info',
  bad: 'text-bad',
  muted: 'text-muted',
  copper: 'text-copper-soft',
  accent: 'text-copper-soft',
}

export function Tag({ children, tone = 'muted', className }) {
  return <span className={clsx(pill, TEXT_TONE[tone] ?? TEXT_TONE.muted, className)}>{children}</span>
}

// Required by the guide on every 25Live / SB Engaged / NXT record.
export function SimulatedBadge({ className, title = 'Demo data. Not connected to the real university system.' }) {
  return (
    <span title={title} className={clsx(pill, 'text-faint', className)}>
      <FlaskConical className="size-3 text-copper" aria-hidden />
      Simulated
    </span>
  )
}

const PRIORITY = { high: 'bad', medium: 'warn', low: 'muted' }
export function PriorityTag({ priority }) {
  if (!priority) return null
  const tone = PRIORITY[String(priority).toLowerCase()] ?? 'muted'
  return (
    <span className={clsx(pill, 'text-muted')}>
      <span className={clsx('size-1.5 rounded-full', tone === 'bad' ? 'bg-bad' : tone === 'warn' ? 'bg-warn' : 'bg-faint')} aria-hidden />
      {priority}
    </span>
  )
}
