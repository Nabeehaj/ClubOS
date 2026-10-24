import { motion } from 'framer-motion'
import clsx from 'clsx'
import { softSpring } from '@/lib/motion'

const FILL = {
  energy: 'var(--color-fg)',
  copper: 'var(--color-copper)',
  muted: 'var(--color-faint)',
}

// Horizontal gauge. Animates when its value changes, so a change is visible, not decorative.
// tone="budget" goes amber past 75% and red past 100%.
export function Meter({ value = 0, max = 100, tone = 'copper', className, height = 4, label, delay = 0 }) {
  const raw = max ? (value / max) * 100 : 0
  const pct = Math.max(0, Math.min(100, raw))
  const fill =
    tone === 'budget'
      ? raw > 100
        ? 'var(--color-bad)'
        : raw > 75
          ? 'var(--color-warn)'
          : 'var(--color-fg)'
      : (FILL[tone] ?? FILL.copper)

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={clsx('relative w-full overflow-hidden rounded-full bg-ink-700', className)}
      style={{ height }}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: fill }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ ...softSpring, delay }}
      />
    </div>
  )
}
