import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { spring } from '@/lib/motion'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { splitServices } from './shared'

// Vendor (or nothing, for a new one) -> editable draft
export function toDraft(v) {
  return {
    name: v?.name ?? '',
    category: v?.category ?? '',
    contact_name: v?.contact_name ?? '',
    email: v?.email ?? '',
    phone: v?.phone ?? '',
    website: v?.website ?? '',
    services: [...(v?.services ?? [])],
    estimated_cost: v?.estimated_cost ?? '',
    notes: v?.notes ?? '',
  }
}

// Draft -> VendorIn / VendorUpdate body
export function toBody(d) {
  return {
    name: d.name.trim(),
    category: d.category.trim(),
    contact_name: d.contact_name.trim(),
    email: d.email.trim(),
    phone: d.phone.trim(),
    website: d.website.trim(),
    services: d.services,
    estimated_cost: d.estimated_cost === '' ? 0 : Number(d.estimated_cost),
    notes: d.notes.trim(),
  }
}

export function validate(d) {
  const errors = {}
  if (!d.name.trim()) errors.name = 'Give the vendor a name.'
  else if (d.name.trim().length > 120) errors.name = 'Keep the name under 120 characters.'
  if (!d.category.trim()) errors.category = 'Pick or type a category.'
  if (d.estimated_cost !== '' && (Number.isNaN(Number(d.estimated_cost)) || Number(d.estimated_cost) < 0))
    errors.estimated_cost = 'Use a positive number.'
  if (d.email.trim() && !/^\S+@\S+\.\S+$/.test(d.email.trim())) errors.email = 'That email looks off.'
  return errors
}

// Chips you can add with Enter or comma, and remove with their x (or Backspace on an empty input).
function ServicesInput({ id, value, onChange }) {
  const [text, setText] = useState('')
  const add = (raw) => {
    const next = splitServices(raw).filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    if (next.length) onChange([...value, ...next])
    setText('')
  }
  return (
    <div className="rounded-lg border border-line bg-ink-850 p-1.5 transition-colors hover:border-line-strong focus-within:border-copper">
      <ul className="flex flex-wrap gap-1.5" aria-label="Services added">
        <AnimatePresence initial={false}>
          {value.map((s) => (
            <motion.li
              key={s}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.15, layout: spring }}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-ink-800 py-0.5 pl-2 pr-1 text-[12.5px] text-fg"
            >
              {s}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== s))}
                className="grid size-5 place-items-center rounded text-faint hover:bg-ink-900 hover:text-fg"
                aria-label={`Remove ${s}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        <li className="min-w-[140px] flex-1">
          <input
            id={id}
            value={text}
            onChange={(e) => {
              const t = e.target.value
              if (t.includes(',')) add(t)
              else setText(t)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(text)
              } else if (e.key === 'Backspace' && !text && value.length) {
                onChange(value.slice(0, -1))
              }
            }}
            onBlur={() => text.trim() && add(text)}
            placeholder={value.length ? 'Add another…' : 'e.g. Hot buffet, Delivery'}
            className="h-7 w-full bg-transparent px-1.5 text-[13.5px] text-fg placeholder:text-faint/70 focus:outline-none"
          />
        </li>
      </ul>
    </div>
  )
}

// Shared by the add dialog and the detail sheet. Controlled: pass draft + onChange(patch).
export function VendorFields({ draft, onChange, errors = {}, categories = [], autoFocus = false }) {
  const listId = useId()
  const set = (k) => (e) => onChange({ [k]: e.target.value })
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
      <Field label="Name" error={errors.name} className="col-span-2">
        {(id) => (
          <Input id={id} value={draft.name} onChange={set('name')} maxLength={120} autoFocus={autoFocus} placeholder="Campus Bites Catering" aria-invalid={!!errors.name} />
        )}
      </Field>
      <Field label="Category" error={errors.category}>
        {(id) => (
          <>
            <Input id={id} list={listId} value={draft.category} onChange={set('category')} placeholder="Food" aria-invalid={!!errors.category} />
            <datalist id={listId}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="Estimated cost" error={errors.estimated_cost}>
        {(id) => (
          <span className="relative block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-faint" aria-hidden>
              $
            </span>
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              min="0"
              step="10"
              value={draft.estimated_cost}
              onChange={set('estimated_cost')}
              className="tabular pl-7"
              placeholder="0"
              aria-invalid={!!errors.estimated_cost}
            />
          </span>
        )}
      </Field>
      <Field label="Contact name" className="col-span-2">
        {(id) => <Input id={id} value={draft.contact_name} onChange={set('contact_name')} autoComplete="off" />}
      </Field>
      <Field label="Email" error={errors.email}>
        {(id) => <Input id={id} type="email" value={draft.email} onChange={set('email')} autoComplete="off" aria-invalid={!!errors.email} />}
      </Field>
      <Field label="Phone">
        {(id) => <Input id={id} type="tel" value={draft.phone} onChange={set('phone')} autoComplete="off" />}
      </Field>
      <Field label="Website" className="col-span-2">
        {(id) => <Input id={id} value={draft.website} onChange={set('website')} placeholder="example.com" autoComplete="off" />}
      </Field>
      <Field label="Services" hint="Press Enter or type a comma to add each one." className="col-span-2">
        {(id) => <ServicesInput id={id} value={draft.services} onChange={(services) => onChange({ services })} />}
      </Field>
      <Field label="Notes" className="col-span-2">
        {(id) => <Textarea id={id} rows={3} value={draft.notes} onChange={set('notes')} placeholder="Lead times, delivery details, dietary options…" />}
      </Field>
    </div>
  )
}
