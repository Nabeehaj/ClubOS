import { useId } from 'react'
import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Clock, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SimulatedBadge } from '@/components/ui/Badges'
import { shortDate } from '@/lib/format'
import { daysFromToday, isApproved, shortStatus } from './pipelines'

export function SystemHeader({ icon: Icon, title, subtitle, id, className }) {
  return (
    <header className={clsx('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <div className="min-w-0">
          <h3 id={id} className="font-display truncate text-[15px] font-semibold text-fg">
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 truncate text-xs text-faint">{subtitle}</p>}
        </div>
      </div>
      <SimulatedBadge className="shrink-0" />
    </header>
  )
}

// SIM- reference numbers are real codes, so they are the one place monospace is used.
export function Reference({ value, pending = 'Assigned on submission' }) {
  if (!value) return <span className="text-faint">{pending}</span>
  return <span className="font-mono text-[12px] text-fg">{value}</span>
}

export function InfoRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-faint">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] text-fg">{children}</dd>
    </div>
  )
}

function inDays(days) {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

// Deadline as text + icon: met, overdue, due soon, or later.
export function Deadline({ date, status, label = 'Due' }) {
  if (!date) return null
  const days = daysFromToday(date)
  if (isApproved(status)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-faint">
        <CheckCircle2 className="size-3.5 text-ok" aria-hidden />
        {label} {shortDate(date)}, met
      </span>
    )
  }
  if (days !== null && days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-bad">
        <AlertTriangle className="size-3.5" aria-hidden />
        Overdue since {shortDate(date)}
      </span>
    )
  }
  const soon = days !== null && days <= 7
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs', soon ? 'font-medium text-warn' : 'text-muted')}>
      <Clock className="size-3.5" aria-hidden />
      {label} {shortDate(date)}
      {days !== null && <span className={soon ? '' : 'text-faint'}>({inDays(days)})</span>}
    </span>
  )
}

// The demo button. When it can't run it stays visible, disabled, and says why.
export function SimulateButton({ next, reason, loading, onClick, size = 'md', className }) {
  const id = useId()
  return (
    <div className={clsx('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <Button
        variant={reason ? 'secondary' : 'primary'}
        size={size}
        onClick={onClick}
        loading={loading}
        disabled={!!reason}
        aria-describedby={id}
      >
        Simulate next step
      </Button>
      <p id={id} className="flex min-w-0 items-center gap-1.5 text-xs text-faint">
        {reason ? (
          <>
            {reason.startsWith('Approved') ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-ok" aria-hidden />
            ) : (
              <Lock className="size-3.5 shrink-0" aria-hidden />
            )}
            <span>{reason}</span>
          </>
        ) : (
          <span>
            Moves it to <span className="font-medium text-muted">{shortStatus(next)}</span>
          </span>
        )}
      </p>
    </div>
  )
}
