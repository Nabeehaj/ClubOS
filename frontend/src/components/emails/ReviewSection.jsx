import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { Check, FastForward, Mail } from 'lucide-react'
import { useQuality } from '@/lib/motion'
import { CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/States'
import { HighlightField } from './HighlightField'
import { StepDot } from './Stepper'
import { factHits } from './facts'

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const MARK_MS = 2200

// The email writes itself in: subject first, then the body, with event facts marked where they land.
// `reveal` is { id, kind: 'generate' | 'polish' | 'open' | 'undo', prevBody? }; a new id starts a new run.
function useReveal(reveal, email, onComposingChange) {
  const { quality } = useQuality()
  const [typed, setTyped] = useState(null)
  const [mark, setMark] = useState(false)
  const [ghost, setGhost] = useState(null)
  const emailRef = useRef(email)
  emailRef.current = email
  const skipRef = useRef(() => {})
  const markTimer = useRef()
  const composingRef = useRef(onComposingChange)
  composingRef.current = onComposingChange

  useEffect(() => () => clearTimeout(markTimer.current), [])

  useEffect(() => {
    if (!reveal) return undefined
    clearTimeout(markTimer.current)
    skipRef.current = () => {}
    const finish = () => {
      setTyped(null)
      setGhost(null)
      composingRef.current?.(false)
      setMark(true)
      markTimer.current = setTimeout(() => setMark(false), MARK_MS)
    }

    if (reveal.kind === 'undo') {
      setTyped(null)
      setGhost(null)
      setMark(false)
      return undefined
    }
    if (reveal.kind === 'open' || quality === 'low') {
      finish()
      return undefined
    }

    const { subject = '', body = '' } = emailRef.current ?? {}
    const sc = Array.from(subject)
    const bc = Array.from(body)
    const delay = reveal.kind === 'polish' ? 380 : 80
    const sd = clamp(sc.length * 9, 220, 520)
    const bd = clamp(bc.length * 2.6, 700, 1600)

    composingRef.current?.(true)
    setMark(true)
    setGhost(reveal.kind === 'polish' ? (reveal.prevBody ?? null) : null)
    setTyped({ subject: '', body: '', phase: 'subject' })

    let raf
    let ghostGone = reveal.kind !== 'polish'
    const t0 = performance.now()
    const tick = (now) => {
      const t = now - t0 - delay
      if (t >= -60 && !ghostGone) {
        ghostGone = true
        setGhost(null)
      }
      if (t < 0) {
        // the old wording is still fading out
      } else if (t < sd) {
        setTyped({ subject: sc.slice(0, Math.ceil((sc.length * t) / sd)).join(''), body: '', phase: 'subject' })
      } else if (t < sd + bd) {
        const p = (t - sd) / bd
        setTyped({ subject, body: bc.slice(0, Math.ceil(bc.length * p)).join(''), phase: 'body' })
      } else {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    skipRef.current = () => {
      cancelAnimationFrame(raf)
      finish()
    }
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.id])

  return { typed, mark, ghost, skip: () => skipRef.current() }
}

function FactList({ facts, source, text, mark }) {
  const hits = useMemo(() => factHits(text, facts), [text, facts])
  if (!facts?.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <span className="text-faint">
        Filled from <span className="font-medium text-muted">{source}</span>
      </span>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Event details in this email">
        {facts.map((f) => {
          const hit = hits.has(f.key)
          const Icon = hit ? Check : f.icon
          return (
            <li
              key={f.key}
              className={clsx(
                'inline-flex items-center gap-1 transition-colors duration-500',
                hit ? (mark ? 'text-copper-soft' : 'text-muted') : 'text-faint',
              )}
              title={hit ? `${f.label} from the event is in this email` : `${f.label} is no longer in the text`}
            >
              <Icon className="size-3.5" strokeWidth={hit ? 2.5 : 2} aria-hidden />
              {f.label}
              <span className="sr-only">{hit ? '(in the email)' : '(not in the text)'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Placeholder({ generating }) {
  return (
    <div className="mx-5 mt-4 rounded-lg border border-dashed border-line px-5 py-6">
      {generating ? (
        <div className="space-y-3" aria-busy="true" aria-label="Generating email">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-5 h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Mail className="size-5 text-faint" aria-hidden />
          <p className="text-sm font-medium text-fg">Your email will appear here</p>
          <p className="max-w-sm text-xs text-faint">
            Pick a template and press Generate. The date, time and place come from the event, and you can edit every word
            afterwards.
          </p>
        </div>
      )}
    </div>
  )
}

// Step 2. Rendered inside the compose panel, above the finish section.
export const ReviewSection = forwardRef(function ReviewSection(
  { email, onChange, reveal, onComposingChange, generating, active, done, templateName },
  ref,
) {
  const ids = { to: useId(), subject: useId(), body: useId() }
  const { typed, mark, ghost, skip } = useReveal(reveal, email, onComposingChange)
  const composing = !!typed

  const shownSubject = typed ? typed.subject : (email?.subject ?? '')
  const shownBody = typed ? typed.body : (email?.body ?? '')
  const facts = email?.facts ?? []

  return (
    <section ref={ref} className="scroll-mt-4 pb-5" aria-labelledby={`${ids.to}-h`}>
      <CardHeader
        title={
          <span id={`${ids.to}-h`} className="flex items-center gap-2.5">
            <StepDot n={2} active={active} done={done} />
            Review and edit
          </span>
        }
        subtitle={email ? 'Every field is editable. This is exactly what opens in your mail app.' : 'Generate an email to start.'}
        action={
          composing ? (
            <button
              type="button"
              onClick={skip}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-line transition-colors hover:text-fg"
            >
              <FastForward className="size-3.5" aria-hidden />
              Skip typing
            </button>
          ) : email ? (
            <span className="text-xs text-faint">{templateName ?? 'Saved draft'}</span>
          ) : null
        }
      />

      {!email ? (
        <Placeholder generating={generating} />
      ) : (
        <motion.div
          key={reveal?.kind === 'generate' || reveal?.kind === 'open' ? `email-${reveal.id}` : 'email'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 space-y-3.5 px-5"
          aria-busy={composing}
        >
          <div>
            <label htmlFor={ids.to} className="mb-1.5 block text-xs font-medium text-muted">
              To
            </label>
            <HighlightField
              id={ids.to}
              singleLine
              value={email.to}
              placeholder="name@example.com (separate several with commas)"
              onChange={(v) => onChange({ to: v })}
              readOnly={composing}
              onSkip={skip}
            />
          </div>

          <div>
            <label htmlFor={ids.subject} className="mb-1.5 block text-xs font-medium text-muted">
              Subject
            </label>
            <HighlightField
              id={ids.subject}
              singleLine
              value={shownSubject}
              facts={facts}
              mark={mark}
              caret={composing && typed?.phase === 'subject'}
              onChange={(v) => onChange({ subject: v })}
              readOnly={composing}
              onSkip={skip}
              className="font-medium"
            />
          </div>

          <div>
            <label htmlFor={ids.body} className="mb-1.5 block text-xs font-medium text-muted">
              Body
            </label>
            <div className="relative">
              <HighlightField
                id={ids.body}
                value={shownBody}
                facts={facts}
                mark={mark}
                caret={composing && typed?.phase === 'body'}
                onChange={(v) => onChange({ body: v })}
                readOnly={composing}
                onSkip={skip}
                minHeight={300}
              />
              {/* AI polish: the old wording fades out, then the new wording types in over it */}
              <AnimatePresence>
                {ghost && (
                  <motion.div
                    key="ghost"
                    aria-hidden
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg bg-ink-850 px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap text-faint line-through decoration-faint/40 [overflow-wrap:break-word]"
                  >
                    {ghost}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <FactList facts={facts} source={email.factSource} text={`${shownSubject}\n${shownBody}`} mark={mark || composing} />
          </div>
        </motion.div>
      )}
    </section>
  )
})
