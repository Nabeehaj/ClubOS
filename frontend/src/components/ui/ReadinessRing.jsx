import { motion } from 'framer-motion'
import { CountUp } from './CountUp'
import { softSpring } from '@/lib/motion'

// Readiness gauge (0–100), drawn like a pressure gauge: tick marks, a copper sweep, the number in the middle.
export function ReadinessRing({ score = 0, size = 120, stroke = 6, label = 'ready' }) {
  const r = size / 2 - 14
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  const ticks = 48

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        {Array.from({ length: ticks }).map((_, i) => {
          const a = (i / ticks) * Math.PI * 2
          const major = i % 4 === 0
          const r1 = size / 2 - 1
          const r2 = size / 2 - (major ? 7 : 4)
          return (
            <line
              key={i}
              x1={size / 2 + Math.cos(a) * r1}
              y1={size / 2 + Math.sin(a) * r1}
              x2={size / 2 + Math.cos(a) * r2}
              y2={size / 2 + Math.sin(a) * r2}
              stroke={i / ticks < pct ? 'var(--color-copper)' : 'var(--color-line-strong)'}
              strokeWidth={1}
            />
          )
        })}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ink-800)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-copper)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={softSpring}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display tabular text-[28px] font-semibold leading-none text-fg">
            <CountUp value={score} />
            <span className="text-[15px] text-muted">%</span>
          </div>
          <div className="mt-1 text-[11px] text-faint">{label}</div>
        </div>
      </div>
    </div>
  )
}
