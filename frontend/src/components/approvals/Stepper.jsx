import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Check, RotateCcw, X } from 'lucide-react'
import { spring } from '@/lib/motion'
import { PIPELINES, isApproved, position, shortStatus } from './pipelines'

const STATE_TEXT = { done: 'completed', approved: 'completed', current: 'current step', bad: 'current step', warn: 'current step', todo: 'not reached' }

function Node({ state, n }) {
  return (
    <motion.span
      key={state}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...spring, delay: 0.15 }}
      className={clsx(
        'relative z-10 grid size-6 place-items-center rounded-full',
        state === 'approved' && 'bg-ok text-ink-950',
        state === 'done' && 'bg-copper text-ink-950',
        state === 'current' && 'bg-ink-900 ring-2 ring-inset ring-copper',
        state === 'bad' && 'bg-ink-900 text-bad ring-2 ring-inset ring-bad',
        state === 'warn' && 'bg-ink-900 text-warn ring-2 ring-inset ring-warn',
        state === 'todo' && 'bg-ink-900 text-faint ring-1 ring-inset ring-line',
      )}
      aria-hidden
    >
      {(state === 'done' || state === 'approved') && <Check className="size-3.5" strokeWidth={3} />}
      {state === 'bad' && <X className="size-3.5" strokeWidth={3} />}
      {state === 'warn' && <RotateCcw className="size-3" strokeWidth={2.5} />}
      {state === 'todo' && <span className="tabular text-[10px] font-semibold">{n}</span>}
      {state === 'current' && <span className="size-2 rounded-full bg-copper" />}
    </motion.span>
  )
}

// Not started, Draft, Pending, Approved: the line fills as the record advances.
export function Stepper({ kind, status, className }) {
  const p = PIPELINES[kind]
  const { index, off } = position(kind, status)
  const last = p.steps.length - 1

  return (
    <ol
      aria-label={`${p.system} status steps`}
      className={clsx('grid', className)}
      style={{ gridTemplateColumns: `repeat(${p.steps.length}, minmax(0, 1fr))` }}
    >
      {p.steps.map((step, i) => {
        let state = 'todo'
        if (i < index) state = 'done'
        else if (i === index) state = off ? off.tone : isApproved(status) && i === last ? 'approved' : 'current'
        const label = i === index && off ? shortStatus(status) : shortStatus(step)
        return (
          <li key={step} className="relative flex flex-col items-center text-center" aria-current={i === index ? 'step' : undefined}>
            {i < last && (
              <span className="absolute left-1/2 top-[11px] h-0.5 w-full overflow-hidden bg-line" aria-hidden>
                <motion.span
                  className="absolute inset-0 origin-left bg-copper"
                  initial={false}
                  animate={{ scaleX: i < index ? 1 : 0 }}
                  transition={spring}
                />
              </span>
            )}
            <Node state={state} n={i + 1} />
            <span
              className={clsx(
                'mt-1.5 px-0.5 text-[11px] leading-tight',
                state === 'todo' && 'text-faint',
                state === 'done' && 'text-muted',
                state === 'approved' && 'font-semibold text-ok',
                state === 'current' && 'font-semibold text-fg',
                state === 'bad' && 'font-semibold text-bad',
                state === 'warn' && 'font-semibold text-warn',
              )}
            >
              {label}
              <span className="sr-only">, {STATE_TEXT[state]}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
