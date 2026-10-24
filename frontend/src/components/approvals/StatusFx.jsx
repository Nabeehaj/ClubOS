import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { CheckCircle2, CircleDashed, Clock, Minus, RotateCcw, Send, XCircle } from 'lucide-react'
import { Tag } from '@/components/ui/Badges'
import { spring, useQuality } from '@/lib/motion'
import { isApproved, shortStatus } from './pipelines'

// Every status the three systems can return, as text + icon (never color alone).
const LOOK = {
  Approved: { tone: 'ok', icon: CheckCircle2 },
  Pending: { tone: 'warn', icon: Clock },
  'Submitted Externally': { tone: 'info', icon: Send },
  'Changes Requested': { tone: 'warn', icon: RotateCcw },
  Draft: { tone: 'muted', icon: CircleDashed },
  'Not Started': { tone: 'muted', icon: CircleDashed },
  Denied: { tone: 'bad', icon: XCircle },
}

// Counts how many times `value` has turned into something that passes `test` (never on first render).
// Stores the previous prop in state, so it needs no effect.
export function useBecame(value, test) {
  const [prev, setPrev] = useState(value)
  const [count, setCount] = useState(0)
  if (prev !== value) {
    setPrev(value)
    if (test(value) && !test(prev)) setCount((c) => c + 1)
  }
  return count
}

export function SystemStatus({ status, short = false, className }) {
  if (!status) {
    return (
      <Tag className={className}>
        <Minus className="size-3" aria-hidden />
        None
      </Tag>
    )
  }
  const look = LOOK[status] ?? { tone: 'muted', icon: CircleDashed }
  const Icon = look.icon
  return (
    <Tag tone={look.tone} className={className}>
      <Icon className="size-3" aria-hidden />
      <span title={short && shortStatus(status) !== status ? status : undefined}>{short ? shortStatus(status) : status}</span>
    </Tag>
  )
}

// A status pill that slides to its new value when the status advances, and rings once when it reaches Approved.
export function AnimatedStatus({ status, short = false, celebrate = true, className }) {
  const fired = useBecame(status, isApproved)
  return (
    <motion.span layout="position" transition={spring} className={clsx('relative inline-flex', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status ?? 'none'}
          className="inline-flex"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
          transition={spring}
        >
          <SystemStatus status={status} short={short} />
        </motion.span>
      </AnimatePresence>
      {celebrate && <ApprovedRing trigger={fired} />}
    </motion.span>
  )
}

// One hairline ring that expands and fades from the pill. Skipped in low-quality mode.
function ApprovedRing({ trigger }) {
  const { quality } = useQuality()
  if (!trigger || quality === 'low') return null
  return (
    <motion.span
      key={trigger}
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-full border border-ok"
      initial={{ opacity: 0.9, scale: 1 }}
      animate={{ opacity: 0, scale: 1.6 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    />
  )
}

// A brief green wash over a section when one of its records gets approved.
export function ApprovedFlash({ trigger }) {
  if (!trigger) return null
  return (
    <motion.span
      key={trigger}
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] bg-ok/[0.07]"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 1.4, times: [0, 0.15, 1], ease: 'easeOut' }}
    />
  )
}

// "+5" next to a number when it changes, then fades. Text says the direction, so it is not color only.
export function DeltaChip({ value, className }) {
  const [prev, setPrev] = useState(value)
  const [delta, setDelta] = useState(null)
  if (prev !== value) {
    setPrev(value)
    if (typeof prev === 'number' && typeof value === 'number' && value !== prev) {
      setDelta((d) => ({ amount: value - prev, key: (d?.key ?? 0) + 1 }))
    }
  }
  if (!delta) return null
  const up = delta.amount > 0
  return (
    <motion.span
      key={delta.key}
      aria-hidden
      className={clsx('pointer-events-none tabular text-[11px] font-semibold', up ? 'text-ok' : 'text-bad', className)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: [0, 1, 1, 0], y: [4, 0, 0, -4] }}
      transition={{ duration: 2.6, times: [0, 0.1, 0.8, 1], ease: 'easeOut' }}
    >
      {up ? '+' : '−'}
      {Math.abs(delta.amount)}
    </motion.span>
  )
}
