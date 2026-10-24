import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Plus } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { ErrorState } from '@/components/ui/States'
import { spring } from '@/lib/motion'
import { READ_ONLY_REASON, moneySmart } from './financeUtils'

const EMPTY = { description: '', amount: '', category_id: '', event_id: '', vendor_id: '' }

export function AddExpense({ categories, events, vendors, canManage, onSubmit, pending, error, onDraftChange }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const descRef = useRef(null)
  const disabled = !canManage

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }

  // Feed the live preview on the category bars while the user types.
  const amountNum = Number(form.amount)
  const draftCategory = form.category_id ? Number(form.category_id) : null
  const draftAmount = amountNum > 0 ? amountNum : 0
  const draftCat = categories.find((c) => c.id === draftCategory)
  const previewSpent = (draftCat?.spent ?? 0) + draftAmount
  const previewPlanned = draftCat?.planned ?? 0
  useEffect(() => {
    onDraftChange?.(draftCategory && draftAmount ? { category_id: draftCategory, amount: draftAmount } : null)
  }, [draftCategory, draftAmount, onDraftChange])

  const submit = (e) => {
    e.preventDefault()
    if (disabled) return
    const next = {}
    if (!form.description.trim()) next.description = 'Add a short description'
    if (!(amountNum > 0)) next.amount = 'Enter an amount above $0'
    if (!form.category_id) next.category_id = 'Pick a category'
    setErrors(next)
    if (Object.keys(next).length) return
    onSubmit(
      {
        description: form.description.trim(),
        amount: Math.round(amountNum * 100) / 100,
        category_id: Number(form.category_id),
        event_id: form.event_id ? Number(form.event_id) : null,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
      },
      () => {
        // Keep the category so several receipts for the same budget line go in quickly.
        setForm((f) => ({ ...EMPTY, category_id: f.category_id }))
        descRef.current?.focus()
      },
    )
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Add expense"
        
        subtitle="Counts against the budget as soon as you add it, dated today."
      />
      <form onSubmit={submit} noValidate className="flex flex-1 flex-col px-5 pb-5 pt-4" aria-describedby={disabled ? 'expense-lock' : undefined}>
        <fieldset disabled={disabled} className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <Field label="Description" error={errors.description}>
            {(id) => (
              <Input
                id={id}
                ref={descRef}
                value={form.description}
                onChange={set('description')}
                placeholder="e.g. Flyer printing"
                maxLength={200}
                aria-invalid={!!errors.description}
                autoComplete="off"
              />
            )}
          </Field>
          <Field label="Amount" error={errors.amount}>
            {(id) => (
              <span className="relative block">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-faint">$</span>
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={set('amount')}
                  placeholder="0.00"
                  className="tabular pl-7"
                  aria-invalid={!!errors.amount}
                />
              </span>
            )}
          </Field>
          <Field label="Category" error={errors.category_id}>
            {(id) => (
              <Select id={id} value={form.category_id} onChange={set('category_id')} aria-invalid={!!errors.category_id}>
                <option value="">Choose a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({moneySmart(c.remaining)} left)
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Event (optional)">
            {(id) => (
              <Select id={id} value={form.event_id} onChange={set('event_id')}>
                <option value="">No event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Vendor (optional)" hint={form.vendor_id ? 'Sample vendor, not SBU-verified' : undefined}>
            {(id) => (
              <Select id={id} value={form.vendor_id} onChange={set('vendor_id')}>
                <option value="">No vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </fieldset>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
          <Button type="submit" loading={pending} disabled={disabled}>
            {!pending && <Plus className="size-4" aria-hidden />}
            Add expense
          </Button>
          <AnimatePresence>
            {draftAmount > 0 && draftCategory && !disabled && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={spring}
                className="text-[12px] text-faint"
              >
                {categories.find((c) => c.id === draftCategory)?.name} would be at{' '}
                <span className="tabular text-muted">{moneySmart(previewSpent)}</span> of{' '}
                <span className="tabular text-muted">{moneySmart(previewPlanned)}</span>
              </motion.span>
            )}
          </AnimatePresence>
          {disabled && (
            <p id="expense-lock" className="flex items-center gap-1.5 text-[12px] text-muted">
              <Lock className="size-3.5" aria-hidden />
              {READ_ONLY_REASON}
            </p>
          )}
        </div>
        {error && <ErrorState compact error={error} className="mt-3" />}
      </form>
    </Card>
  )
}
