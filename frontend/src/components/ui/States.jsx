import { motion } from 'framer-motion'
import clsx from 'clsx'
import { AlertOctagon, Inbox, Lock, RefreshCw, WifiOff } from 'lucide-react'

export function Skeleton({ className, style }) {
  return <div className={clsx('skeleton', className)} style={style} aria-hidden />
}

export function SkeletonRows({ rows = 4, className }) {
  return (
    <div className={clsx('space-y-3', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', hint, className, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex flex-col items-center justify-center gap-2 px-6 py-8 text-center', className)}
    >
      <div className="grid size-11 place-items-center rounded-xl bg-ink-850 ring-1 ring-line">
        <Icon className="size-5 text-faint" aria-hidden />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {hint && <p className="max-w-xs text-xs text-faint">{hint}</p>}
      {action}
    </motion.div>
  )
}

// Maps an ApiError to the right message: offline, forbidden (show the server's text), or generic.
export function ErrorState({ error, onRetry, className, compact = false }) {
  const forbidden = error?.status === 403
  const offline = error?.status === 0
  const Icon = offline ? WifiOff : forbidden ? Lock : AlertOctagon
  const title = offline ? "Can't reach ClubOS" : forbidden ? 'Not allowed' : 'Something went wrong'
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'flex items-center gap-3 rounded-xl bg-bad/[0.06] ring-1 ring-inset ring-bad/20',
        compact ? 'px-3 py-2' : 'px-4 py-4',
        className,
      )}
    >
      <Icon className="size-5 shrink-0 text-bad" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="truncate text-xs text-muted">{error?.message ?? 'Please try again.'}</p>
      </div>
      {onRetry && !forbidden && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg ring-1 ring-line-strong hover:bg-ink-800"
        >
          <RefreshCw className="size-3.5" aria-hidden /> Retry
        </button>
      )}
    </motion.div>
  )
}
