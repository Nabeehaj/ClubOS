import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { spring } from '@/lib/motion'

// Three-step progress for the email flow. Each step is a button that scrolls to its section.
export function Stepper({ steps, current, done, onJump }) {
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Email steps">
      {steps.map((s, i) => {
        const isDone = done.has(s.id)
        const isCurrent = current === s.id
        const next = steps[i + 1]
        return (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onJump?.(s.id)}
              aria-current={isCurrent ? 'step' : undefined}
              className={clsx(
                'relative flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-3 text-[13px] font-medium transition-colors',
                isCurrent ? 'text-fg' : isDone ? 'text-muted hover:text-fg' : 'text-faint hover:text-muted',
              )}
            >
              {isCurrent && (
                <motion.span
                  layoutId="email-step"
                  className="absolute inset-0 rounded-lg bg-ink-800 ring-1 ring-inset ring-line"
                  transition={spring}
                />
              )}
              <StepDot n={i + 1} done={isDone} active={isCurrent} />
              <span className="relative">{s.label}</span>
              <span className="sr-only">{isDone ? '(done)' : isCurrent ? '(current step)' : '(not started)'}</span>
            </button>
            {next && (
              <span className="relative h-px w-6 overflow-hidden bg-line sm:w-8" aria-hidden>
                <motion.span
                  className="absolute inset-0 origin-left bg-copper"
                  initial={false}
                  animate={{ scaleX: isDone ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function StepDot({ n, done, active, className }) {
  return (
    <span
      className={clsx(
        'tabular relative grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors',
        done
          ? 'bg-ink-700 text-fg'
          : active
            ? 'bg-copper text-ink-950'
            : 'text-faint ring-1 ring-inset ring-line-strong',
        className,
      )}
      aria-hidden
    >
      {done ? <Check className="size-3" strokeWidth={3} /> : n}
    </span>
  )
}
