import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Lock, Pencil, X, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { keys } from '@/lib/queryClient'
import { softSpring, spring } from '@/lib/motion'
import { Card } from '@/components/ui/Card'
import { CountUp } from '@/components/ui/CountUp'
import { EmptyState } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'
import { READ_ONLY_REASON, budgetTone, financeKey, mergeBudget, moneySmart } from './financeUtils'

// ---------- read-out: annual budget, spent, remaining, unallocated ----------

// Shows "+$45" next to a figure for a few seconds after it changes.
function useDelta(value) {
  const prev = useRef(value)
  const timer = useRef(null)
  const [delta, setDelta] = useState(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const before = prev.current
    prev.current = value
    if (before === undefined || before === null || before === value) return
    const d = Math.round((value - before) * 100) / 100
    if (!d) return
    setDelta({ d, id: Date.now() })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDelta(null), 4000)
  }, [value])
  return delta
}

function Figure({ label, value, note, noteIcon: NoteIcon, noteClass = 'text-faint' }) {
  const delta = useDelta(value)
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display tabular text-[26px] font-semibold leading-none text-fg">
          <CountUp value={value} format={moneySmart} duration={0.9} />
        </span>
        <AnimatePresence>
          {delta && (
            <motion.span
              key={delta.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
              className="tabular text-[12px] font-medium text-copper-soft"
            >
              {delta.d > 0 ? '+' : '−'}
              {moneySmart(Math.abs(delta.d))}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {note && (
        <p className={clsx('mt-1.5 flex items-center gap-1 text-[12px]', noteClass)}>
          {NoteIcon && <NoteIcon className="size-3.5 shrink-0" aria-hidden />}
          {note}
        </p>
      )}
    </div>
  )
}

function Figures({ summary }) {
  const { annual_budget, spent, remaining, unallocated, allocated, percent_used } = summary
  const lowLeft = annual_budget > 0 && remaining / annual_budget < 0.15

  const remainingNote =
    remaining < 0
      ? { note: `Over the budget by ${moneySmart(-remaining)}`, noteIcon: XCircle, noteClass: 'text-bad' }
      : lowLeft
        ? { note: 'Running low for the year', noteIcon: AlertTriangle, noteClass: 'text-warn' }
        : { note: 'Left to spend this year' }

  const unallocNote =
    unallocated < 0
      ? { note: `Plans exceed the budget by ${moneySmart(-unallocated)}`, noteIcon: XCircle, noteClass: 'text-bad' }
      : unallocated === 0
        ? { note: 'Every dollar is assigned' }
        : { note: `${moneySmart(allocated)} assigned to categories` }

  return (
    <div className="grid grid-cols-2 divide-line border-b border-line md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line md:[&>*:nth-child(n+3)]:border-t-0">
      <Figure label="Demo annual budget" value={annual_budget} note="Not a verified SBCS allocation" />
      <Figure label="Spent" value={spent} note={`${percent_used}% of the annual budget`} />
      <Figure label="Remaining" value={remaining} {...remainingNote} />
      <Figure label="Unallocated" value={unallocated} {...unallocNote} />
    </div>
  )
}

// ---------- allocation: how the annual budget is split, spent filled in copper ----------
function Allocation({ summary }) {
  const total = Math.max(summary.annual_budget, summary.allocated, 1)
  const free = Math.max(0, summary.unallocated)
  const described = summary.categories
    .map((c) => `${c.name}: ${moneySmart(c.spent)} spent of ${moneySmart(c.planned)}`)
    .join('; ')

  return (
    <div className="px-5 pb-1 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-medium text-fg">How the budget is split</h3>
        <span className="text-[12px] text-faint">Filled part is spent</span>
      </div>
      <div
        role="img"
        aria-label={`${moneySmart(summary.annual_budget)} budget. ${described}. ${moneySmart(free)} unallocated.`}
        className="mt-2.5 flex gap-[2px]"
      >
        {summary.categories.map((c) => {
          const share = c.planned / total
          const spentPct = c.planned > 0 ? Math.min(100, (c.spent / c.planned) * 100) : c.spent > 0 ? 100 : 0
          return (
            <motion.div
              key={c.id}
              className="min-w-[6px]"
              initial={false}
              animate={{ flexGrow: share }}
              style={{ flexBasis: 0 }}
              transition={softSpring}
              title={`${c.name}: ${moneySmart(c.spent)} spent of ${moneySmart(c.planned)}`}
            >
              <div className="relative h-2.5 overflow-hidden rounded-[3px] bg-ink-700">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-copper"
                  initial={{ width: 0 }}
                  animate={{ width: `${spentPct}%` }}
                  transition={softSpring}
                />
              </div>
              {share >= 0.07 && <div className="mt-1.5 truncate pr-1 text-[11.5px] text-faint">{c.name}</div>}
            </motion.div>
          )
        })}
        {free > 0 && (
          <motion.div
            className="min-w-[6px]"
            initial={false}
            animate={{ flexGrow: free / total }}
            style={{ flexBasis: 0 }}
            transition={softSpring}
            title={`Unallocated: ${moneySmart(free)}`}
          >
            <div className="h-2.5 rounded-[3px] border border-dashed border-line-strong" />
            {free / total >= 0.07 && <div className="mt-1.5 truncate text-[11.5px] text-faint">Unallocated</div>}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ---------- categories: planned vs spent, status, inline planned edit ----------
function PlannedEditor({ category, onSave, onCancel, saving }) {
  const [value, setValue] = useState(String(category.planned))
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  useEffect(() => inputRef.current?.select(), [])

  const submit = (e) => {
    e.preventDefault()
    const n = Number(value)
    if (value.trim() === '' || Number.isNaN(n) || n < 0) {
      setError('Enter $0 or more')
      return
    }
    if (n === category.planned) return onCancel()
    onSave(n)
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="relative flex items-center justify-end gap-1"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <label className="sr-only" htmlFor={`planned-${category.id}`}>
        Planned amount for {category.name}
      </label>
      <span className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-faint">$</span>
        <input
          ref={inputRef}
          id={`planned-${category.id}`}
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `planned-err-${category.id}` : undefined}
          className={clsx(
            'tabular h-7 w-24 rounded-md border bg-ink-850 pl-5 pr-1.5 text-right text-[13px] text-fg focus:outline-none',
            error ? 'border-bad' : 'border-copper',
          )}
        />
      </span>
      <button
        type="submit"
        disabled={saving}
        aria-label={`Save planned amount for ${category.name}`}
        className="grid size-7 place-items-center rounded-md text-fg transition hover:bg-ink-700 disabled:opacity-50"
      >
        <Check className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel editing"
        className="grid size-7 place-items-center rounded-md text-faint transition hover:bg-ink-700 hover:text-fg"
      >
        <X className="size-4" aria-hidden />
      </button>
      {error && (
        <span
          id={`planned-err-${category.id}`}
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-line bg-ink-800 px-2 py-1 text-[12px] text-bad"
        >
          {error}
        </span>
      )}
    </motion.form>
  )
}

function CategoryRow({ category, preview, changed, canManage, onEditPlanned, saving }) {
  const [editing, setEditing] = useState(false)
  const tone = budgetTone(category.spent, category.planned)
  const ToneIcon = tone.icon
  const pct = Math.min(100, tone.pct === Infinity ? 100 : tone.pct)
  const previewAmount = preview > 0 ? preview : 0
  const after = previewAmount ? budgetTone(category.spent + previewAmount, category.planned) : null
  const afterPct = after ? Math.min(100, after.pct === Infinity ? 100 : after.pct) : pct

  return (
    <li className="relative grid grid-cols-[minmax(150px,1fr)_minmax(160px,1.6fr)_auto] items-center gap-x-5 px-5 py-3">
      {/* Brief tint on the row whose spend just changed */}
      <AnimatePresence>
        {changed && (
          <motion.span
            key={changed}
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-copper/[0.07]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <div className="relative min-w-0">
        <div className="truncate text-[14px] font-medium text-fg">{category.name}</div>
        <div className={clsx('mt-0.5 flex items-center gap-1 text-[12px]', after && after.key !== tone.key ? after.text : tone.text)}>
          <ToneIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {after && after.key !== tone.key ? `After this expense: ${after.label.toLowerCase()}` : tone.label}
          </span>
        </div>
      </div>

      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(tone.pct, 999))}
        aria-label={`${category.name}: ${moneySmart(category.spent)} of ${moneySmart(category.planned)} spent. ${tone.label}.`}
        className="relative h-2 overflow-hidden rounded-full bg-ink-700"
      >
        {/* Where the bar lands if the expense being typed is added */}
        <motion.div
          className={clsx('absolute inset-y-0 left-0 rounded-full opacity-40', after?.fill ?? tone.fill)}
          initial={false}
          animate={{ width: `${afterPct}%`, opacity: previewAmount ? 0.4 : 0 }}
          transition={softSpring}
        />
        <motion.div
          className={clsx('absolute inset-y-0 left-0 rounded-full transition-colors duration-500', tone.fill)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={softSpring}
        />
      </div>

      <div className="relative w-[200px] text-right">
        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <PlannedEditor
              key="edit"
              category={category}
              saving={saving}
              onCancel={() => setEditing(false)}
              onSave={(planned) => onEditPlanned(category, planned, () => setEditing(false))}
            />
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="tabular flex items-center justify-end gap-1.5 text-[13px]"
            >
              <span className={clsx('font-semibold', tone.key === 'over' ? 'text-bad' : 'text-fg')}>
                <CountUp value={category.spent} format={moneySmart} duration={0.9} />
              </span>
              <span className="text-faint">of</span>
              <span className="text-muted">
                <CountUp value={category.planned} format={moneySmart} duration={0.9} />
              </span>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={`Edit planned amount for ${category.name}`}
                  title="Edit planned amount"
                  className="grid size-7 place-items-center rounded-md text-faint transition hover:bg-ink-700 hover:text-fg"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              ) : (
                <span className="grid size-7 place-items-center text-faint" title={READ_ONLY_REASON}>
                  <Lock className="size-3.5" aria-hidden />
                  <span className="sr-only">{READ_ONLY_REASON}</span>
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  )
}

// Remembers which categories' spend changed so their rows can tint once.
function useChangedCategories(categories) {
  const prev = useRef(null)
  const timer = useRef(null)
  const [changed, setChanged] = useState({})
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const before = prev.current
    prev.current = Object.fromEntries(categories.map((c) => [c.id, c.spent]))
    if (!before) return
    const ids = categories.filter((c) => before[c.id] !== undefined && before[c.id] !== c.spent).map((c) => c.id)
    if (!ids.length) return
    const stamp = Date.now()
    setChanged((f) => ({ ...f, ...Object.fromEntries(ids.map((id) => [id, stamp])) }))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setChanged({}), 2000)
  }, [categories])
  return changed
}

export function BudgetPanel({ summary, clubId, api, canManage, preview }) {
  const qc = useQueryClient()
  const changed = useChangedCategories(summary.categories)

  const edit = useMutation({
    mutationFn: ({ category, planned }) => api.finance.updateCategory(category.id, { planned }),
    onSuccess: (budget, { category, planned, done }) => {
      qc.setQueryData(financeKey(clubId, 'summary'), (s) => mergeBudget(s, budget))
      qc.invalidateQueries({ queryKey: keys.club(clubId) })
      toast(`${category.name} is now planned at ${moneySmart(planned)}`)
      done?.()
    },
    onError: (err) => toast.error(err),
  })

  return (
    <Card className="overflow-hidden">
      <Figures summary={summary} />
      {summary.categories.length === 0 ? (
        <EmptyState title="No budget categories yet" hint="Once categories are set up for this club, their plans and spending show here." />
      ) : (
        <>
          <Allocation summary={summary} />
          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line px-5 pb-1 pt-4">
            <h3 className="text-[13px] font-medium text-fg">By category</h3>
            <span className="text-[12px] text-faint">Spent of planned</span>
          </div>
          <ul className="divide-y divide-line">
            {summary.categories.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                changed={changed[c.id]}
                preview={preview?.category_id === c.id ? preview.amount : 0}
                canManage={canManage}
                saving={edit.isPending && edit.variables?.category.id === c.id}
                onEditPlanned={(category, planned, done) => edit.mutate({ category, planned, done })}
              />
            ))}
          </ul>
          {!canManage && (
            <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-[12px] text-muted">
              <Lock className="size-3.5" aria-hidden /> {READ_ONLY_REASON}
            </p>
          )}
        </>
      )}
    </Card>
  )
}
