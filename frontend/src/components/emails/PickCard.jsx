import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { CalendarClock, CalendarDays, Info, Mail, Megaphone, UtensilsCrossed } from 'lucide-react'
import { spring } from '@/lib/motion'
import { shortDate } from '@/lib/format'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { StepDot } from './Stepper'

export const TEMPLATE_META = {
  event_invitation: { icon: Megaphone, hint: "Goes to your club's member list" },
  catering_quote: { icon: UtensilsCrossed, hint: 'Asks a vendor for a quote' },
  meeting_reminder: { icon: CalendarClock, hint: 'Goes to the e-board with an agenda' },
}

const expand = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
}

function TemplateOption({ t, selected, onSelect }) {
  const meta = TEMPLATE_META[t.key] ?? { icon: Mail, hint: '' }
  const Icon = meta.icon
  return (
    <label
      className={clsx(
        'relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-copper',
        !selected && 'hover:bg-ink-850',
      )}
    >
      {selected && <motion.span layoutId="email-template" className="absolute inset-0 bg-ink-800" transition={spring} />}
      {selected && <motion.span layoutId="email-template-bar" className="absolute inset-y-0 left-0 w-0.5 bg-copper" transition={spring} />}
      <input
        type="radio"
        name="email-template"
        value={t.key}
        checked={selected}
        onChange={() => onSelect(t.key)}
        className="sr-only"
      />
      <Icon className={clsx('relative size-4 shrink-0', selected ? 'text-fg' : 'text-faint')} aria-hidden />
      <span className="relative min-w-0 flex-1">
        <span className={clsx('block text-[13.5px] font-medium', selected ? 'text-fg' : 'text-muted')}>{t.name}</span>
        {meta.hint && <span className="block truncate text-[12px] text-faint">{meta.hint}</span>}
      </span>
      <span
        className={clsx(
          'relative grid size-4 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors',
          selected ? 'ring-copper' : 'ring-line-strong',
        )}
        aria-hidden
      >
        {selected && <span className="size-2 rounded-full bg-copper" />}
      </span>
    </label>
  )
}

export const PickCard = forwardRef(function PickCard(
  { clubId, templatesQ, eventsQ, vendorsQ, form, setForm, events, vendors, onGenerate, generating, generateError, active, done, className },
  ref,
) {
  const tpl = form.template
  const needsEvent = tpl === 'event_invitation' || tpl === 'catering_quote'
  const needsVendor = tpl === 'catering_quote'
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const selectedVendor = vendors.find((v) => String(v.id) === String(form.vendorId))

  const missing =
    (needsEvent && !form.eventId && 'Pick an event to generate this email.') ||
    (needsVendor && !form.vendorId && 'Pick a vendor to generate this email.') ||
    null

  return (
    <Card ref={ref} className={clsx('scroll-mt-4 pb-5', className)} spotlight={false}>
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            <StepDot n={1} active={active} done={done} />
            Pick a template
          </span>
        }
        subtitle="ClubOS fills it in from your club's data."
      />

      <div className="mt-4 space-y-4 px-5">
        {templatesQ.isPending ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading templates">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[52px] rounded-lg" />
            ))}
          </div>
        ) : templatesQ.isError ? (
          <ErrorState compact error={templatesQ.error} onRetry={templatesQ.refetch} />
        ) : (
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">Template</legend>
            <div className="divide-y divide-line overflow-hidden rounded-lg ring-1 ring-inset ring-line">
              {(templatesQ.data ?? []).map((t) => (
                <TemplateOption key={t.key} t={t} selected={tpl === t.key} onSelect={(key) => set({ template: key })} />
              ))}
            </div>
          </fieldset>
        )}

        <AnimatePresence initial={false}>
          {needsEvent && (
            <motion.div key="event" {...expand} className="-mx-1 overflow-hidden px-1 py-0.5">
              {eventsQ.isPending ? (
                <Skeleton className="mt-5 h-10 rounded-lg" />
              ) : eventsQ.isError ? (
                <ErrorState compact error={eventsQ.error} onRetry={eventsQ.refetch} />
              ) : events.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No events yet"
                  hint="Invitations and quotes are built from an event. Create one first."
                  action={
                    <Link to={`/c/${clubId}/events`} className="text-xs font-medium text-copper-soft hover:underline">
                      Go to events
                    </Link>
                  }
                />
              ) : (
                <Field label="Event">
                  {(id) => (
                    <Select id={id} value={form.eventId ?? ''} onChange={(e) => set({ eventId: e.target.value })}>
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}, {shortDate(e.date)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
            </motion.div>
          )}

          {needsVendor && (
            <motion.div key="vendor" {...expand} className="-mx-1 overflow-hidden px-1 py-0.5">
              {vendorsQ.isPending ? (
                <Skeleton className="mt-5 h-10 rounded-lg" />
              ) : vendorsQ.isError ? (
                <ErrorState compact error={vendorsQ.error} onRetry={vendorsQ.refetch} />
              ) : vendors.length === 0 ? (
                <p className="text-xs text-faint">No vendors yet. Add one on the Vendors screen first.</p>
              ) : (
                <Field label="Vendor">
                  {(id) => (
                    <>
                      <Select id={id} value={form.vendorId ?? ''} onChange={(e) => set({ vendorId: e.target.value })}>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.category})
                          </option>
                        ))}
                      </Select>
                      {selectedVendor?.is_sample && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-faint">
                          <Info className="size-3.5 shrink-0" aria-hidden />
                          Sample vendor, not SBU-verified
                        </p>
                      )}
                    </>
                  )}
                </Field>
              )}
            </motion.div>
          )}

          {tpl === 'meeting_reminder' && (
            <motion.div key="meeting" {...expand} className="-mx-1 overflow-hidden px-1 py-0.5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Meeting date" hint="Leave empty for today">
                  {(id) => (
                    <Input id={id} type="date" value={form.meetingDate} onChange={(e) => set({ meetingDate: e.target.value })} />
                  )}
                </Field>
                <Field label="Time">
                  {(id) => (
                    <Input id={id} type="time" value={form.meetingTime} onChange={(e) => set({ meetingTime: e.target.value })} />
                  )}
                </Field>
                <Field label="Room" className="col-span-2">
                  {(id) => (
                    <Input
                      id={id}
                      value={form.meetingLocation}
                      maxLength={120}
                      onChange={(e) => set({ meetingLocation: e.target.value })}
                    />
                  )}
                </Field>
              </div>
              <p className="mt-2 text-xs text-faint">Upcoming events and open tasks become the agenda.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <Field label="Extra note (optional)" hint={`Added before the sign-off. ${form.extraNote.length}/1000`}>
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              maxLength={1000}
              value={form.extraNote}
              placeholder="For example: bring a printed resume."
              onChange={(e) => set({ extraNote: e.target.value })}
            />
          )}
        </Field>

        {generateError && <ErrorState compact error={generateError} />}

        <div>
          <Button
            className="w-full"
            loading={generating}
            disabled={!!missing || templatesQ.isPending || templatesQ.isError}
            onClick={onGenerate}
          >
            {generating ? 'Filling in the details' : 'Generate email'}
          </Button>
          {missing && <p className="mt-1.5 text-center text-xs text-faint">{missing}</p>}
        </div>
      </div>
    </Card>
  )
})
