import { motion } from 'framer-motion'
import clsx from 'clsx'
import { easeOutExpo } from '@/lib/motion'

export const barTransition = { duration: 0.35, ease: easeOutExpo }

// Split bar: done (neutral) then open (copper, the work still on their plate).
// Its full width is the board's highest total, so bar lengths compare across people.
// Renders at its value on first paint and only animates when the numbers change.
export function LoadBar({ done = 0, open = 0, max = 1, height = 6, label, className }) {
  const scale = Math.max(1, max)
  return (
    <div
      role="img"
      aria-label={label ?? `${open} open, ${done} done`}
      className={clsx('flex w-full gap-px overflow-hidden rounded-sm bg-white/[0.05]', className)}
      style={{ height }}
    >
      <motion.span
        className="h-full bg-white/25"
        initial={false}
        animate={{ width: `${(done / scale) * 100}%` }}
        transition={barTransition}
      />
      <motion.span
        className="h-full bg-copper"
        initial={false}
        animate={{ width: `${(open / scale) * 100}%` }}
        transition={barTransition}
      />
    </div>
  )
}

export function LoadLegend({ className }) {
  return (
    <span className={clsx('inline-flex items-center gap-4 text-[12px] font-normal text-faint', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-3 rounded-sm bg-copper" aria-hidden />
        Open
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-3 rounded-sm bg-white/25" aria-hidden />
        Done
      </span>
    </span>
  )
}
