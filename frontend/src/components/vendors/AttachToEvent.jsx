import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { CalendarPlus } from 'lucide-react'
import { keys } from '@/lib/queryClient'
import { shortDate } from '@/lib/format'
import { spring } from '@/lib/motion'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'
import { LINK_STATUSES, LinkStatusPill, vendorKeys } from './shared'

// Segmented radio group for the link status, with a pill that slides between options.
function StatusPicker({ value, onChange, name }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-xs font-medium text-muted">Status</legend>
      <div className="grid grid-cols-3 rounded-lg border border-line bg-ink-850 p-0.5">
        {LINK_STATUSES.map((s) => {
          const active = value === s
          return (
            <label
              key={s}
              className={clsx(
                'relative flex h-8 cursor-pointer items-center justify-center rounded-md text-[12.5px] font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-copper',
                active ? 'text-fg' : 'text-muted hover:text-fg',
              )}
            >
              <input type="radio" name={name} value={s} checked={active} onChange={() => onChange(s)} className="sr-only" />
              {active && (
                <motion.span
                  layoutId={`${name}-pill`}
                  className="absolute inset-0 rounded-md border border-line-strong bg-ink-800"
                  transition={spring}
                  aria-hidden
                />
              )}
              <span className="relative">{s}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

// Patch a vendor's events[] in every cached copy (list per category + detail) so the change shows instantly.
function patchVendorLinks(qc, clubId, vendorId, link) {
  const apply = (v) => {
    if (!v || v.id !== vendorId) return v
    const events = v.events ?? []
    const exists = events.some((e) => e.id === link.id)
    return { ...v, events: exists ? events.map((e) => (e.id === link.id ? { ...e, ...link } : e)) : [...events, link] }
  }
  qc.setQueriesData({ queryKey: vendorKeys.all(clubId) }, (data) => (Array.isArray(data) ? data.map(apply) : apply(data)))
}

export function AttachToEvent({ vendor, clubId, api }) {
  const qc = useQueryClient()
  const events = useQuery({
    queryKey: vendorKeys.eventOptions(clubId),
    queryFn: () => api.events.list({ upcoming_only: true }),
  })

  const options = useMemo(() => {
    const list = Array.isArray(events.data) ? [...events.data] : []
    // Keep events the vendor is already linked to selectable even if they are in the past.
    for (const l of vendor.events ?? []) if (!list.some((e) => e.id === l.id)) list.push({ id: l.id, name: l.name })
    return list
  }, [events.data, vendor.events])

  const defaultQuote = vendor.estimated_cost ? String(vendor.estimated_cost) : ''
  const [eventId, setEventId] = useState('')
  const [status, setStatus] = useState('Considering')
  const [quote, setQuote] = useState(defaultQuote)

  const linkFor = (id) => (vendor.events ?? []).find((e) => String(e.id) === String(id))
  const existing = linkFor(eventId)

  // Picking an event the vendor is already on loads its current status and quote, so this doubles as "update".
  const pickEvent = (id) => {
    setEventId(id)
    const link = linkFor(id)
    setStatus(link?.status ?? 'Considering')
    setQuote(link ? (link.quoted_amount == null ? '' : String(link.quoted_amount)) : defaultQuote)
  }

  const attach = useMutation({
    mutationFn: (body) => api.events.addVendor(Number(eventId), body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: vendorKeys.all(clubId) })
      const snapshot = qc.getQueriesData({ queryKey: vendorKeys.all(clubId) })
      const ev = options.find((e) => String(e.id) === String(eventId))
      patchVendorLinks(qc, clubId, vendor.id, {
        id: Number(eventId),
        name: ev?.name ?? 'Event',
        status: body.status,
        quoted_amount: body.quoted_amount,
      })
      return { snapshot, eventName: ev?.name }
    },
    onError: (err, _b, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data))
      toast.error(err)
    },
    onSuccess: (_d, body, ctx) => {
      toast(`${vendor.name} marked ${body.status} for ${ctx?.eventName ?? 'the event'}`)
      pickEvent('')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.club(clubId) }),
  })

  const quoteInvalid = quote !== '' && (Number.isNaN(Number(quote)) || Number(quote) < 0)
  const submit = (e) => {
    e.preventDefault()
    if (!eventId || quoteInvalid) return
    attach.mutate({ vendor_id: vendor.id, status, quoted_amount: quote === '' ? null : Number(quote) })
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label={`Attach ${vendor.name} to an event`}>
      {events.isPending ? (
        <Skeleton className="h-10" />
      ) : events.isError ? (
        <ErrorState compact error={events.error} onRetry={events.refetch} />
      ) : (
        <Field label="Event">
          {(id) => (
            <Select id={id} value={eventId} onChange={(e) => pickEvent(e.target.value)} disabled={options.length === 0}>
              <option value="">{options.length ? 'Choose an event…' : 'No upcoming events'}</option>
              {options.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.date ? `, ${shortDate(ev.date)}` : ''}
                  {(vendor.events ?? []).some((l) => l.id === ev.id) ? ' (linked)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      <StatusPicker value={status} onChange={setStatus} name={`vendor-${vendor.id}-status`} />

      <Field label="Quoted amount" hint="Optional. Leave blank if you don't have a number yet." error={quoteInvalid ? 'Use a positive number.' : undefined}>
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
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className="tabular pl-7"
              aria-invalid={quoteInvalid}
            />
          </span>
        )}
      </Field>

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[12px] text-faint">
          {existing ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Currently <LinkStatusPill status={existing.status} />
            </span>
          ) : (
            'It will show on the event workspace.'
          )}
        </p>
        <Button type="submit" size="sm" loading={attach.isPending} disabled={!eventId || quoteInvalid}>
          {!attach.isPending && <CalendarPlus className="size-3.5" aria-hidden />}
          {existing ? 'Update link' : 'Attach'}
        </Button>
      </div>
    </form>
  )
}
