import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Mail, Phone, User } from 'lucide-react'
import { money } from '@/lib/format'
import { spring } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { LinkStatusPill, SampleLabel, categoryIcon } from './shared'

// One vendor. The whole card opens the detail sheet (a stretched button underneath the content);
// "Request quote" sits above that layer so it stays its own target.
export const VendorCard = forwardRef(function VendorCard({ vendor, onOpen, onRequestQuote }, ref) {
  const Icon = categoryIcon(vendor.category)
  const links = vendor.events ?? []
  const services = vendor.services ?? []

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, layout: spring }}
      className="group relative flex flex-col rounded-xl border border-line bg-ink-900 transition-colors hover:border-line-strong"
      aria-labelledby={`vendor-${vendor.id}-name`}
    >
      <button
        type="button"
        onClick={() => onOpen(vendor)}
        className="absolute inset-0 z-[1] rounded-xl"
        aria-label={`Open details for ${vendor.name}`}
      />

      {/* Identity + estimate */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-muted">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`vendor-${vendor.id}-name`} className="font-display truncate text-[15px] font-semibold text-fg group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">
            {vendor.name}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-muted">{vendor.category}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-[15px] font-semibold text-fg">{money(vendor.estimated_cost)}</div>
          <div className="text-[11.5px] text-faint">estimate</div>
        </div>
      </div>

      <SampleLabel vendor={vendor} className="mx-4 mt-2" />

      {/* Contact */}
      <dl className="mx-4 mt-3 space-y-1 border-t border-line pt-3 text-[12.5px]">
        {vendor.contact_name && (
          <div className="flex items-center gap-2 text-fg">
            <dt className="sr-only">Contact</dt>
            <User className="size-3.5 shrink-0 text-faint" aria-hidden />
            <dd className="truncate">{vendor.contact_name}</dd>
          </div>
        )}
        {vendor.email && (
          <div className="flex items-center gap-2 text-muted">
            <dt className="sr-only">Email</dt>
            <Mail className="size-3.5 shrink-0 text-faint" aria-hidden />
            <dd className="truncate">{vendor.email}</dd>
          </div>
        )}
        {vendor.phone && (
          <div className="flex items-center gap-2 text-muted">
            <dt className="sr-only">Phone</dt>
            <Phone className="size-3.5 shrink-0 text-faint" aria-hidden />
            <dd className="tabular truncate">{vendor.phone}</dd>
          </div>
        )}
        {!vendor.contact_name && !vendor.email && !vendor.phone && <p className="text-faint">No contact details yet</p>}
      </dl>

      {services.length > 0 && (
        <ul className="mx-4 mt-3 flex flex-wrap gap-1" aria-label="Services">
          {services.slice(0, 4).map((s) => (
            <li key={s} className="rounded-md border border-line px-1.5 py-0.5 text-[11.5px] text-muted">
              {s}
            </li>
          ))}
          {services.length > 4 && <li className="px-1 py-0.5 text-[11.5px] text-faint">and {services.length - 4} more</li>}
        </ul>
      )}

      {/* Linked events */}
      <div className="mx-4 mt-3 flex-1 border-t border-line pt-3">
        <p className="mb-1.5 text-[12px] font-medium text-muted">Linked events</p>
        {links.length === 0 ? (
          <p className="text-[12.5px] text-faint">Not on any event yet</p>
        ) : (
          <ul className="divide-y divide-line">
            {links.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-[12.5px]">
                <span className="truncate text-fg">{e.name}</span>
                <LinkStatusPill status={e.status} className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative z-[2] mt-3 flex items-center gap-2 border-t border-line px-4 py-3">
        <Button variant="secondary" size="sm" onClick={() => onRequestQuote(vendor)} aria-label={`Request a quote from ${vendor.name}`}>
          <Mail className="size-3.5" aria-hidden />
          Request quote
        </Button>
      </div>
    </motion.article>
  )
})
