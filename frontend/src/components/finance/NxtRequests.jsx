import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Landmark, Lock, Plus, StepForward } from 'lucide-react'
import clsx from 'clsx'
import { keys } from '@/lib/queryClient'
import { shortDate } from '@/lib/format'
import { spring } from '@/lib/motion'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { SimulatedBadge, StatusPill } from '@/components/ui/Badges'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'
import { READ_ONLY_REASON, financeKey, moneySmart } from './financeUtils'

const FLOW = ['Draft', 'Submitted Externally', 'Pending', 'Approved']
const STEP_LABEL = { Draft: 'Draft', 'Submitted Externally': 'Submitted', Pending: 'Pending', Approved: 'Approved' }

// Four-dot progress along the NXT flow. Text label is the StatusPill next to it.
function FlowDots({ status }) {
  const denied = status === 'Denied'
  const at = denied ? FLOW.length - 1 : FLOW.indexOf(status)
  return (
    <ol className="flex items-center gap-1" aria-label={`Step ${Math.max(at, 0) + 1} of ${FLOW.length}`}>
      {FLOW.map((s, i) => (
        <li key={s} className="flex items-center gap-1" title={STEP_LABEL[s]}>
          {i > 0 && (
            <span className={clsx('h-px w-3 transition-colors duration-300', i <= at ? 'bg-copper' : 'bg-ink-600')} />
          )}
          <span
            className={clsx(
              'block size-1.5 rounded-full transition-colors duration-300',
              denied && i === at ? 'bg-bad' : i <= at ? 'bg-copper' : 'bg-ink-600',
            )}
          />
        </li>
      ))}
    </ol>
  )
}

function RequestRow({ r, eventName, canManage, onSimulate, simulating }) {
  const final = r.status === 'Approved' || r.status === 'Denied'
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring}
      className="flex items-center gap-4 px-5 py-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] font-medium text-fg">{r.title}</span>
          <span className="tabular shrink-0 text-[14px] font-semibold text-fg">{moneySmart(r.amount)}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
          <motion.span key={r.status} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <StatusPill status={r.status} />
          </motion.span>
          <FlowDots status={r.status} />
          {r.reference_number && <span className="font-mono text-[11.5px] text-muted">{r.reference_number}</span>}
          {eventName && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <CalendarDays className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{eventName}</span>
            </span>
          )}
          {r.submitted_on && <span>sent {shortDate(r.submitted_on)}</span>}
        </div>
      </div>
      {!final &&
        (canManage ? (
          <Button
            size="sm"
            variant="secondary"
            loading={simulating}
            onClick={() => onSimulate(r)}
            aria-label={`Simulate next step for ${r.title}`}
            className="shrink-0"
          >
            {!simulating && <StepForward className="size-3.5" aria-hidden />}
            Simulate next step
          </Button>
        ) : (
          <span className="grid size-8 shrink-0 place-items-center text-faint/50" title={READ_ONLY_REASON}>
            <Lock className="size-3.5" aria-hidden />
            <span className="sr-only">{READ_ONLY_REASON}</span>
          </span>
        ))}
    </motion.li>
  )
}

const EMPTY = { title: '', amount: '', event_id: '', vendor_id: '', notes: '' }

function NewRequestDialog({ open, onOpenChange, events, vendors, onCreate, pending, error }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }
  const submit = (e) => {
    e.preventDefault()
    const amount = Number(form.amount)
    const next = {}
    if (!form.title.trim()) next.title = 'Give the request a title'
    if (!(amount > 0)) next.amount = 'Enter an amount above $0'
    setErrors(next)
    if (Object.keys(next).length) return
    onCreate(
      {
        title: form.title.trim(),
        amount: Math.round(amount * 100) / 100,
        event_id: form.event_id ? Number(form.event_id) : null,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        notes: form.notes.trim(),
      },
      () => setForm(EMPTY),
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New NXT financial request"
      description="Saved as a draft in the simulated NXT system. Use “Simulate next step” to move it along."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="nxt-request-form" loading={pending}>
            Create draft
          </Button>
        </>
      }
    >
      <form id="nxt-request-form" onSubmit={submit} noValidate className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Field label="Title" error={errors.title} className="col-span-2">
          {(id) => (
            <Input id={id} value={form.title} onChange={set('title')} maxLength={200} placeholder="e.g. Catering for Networking Night" aria-invalid={!!errors.title} />
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
        <Field label="Vendor (optional)" className="col-span-2" hint="Sample vendors, not SBU-verified">
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
        <Field label="Notes (optional)" className="col-span-2">
          {(id) => <Textarea id={id} rows={3} value={form.notes} onChange={set('notes')} placeholder="Anything the reviewer should know" />}
        </Field>
        {error && <ErrorState compact error={error} className="col-span-2" />}
      </form>
    </Dialog>
  )
}

export function NxtRequests({ requests, events, vendors, clubId, api, canManage }) {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const eventName = new Map(events.map((e) => [e.id, e.name]))
  const summaryKey = financeKey(clubId, 'summary')

  const replaceRequest = (r) =>
    qc.setQueryData(summaryKey, (s) =>
      s && { ...s, financial_requests: s.financial_requests.map((x) => (x.id === r.id ? r : x)) },
    )

  const simulate = useMutation({
    mutationFn: (r) => api.finance.simulateRequest(r.id),
    onSuccess: (r) => {
      replaceRequest(r)
      qc.invalidateQueries({ queryKey: keys.club(clubId) })
      toast(`NXT (simulated): “${r.title}” is now ${r.status}`)
    },
    onError: (err) => toast.error(err),
  })

  const create = useMutation({
    mutationFn: (body) => api.finance.createRequest(body),
    onSuccess: (r) => {
      qc.setQueryData(summaryKey, (s) => s && { ...s, financial_requests: [...s.financial_requests, r] })
      qc.invalidateQueries({ queryKey: keys.club(clubId) })
      toast(`Draft “${r.title}” created`)
    },
  })

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader
        title="NXT financial requests"
        subtitle="Funding requests to the university"
        className="pb-4"
        action={
          <div className="flex items-center gap-2">
            <SimulatedBadge />
            <Button
              size="sm"
              variant="secondary"
              disabled={!canManage}
              title={canManage ? undefined : READ_ONLY_REASON}
              onClick={() => {
                create.reset()
                setCreating(true)
              }}
            >
              <Plus className="size-3.5" aria-hidden />
              New request
            </Button>
          </div>
        }
      />
      {requests.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No funding requests yet"
          hint={canManage ? 'Start one with New request.' : 'Requests the treasurer drafts will show up here.'}
          className="border-t border-line"
        />
      ) : (
        <ul className="max-h-[440px] flex-1 divide-y divide-line overflow-y-auto overflow-x-hidden border-t border-line">
          <AnimatePresence initial={false}>
            {requests.map((r) => (
              <RequestRow
                key={r.id}
                r={r}
                eventName={r.event_id ? eventName.get(r.event_id) : null}
                canManage={canManage}
                simulating={simulate.isPending && simulate.variables?.id === r.id}
                onSimulate={simulate.mutate}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
      {!canManage && (
        <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-[12px] text-muted">
          <Lock className="size-3.5" aria-hidden /> {READ_ONLY_REASON}
        </p>
      )}
      <NewRequestDialog
        open={creating}
        onOpenChange={setCreating}
        events={events}
        vendors={vendors}
        pending={create.isPending}
        error={create.error}
        onCreate={(body, reset) =>
          create.mutate(body, {
            onSuccess: () => {
              reset()
              setCreating(false)
            },
          })
        }
      />
    </Card>
  )
}
