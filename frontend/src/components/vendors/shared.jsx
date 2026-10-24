import clsx from 'clsx'
import { Camera, CheckCircle2, CircleDashed, Cookie, FlaskConical, Send, Shirt, Speaker, Store, Users, UtensilsCrossed } from 'lucide-react'

// Query keys for this screen. All start with ['club', id] so one club invalidate refreshes them.
export const vendorKeys = {
  all: (clubId) => ['club', String(clubId), 'vendors'],
  list: (clubId, category) => ['club', String(clubId), 'vendors', 'list', category || 'all'],
  detail: (clubId, id) => ['club', String(clubId), 'vendors', 'detail', String(id)],
  eventOptions: (clubId) => ['club', String(clubId), 'vendors', 'event-options'],
}

// EventVendorLink.status enum from the backend.
export const LINK_STATUSES = ['Considering', 'Quote Requested', 'Booked']

const LINK_STATUS = {
  Considering: { icon: CircleDashed, className: 'text-muted bg-white/5 ring-white/10' },
  'Quote Requested': { icon: Send, className: 'text-info bg-info/10 ring-info/25' },
  Booked: { icon: CheckCircle2, className: 'text-ok bg-ok/10 ring-ok/25' },
}

// Status is text + icon, never color alone.
export function LinkStatusPill({ status, className }) {
  const s = LINK_STATUS[status] ?? LINK_STATUS.Considering
  const Icon = s.icon
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        s.className,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {status}
    </span>
  )
}

const CATEGORY_ICON = {
  food: UtensilsCrossed,
  catering: UtensilsCrossed,
  desserts: Cookie,
  merchandise: Shirt,
  photography: Camera,
  equipment: Speaker,
}

export function categoryIcon(category) {
  return CATEGORY_ICON[String(category ?? '').toLowerCase()] ?? Store
}

export function sampleText(vendor) {
  return vendor?.is_sample !== false ? 'Sample vendor, not SBU-verified' : 'Added by your club, not SBU-verified'
}

// Required label: every seeded vendor is a sample. Club-added ones are real entries but still not SBU-verified.
export function SampleLabel({ vendor, className }) {
  const sample = vendor?.is_sample !== false
  const Icon = sample ? FlaskConical : Users
  return (
    <span
      title={sample ? 'Demo data: a made-up business, not an SBU-approved vendor' : 'Added by your club. ClubOS does not verify vendors.'}
      className={clsx('inline-flex items-center gap-1.5 text-[12px] text-faint', className)}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {sampleText(vendor)}
    </span>
  )
}

// "a, b , c" -> ["a","b","c"]
export function splitServices(text) {
  return String(text ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function quoteUrl(clubId, vendor) {
  const params = new URLSearchParams({ template: 'catering_quote', vendor_id: String(vendor.id) })
  // The catering_quote template also needs an event; pass the most relevant linked one when there is one.
  const links = vendor.events ?? []
  const ev = links.find((e) => e.status === 'Quote Requested') ?? links.find((e) => e.status === 'Considering') ?? links[0]
  if (ev) params.set('event_id', String(ev.id))
  return `/c/${clubId}/emails?${params.toString()}`
}
