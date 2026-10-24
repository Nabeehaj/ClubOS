import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Save } from 'lucide-react'
import { keys } from '@/lib/queryClient'
import { money } from '@/lib/format'
import { spring } from '@/lib/motion'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'
import { AttachToEvent } from './AttachToEvent'
import { VendorFields, toBody, toDraft, validate } from './VendorForm'
import { LinkStatusPill, sampleText, vendorKeys } from './shared'

// Sections are separated by hairlines inside one sheet, not boxed.
function Section({ title, hint, children }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className="font-display text-[14px] font-semibold text-fg">{title}</h3>
      {hint && <p className="mt-0.5 text-[12.5px] text-faint">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function SheetContent({ vendor, clubId, api, categories, onRequestQuote }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState(() => toDraft(vendor))
  const [errors, setErrors] = useState({})
  const links = vendor.events ?? []

  const dirty = JSON.stringify(toBody(draft)) !== JSON.stringify(toBody(toDraft(vendor)))

  const save = useMutation({
    mutationFn: (body) => api.vendors.update(vendor.id, body),
    onSuccess: (saved) => {
      qc.setQueryData(vendorKeys.detail(clubId, vendor.id), saved)
      setDraft(toDraft(saved))
      toast(`Saved ${saved.name}`)
    },
    onError: (err) => toast.error(err),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.club(clubId) }),
  })

  const submit = (e) => {
    e.preventDefault()
    const errs = validate(draft)
    setErrors(errs)
    if (Object.keys(errs).length === 0) save.mutate(toBody(draft))
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div>
        <dl className="grid grid-cols-3 gap-4">
          <div>
            <dt className="text-[12px] text-faint">Category</dt>
            <dd className="mt-0.5 truncate text-[14px] font-medium text-fg">{vendor.category}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-faint">Estimate</dt>
            <dd className="tabular mt-0.5 text-[14px] font-medium text-fg">{money(vendor.estimated_cost)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-faint">Linked events</dt>
            <dd className="tabular mt-0.5 text-[14px] font-medium text-fg">{links.length}</dd>
          </div>
        </dl>
        {/* The sample label is the sheet's description, right under the title. */}
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => onRequestQuote(vendor)}>
            <Mail className="size-3.5" aria-hidden />
            Request quote
          </Button>
        </div>
      </div>

      <Section title="Linked events">
        {links.length === 0 ? (
          <p className="text-[13px] text-faint">Not on any event yet. Attach it below.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            <AnimatePresence initial={false}>
              {links.map((e) => (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, layout: spring }}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{e.name}</span>
                  <span className="tabular w-24 shrink-0 text-right text-[12.5px] text-muted">
                    {e.quoted_amount == null ? 'No quote' : money(e.quoted_amount)}
                  </span>
                  <motion.span key={e.status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="w-[124px] shrink-0 text-right">
                    <LinkStatusPill status={e.status} />
                  </motion.span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Section>

      <Section title="Attach to event" hint="Pick an event the vendor is already on to change its status or quote.">
        <AttachToEvent vendor={vendor} clubId={clubId} api={api} />
      </Section>

      <Section title="Details">
        <form id={`vendor-${vendor.id}-form`} onSubmit={submit} noValidate>
          <VendorFields
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            errors={errors}
            categories={categories}
          />
        </form>
      </Section>

      {/* Save bar appears only when there is something to save */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="sticky bottom-0 -mx-6 -mb-5 flex items-center justify-between gap-3 border-t border-line bg-ink-900 px-6 py-3"
          >
            <span className="text-[12.5px] text-muted">Unsaved changes</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setDraft(toDraft(vendor))
                  setErrors({})
                }}
              >
                Discard
              </Button>
              <Button size="sm" type="submit" form={`vendor-${vendor.id}-form`} loading={save.isPending}>
                {!save.isPending && <Save className="size-3.5" aria-hidden />}
                Save changes
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Right-side sheet: vendor detail + edit + attach to event. `seed` is the card's copy so it opens instantly.
// vendorId stays set while the sheet animates closed, so the content doesn't flash to a skeleton.
export function VendorSheet({ open, vendorId, seed, onOpenChange, clubId, api, categories, onRequestQuote }) {
  const q = useQuery({
    queryKey: vendorKeys.detail(clubId, vendorId),
    queryFn: () => api.vendors.get(vendorId),
    enabled: open && vendorId != null,
    placeholderData: seed ?? undefined,
  })
  const vendor = q.data

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={vendor?.name ?? 'Vendor'}
      description={vendor ? sampleText(vendor) : undefined}
    >
      {vendor ? (
        <SheetContent
          key={vendor.id}
          vendor={vendor}
          clubId={clubId}
          api={api}
          categories={categories}
          onRequestQuote={onRequestQuote}
        />
      ) : q.isError ? (
        q.error?.status === 404 ? (
          <EmptyState title="Vendor not found" hint="It may have been removed or belong to another club." />
        ) : (
          <ErrorState error={q.error} onRetry={q.refetch} />
        )
      ) : (
        <SkeletonRows rows={6} />
      )}
    </Dialog>
  )
}
