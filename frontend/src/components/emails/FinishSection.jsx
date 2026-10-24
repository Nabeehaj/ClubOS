import { forwardRef, useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ExternalLink, Info, Save, Sparkles, Undo2 } from 'lucide-react'
import { CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { StepDot } from './Stepper'

export const TONES = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'hype', label: 'Hype' },
  { value: 'concise', label: 'Concise' },
]

const swap = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
}

// Step 3. AI polish, open in the user's mail app, save as a draft.
export const FinishSection = forwardRef(function FinishSection(
  { email, busy, ai, tone, setTone, onPolish, polishing, polished, onUndo, onOpen, opening, onSave, saving, saved, active, done },
  ref,
) {
  const toneId = useId()
  const hasEmail = !!email
  const complete = hasEmail && email.subject.trim() && email.body.trim()
  const blocked = !complete || busy
  const aiOff = !ai.available

  return (
    <section ref={ref} className="scroll-mt-4 border-t border-line pb-5">
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            <StepDot n={3} active={active} done={done} />
            Finish
          </span>
        }
        subtitle={
          !hasEmail
            ? 'Generate an email first.'
            : !complete
              ? 'Add a subject and a body to continue.'
              : 'Polish the wording if you like, then open it in your mail app.'
        }
      />

      <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-3 px-5">
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor={toneId} className="mb-1.5 block text-xs font-medium text-muted">
              Tone
            </label>
            <Select
              id={toneId}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              disabled={aiOff || blocked || polishing}
              className="w-[150px]"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="secondary"
            onClick={onPolish}
            loading={polishing}
            disabled={aiOff || blocked}
            aria-describedby={`${toneId}-ai`}
          >
            {!polishing && <Sparkles className="size-4" aria-hidden />}
            {polishing ? 'Polishing' : 'AI polish'}
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={onSave} loading={saving} disabled={blocked || saved}>
            {!saving && (saved ? <Check className="size-4" aria-hidden /> : <Save className="size-4" aria-hidden />)}
            {saved ? 'Draft saved' : 'Save draft'}
          </Button>
          <Button onClick={onOpen} loading={opening} disabled={blocked}>
            {!opening && <ExternalLink className="size-4" aria-hidden />}
            Open in mail app
          </Button>
        </div>
      </div>

      <div id={`${toneId}-ai`} className="mt-3 min-h-5 px-5 text-xs" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {ai.checking ? (
            <motion.p key="checking" {...swap} className="text-faint">
              Checking whether AI polish is available.
            </motion.p>
          ) : aiOff ? (
            <motion.p key="off" {...swap} className="flex items-center gap-1.5 text-faint">
              <Sparkles className="size-3.5 shrink-0" aria-hidden />
              AI polish is coming soon. Everything else on this page works without it.
            </motion.p>
          ) : polished ? (
            <motion.p key="polished" {...swap} className="flex flex-wrap items-center gap-2 text-muted">
              <Check className="size-3.5 shrink-0 text-ok" aria-hidden />
              Rewritten in a {polished.tone} tone. Dates, times and places were kept.
              <button
                type="button"
                onClick={onUndo}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-fg ring-1 ring-inset ring-line hover:bg-ink-800"
              >
                <Undo2 className="size-3.5" aria-hidden />
                Undo polish
              </button>
            </motion.p>
          ) : (
            <motion.p key="ready" {...swap} className="text-faint">
              AI polish rewrites the wording in the tone you pick. It keeps every date, time and place.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <p className="mx-5 mt-4 flex items-start gap-2 rounded-lg bg-ink-850 px-3 py-2.5 text-xs leading-relaxed text-muted ring-1 ring-inset ring-line">
        <Info className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
        <span>
          ClubOS never sends email. Open in mail app hands this message to your own mail app (Outlook, Gmail, Apple Mail),
          where you read it over and press send yourself.
        </span>
      </p>
    </section>
  )
})
