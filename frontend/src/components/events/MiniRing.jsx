import { motion } from 'framer-motion'
import { easeOutExpo } from '@/lib/motion'

// Compact readiness ring for event cards (the big ReadinessRing is sized for the workspace header).
export function MiniRing({ score = 0, size = 48, stroke = 4 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Readiness ${score}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
        />
      </svg>
      <span className="font-display tabular absolute text-[12px] font-semibold text-fg" aria-hidden>
        {score}
      </span>
    </div>
  )
}
