import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Lock, Receipt, Store, Trash2 } from 'lucide-react'
import { shortDate } from '@/lib/format'
import { spring } from '@/lib/motion'
import { Card, CardHeader } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/States'
import { READ_ONLY_REASON, moneySmart } from './financeUtils'

function ExpenseRow({ expense, category, eventName, vendorName, canManage, onDelete, fresh }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={spring}
      className="group relative flex items-center gap-3 px-5 py-3"
    >
      {fresh && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-copper/[0.08]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2, delay: 0.6, ease: 'easeOut' }}
        />
      )}
      <Avatar user={expense.created_by} size={28} />
      <div className="relative min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-fg">{expense.description}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-faint">
          {category && <span className="text-muted">{category.name}</span>}
          {eventName && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <CalendarDays className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{eventName}</span>
            </span>
          )}
          {vendorName && (
            <span className="inline-flex items-center gap-1" title="Sample vendor, not SBU-verified">
              <Store className="size-3" aria-hidden />
              {vendorName}
            </span>
          )}
          <span>{expense.created_by?.name ?? 'Unknown'}</span>
          <span>{shortDate(expense.spent_on)}</span>
        </div>
      </div>
      <span className="tabular relative w-20 shrink-0 text-right text-[14px] font-semibold text-fg">{moneySmart(expense.amount)}</span>
      {canManage ? (
        <button
          type="button"
          onClick={() => onDelete(expense)}
          aria-label={`Delete expense ${expense.description}`}
          title="Delete expense"
          className="relative grid size-8 shrink-0 place-items-center rounded-md text-faint transition hover:bg-ink-700 hover:text-bad"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="grid size-8 shrink-0 place-items-center text-faint" title={READ_ONLY_REASON}>
          <Lock className="size-3.5" aria-hidden />
          <span className="sr-only">{READ_ONLY_REASON}</span>
        </span>
      )}
    </motion.li>
  )
}

export function RecentExpenses({ expenses, categories, events, vendors, canManage, onDelete, deleting, freshId }) {
  // Target stays set while the dialog animates out, so its content doesn't blank mid-exit.
  const [target, setTarget] = useState(null)
  const [open, setOpen] = useState(false)
  const ask = (x) => {
    setTarget(x)
    setOpen(true)
  }
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const eventName = new Map(events.map((e) => [e.id, e.name]))
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]))
  const shown = target
  const confirmCategory = shown ? categoryById.get(shown.category_id) : null

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader
        title="Recent expenses"
        subtitle={expenses.length ? `The latest ${expenses.length}, newest first` : undefined}
        className="pb-4"
      />
      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          hint={canManage ? 'Log one with Add expense and it lands here.' : 'Expenses the treasurer logs will show up here.'}
          className="border-t border-line"
        />
      ) : (
        <ul className="max-h-[440px] flex-1 divide-y divide-line overflow-y-auto overflow-x-hidden border-t border-line">
          <AnimatePresence initial={false}>
            {expenses.map((x) => (
              <ExpenseRow
                key={x.id}
                expense={x}
                category={categoryById.get(x.category_id)}
                eventName={x.event_id ? eventName.get(x.event_id) : null}
                vendorName={x.vendor_id ? vendorName.get(x.vendor_id) : null}
                canManage={canManage}
                fresh={x.id === freshId}
                onDelete={ask}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this expense?"
        description="This can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="secondary"
              className="text-bad"
              loading={deleting}
              onClick={() => onDelete(target, () => setOpen(false))}
            >
              {!deleting && <Trash2 className="size-4" aria-hidden />}
              Delete expense
            </Button>
          </>
        }
      >
        {shown && (
          <div className="rounded-lg border border-line bg-ink-850 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[14px] font-medium text-fg">{shown.description}</span>
              <span className="tabular shrink-0 text-[15px] font-semibold">{moneySmart(shown.amount)}</span>
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {confirmCategory?.name ?? 'Its category'} gets {moneySmart(shown.amount)} back.
            </p>
          </div>
        )}
      </Dialog>
    </Card>
  )
}
