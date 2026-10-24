import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Plus } from 'lucide-react'
import clsx from 'clsx'
import { money, shortDate, timeRange } from '@/lib/format'
import { spring } from '@/lib/motion'
import { Card } from '@/components/ui/Card'
import { CountUp } from '@/components/ui/CountUp'
import { Meter } from '@/components/ui/Meter'
import { SimulatedBadge, StatusPill, Tag } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'
import { eventKeys, VENDOR_LINK_STATUSES, VENDOR_STATUS } from './eventUtils'
import { useWorkspaceCache } from './useWorkspaceCache'

const linkCls = 'text-[12.5px] font-medium text-muted hover:text-fg'

function Section({ title, extra, action, children, className }) {
  return (
    <section className={clsx('px-5 py-4', className)}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
          {extra}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

// ---------- approvals (simulated university systems) ----------
function SystemRow({ name, status, children, reference }) {
  return (
    <li className="border-t border-line py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-medium text-fg">{name}</span>
        {status ? <StatusPill status={status} /> : <StatusPill status="Not started" />}
      </div>
      {children && <div className="mt-1 text-[12.5px] text-muted">{children}</div>}
      {reference && <div className="mt-0.5 font-mono text-[11.5px] text-faint">{reference}</div>}
    </li>
  )
}

function Approvals({ ws, clubId }) {
  const r = ws.reservation_25live
  const sb = ws.sb_engaged
  const fin = ws.financial_requests ?? []
  const docs = sb?.required_documents ?? []
  const docsDone = docs.filter((d) => d.done).length
  const next = sb?.pending_actions?.[0]

  return (
    <Section
      title="University approvals"
      extra={<SimulatedBadge />}
      action={
        <Link to={`/c/${clubId}/approvals`} className={linkCls}>
          Open approvals
        </Link>
      }
    >
      <ul className="mt-2">
        <SystemRow name="25Live room" status={r?.status} reference={r?.confirmation_number}>
          {r ? (
            <>
              {r.space}
              {r.start_time && <span className="ml-2 text-faint">{timeRange(r.start_time, r.end_time)}</span>}
            </>
          ) : (
            'No room requested yet.'
          )}
        </SystemRow>

        <SystemRow name="SB Engaged" status={sb?.status} reference={sb?.reference_number}>
          {sb ? (
            <>
              <span className="tabular">
                {docsDone} of {docs.length} documents in
              </span>
              {sb.status !== 'Approved' && next && <span className="mt-0.5 block text-faint">Next: {next}</span>}
            </>
          ) : (
            'Event registration not started.'
          )}
        </SystemRow>

        <li className="border-t border-line py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-medium text-fg">NXT funding</span>
            {fin.length === 0 && <StatusPill status="Not started" />}
          </div>
          {fin.length === 0 ? (
            <div className="mt-1 text-[12.5px] text-muted">No funding requests for this event.</div>
          ) : (
            <ul className="mt-1.5 space-y-2">
              {fin.map((f) => (
                <li key={f.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-x-3">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] text-muted">{f.title}</div>
                    <div className="font-mono text-[11.5px] text-faint">{f.reference_number}</div>
                  </div>
                  <span className="tabular text-[12.5px] text-fg">{money(f.amount)}</span>
                  <StatusPill status={f.status} />
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>
    </Section>
  )
}

// ---------- budget ----------
function Budget({ ws, clubId }) {
  const b = ws.budget ?? { planned: 0, spent: 0, remaining: 0, expenses: [] }
  const over = b.remaining < 0
  return (
    <Section
      title="Event budget"
      className="border-t border-line"
      action={
        <Link to={`/c/${clubId}/finance`} className={linkCls}>
          Open finance
        </Link>
      }
    >
      {!b.planned && b.expenses.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-muted">No budget set for this event. The treasurer can add one in Finance.</p>
      ) : (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-muted">
              <span className="font-display tabular text-[20px] font-semibold text-fg">
                <CountUp value={b.spent} format={(n) => money(n)} />
              </span>{' '}
              spent of <span className="tabular">{money(b.planned)}</span>
            </p>
            <span className={clsx('tabular text-[12.5px]', over ? 'text-bad' : 'text-muted')}>
              {over ? `${money(-b.remaining)} over` : `${money(b.remaining)} left`}
            </span>
          </div>
          <Meter
            className="mt-2"
            value={b.spent}
            max={b.planned || b.spent || 1}
            tone="budget"
            height={5}
            label={`${money(b.spent)} of ${money(b.planned)} spent`}
          />
          {b.expenses.length > 0 && (
            <table className="mt-3 w-full text-[12.5px]">
              <caption className="sr-only">Expenses for this event</caption>
              <tbody>
                {b.expenses.map((x) => (
                  <tr key={x.id} className="border-t border-line">
                    <td className="max-w-0 truncate py-1.5 pr-3 text-fg">{x.description}</td>
                    <td className="whitespace-nowrap py-1.5 pr-3 text-faint">{shortDate(x.spent_on)}</td>
                    <td className="tabular whitespace-nowrap py-1.5 text-right text-fg">{money(x.amount, { cents: x.amount % 1 !== 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Section>
  )
}

// ---------- vendors ----------
function VendorStatusTag({ status }) {
  const s = VENDOR_STATUS[status] ?? VENDOR_STATUS.Considering
  const Icon = s.icon
  return (
    <Tag tone={s.tone}>
      <Icon className="size-3" aria-hidden />
      {status}
    </Tag>
  )
}

function VendorStatusMenu({ vendor, onChange }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`${vendor.name}: ${vendor.link_status}. Change status`}
          className="group inline-flex items-center gap-1 rounded-full pr-1 transition-colors hover:bg-ink-800"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={vendor.link_status}
              className="inline-flex"
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={spring}
            >
              <VendorStatusTag status={vendor.link_status} />
            </motion.span>
          </AnimatePresence>
          <ChevronDown className="size-3.5 text-faint transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-48 rounded-xl border border-line bg-ink-850 p-1.5 shadow-lg shadow-black/40"
        >
          {VENDOR_LINK_STATUSES.map((s) => (
            <DropdownMenu.Item
              key={s}
              onSelect={() => s !== vendor.link_status && onChange(s)}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 outline-none data-[highlighted]:bg-ink-800"
            >
              <VendorStatusTag status={s} />
              {s === vendor.link_status && <Check className="size-4 text-copper" aria-label="Current status" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function LinkVendorDialog({ open, onOpenChange, linkedIds, clubId, api, onLink, pending, error }) {
  const vendors = useQuery({ queryKey: eventKeys.vendors(clubId), queryFn: () => api.vendors.list(), enabled: open })
  const options = (vendors.data ?? []).filter((v) => !linkedIds.includes(v.id))
  const [vendorId, setVendorId] = useState(null)
  const [status, setStatus] = useState('Considering')
  const [quote, setQuote] = useState('')
  const selected = options.find((v) => v.id === vendorId)

  const choose = (v) => {
    setVendorId(v.id)
    setQuote(v.estimated_cost ? String(v.estimated_cost) : '')
  }

  const submit = (e) => {
    e.preventDefault()
    if (!selected) return
    const n = quote === '' ? null : Number(quote)
    onLink({ vendor: selected, status, quoted_amount: Number.isFinite(n) ? n : null })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setVendorId(null)
          setStatus('Considering')
          setQuote('')
        }
      }}
      title="Link a vendor"
      description="Pick a vendor from your club's list and say where things stand."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="link-vendor-form" loading={pending} disabled={!selected}>
            Link vendor
          </Button>
        </>
      }
    >
      <form id="link-vendor-form" onSubmit={submit} className="space-y-4">
        {vendors.isPending ? (
          <SkeletonRows rows={3} />
        ) : vendors.isError ? (
          <ErrorState error={vendors.error} onRetry={vendors.refetch} />
        ) : options.length === 0 ? (
          <EmptyState
            title="Every vendor is already linked"
            hint="Add a new vendor on the Vendors screen, then link it here."
            action={
              <Link to={`/c/${clubId}/vendors`} className="mt-1 text-[13px] font-medium text-copper hover:underline">
                Go to vendors
              </Link>
            }
          />
        ) : (
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">Vendor</legend>
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              {options.map((v) => (
                <label
                  key={v.id}
                  className={clsx(
                    'flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-ink-850',
                    vendorId === v.id && 'bg-ink-850',
                  )}
                >
                  <input
                    type="radio"
                    name="vendor"
                    value={v.id}
                    checked={vendorId === v.id}
                    onChange={() => choose(v)}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13.5px] font-medium text-fg">{v.name}</span>
                      <span className="tabular shrink-0 text-[12.5px] text-muted">{money(v.estimated_cost)}</span>
                    </span>
                    <span className="block text-[12px] text-faint">{v.category}</span>
                    {v.is_sample && <span className="block text-[12px] text-faint">Sample vendor, not SBU-verified</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {options.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              {(id) => (
                <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {VENDOR_LINK_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Quoted amount (USD)" hint="Optional">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="0"
                />
              )}
            </Field>
          </div>
        )}
        {error && <ErrorState compact error={error} />}
      </form>
    </Dialog>
  )
}

function Vendors({ ws, clubId, eventId, api }) {
  const cache = useWorkspaceCache(clubId, eventId)
  const [open, setOpen] = useState(false)
  const vendors = ws.vendors ?? []

  const setStatus = useMutation({
    mutationFn: ({ vendor, status }) =>
      api.events.addVendor(eventId, { vendor_id: vendor.id, status, quoted_amount: vendor.quoted_amount ?? null }),
    onMutate: async ({ vendor, status }) => {
      const prev = await cache.begin()
      cache.patch((d) => ({ ...d, vendors: d.vendors.map((v) => (v.id === vendor.id ? { ...v, link_status: status } : v)) }))
      return { prev }
    },
    onSuccess: (_d, { vendor, status }) => toast(`${vendor.name} marked ${status}`),
    onError: (err, _v, ctx) => {
      cache.rollback(ctx?.prev)
      toast.error(err)
    },
    onSettled: () => cache.refresh(),
  })

  const link = useMutation({
    mutationFn: ({ vendor, status, quoted_amount }) =>
      api.events.addVendor(eventId, { vendor_id: vendor.id, status, quoted_amount }),
    onSuccess: (v) => {
      cache.patch((d) => ({ ...d, vendors: [...d.vendors.filter((x) => x.id !== v.id), v] }))
      toast(`${v.name} linked to this event`)
      setOpen(false)
      cache.refresh()
    },
  })

  return (
    <Section
      title="Vendors"
      className="border-t border-line"
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            link.reset()
            setOpen(true)
          }}
        >
          <Plus className="size-3.5" aria-hidden /> Link a vendor
        </Button>
      }
    >
      {vendors.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-muted">No vendors linked yet. Link caterers, photographers or rentals you're talking to.</p>
      ) : (
        <ul className="mt-2">
          <AnimatePresence initial={false}>
            {vendors.map((v) => (
              <motion.li
                key={v.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
                className="flex items-start justify-between gap-3 border-t border-line py-2.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium text-fg">{v.name}</div>
                  <div className="text-[12px] text-muted">
                    {v.category}
                    {v.quoted_amount != null && <span className="tabular ml-2 text-faint">quoted {money(v.quoted_amount)}</span>}
                  </div>
                  {v.is_sample && <div className="text-[12px] text-faint">Sample vendor, not SBU-verified</div>}
                </div>
                <VendorStatusMenu vendor={v} onChange={(status) => setStatus.mutate({ vendor: v, status })} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <LinkVendorDialog
        open={open}
        onOpenChange={setOpen}
        linkedIds={vendors.map((v) => v.id)}
        clubId={clubId}
        api={api}
        onLink={link.mutate}
        pending={link.isPending}
        error={link.error}
      />
    </Section>
  )
}

// One panel, three sections: what the university needs, what it costs, who supplies it.
export function EventLogistics({ ws, clubId, eventId, api, className }) {
  return (
    <Card className={clsx('overflow-hidden', className)}>
      <Approvals ws={ws} clubId={clubId} />
      <Budget ws={ws} clubId={clubId} />
      <Vendors ws={ws} clubId={clubId} eventId={eventId} api={api} />
    </Card>
  )
}
