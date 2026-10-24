import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, ShieldCheck } from 'lucide-react'
import { useClub } from '@/lib/club'
import { keys } from '@/lib/queryClient'
import { stagger } from '@/lib/motion'
import { ErrorState, Skeleton, SkeletonRows } from '@/components/ui/States'
import { Tag } from '@/components/ui/Badges'
import { toast } from '@/components/ui/Toast'
import { BudgetPanel } from '@/components/finance/BudgetPanel'
import { AddExpense } from '@/components/finance/AddExpense'
import { RecentExpenses } from '@/components/finance/RecentExpenses'
import { NxtRequests } from '@/components/finance/NxtRequests'
import { financeKey, mergeBudget, moneySmart, withoutExpense } from '@/components/finance/financeUtils'

function FinanceSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading finance">
      <Skeleton className="h-8 w-96" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[124px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <SkeletonRows rows={5} />
        </div>
        <div className="glass rounded-2xl p-5">
          <SkeletonRows rows={3} />
        </div>
      </div>
    </div>
  )
}

export default function Finance() {
  const { clubId, club, api, canManageFinance } = useClub()
  const qc = useQueryClient()
  const summaryKey = financeKey(clubId, 'summary')

  const q = useQuery({ queryKey: summaryKey, queryFn: api.finance.summary })
  // Names for the expense list and the form selects. If these fail, only the optional selects come up empty.
  const eventsQ = useQuery({ queryKey: financeKey(clubId, 'events'), queryFn: () => api.events.list(), staleTime: 60_000 })
  const vendorsQ = useQuery({ queryKey: financeKey(clubId, 'vendors'), queryFn: () => api.vendors.list(), staleTime: 60_000 })
  const events = eventsQ.data ?? []
  const vendors = vendorsQ.data ?? []

  const [draft, setDraft] = useState(null)
  const onDraftChange = useCallback((d) => setDraft(d), [])
  const [freshId, setFreshId] = useState(null)

  const add = useMutation({
    mutationFn: (body) => api.finance.addExpense(body),
    onSuccess: ({ expense, budget }) => {
      // Use the returned budget right away so bars and totals morph now, then refresh the whole club.
      qc.setQueryData(summaryKey, (s) =>
        s && {
          ...mergeBudget(s, budget),
          recent_expenses: [expense, ...s.recent_expenses.filter((x) => x.id !== expense.id)].slice(0, 10),
        },
      )
      setFreshId(expense.id)
      qc.invalidateQueries({ queryKey: keys.club(clubId) })
      const cat = budget.categories.find((c) => c.id === expense.category_id)
      toast(`${moneySmart(expense.amount)} added to ${cat?.name ?? 'the budget'}`)
    },
  })

  const remove = useMutation({
    mutationFn: (expense) => api.finance.removeExpense(expense.id),
    // Optimistic: the row slides out and the bars give the money back immediately.
    onMutate: async (expense) => {
      await qc.cancelQueries({ queryKey: summaryKey })
      const prev = qc.getQueryData(summaryKey)
      qc.setQueryData(summaryKey, (s) => withoutExpense(s, expense))
      return { prev }
    },
    onError: (err, _x, ctx) => {
      if (ctx?.prev) qc.setQueryData(summaryKey, ctx.prev)
      toast.error(err)
    },
    onSuccess: (_d, expense) => toast(`Deleted “${expense.description}”`),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.club(clubId) }),
  })

  if (q.isPending) return <FinanceSkeleton />
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} className="mt-4" />

  const s = q.data
  const canManage = s.can_manage_finance ?? canManageFinance

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-5">
      <motion.div
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <p className="text-sm text-muted">{club?.name ?? 'Club'} budget</p>
          <h2 className="font-display mt-0.5 text-[24px] font-bold leading-tight tracking-tight">
            <span className="text-energy">{s.percent_used}%</span> of the year&apos;s budget is spent
          </h2>
        </div>
        {canManage ? (
          <Tag tone="ok">
            <ShieldCheck className="size-3" aria-hidden /> You can manage finances{club?.position ? ` · ${club.position}` : ''}
          </Tag>
        ) : (
          <Tag tone="copper">
            <Lock className="size-3" aria-hidden /> View only
          </Tag>
        )}
      </motion.div>

      <BudgetPanel summary={s} clubId={clubId} api={api} canManage={canManage} preview={canManage ? draft : null} />

      <div className="grid gap-5 xl:grid-cols-2">
        <AddExpense
          categories={s.categories}
          events={events}
          vendors={vendors}
          canManage={canManage}
          pending={add.isPending}
          error={add.error}
          onDraftChange={onDraftChange}
          onSubmit={(body, reset) => {
            add.reset()
            add.mutate(body, { onSuccess: reset })
          }}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RecentExpenses
          expenses={s.recent_expenses ?? []}
          categories={s.categories}
          events={events}
          vendors={vendors}
          canManage={canManage}
          freshId={freshId}
          deleting={remove.isPending}
          onDelete={(expense, close) => {
            close()
            remove.mutate(expense)
          }}
        />
        <NxtRequests
          requests={s.financial_requests ?? []}
          events={events}
          vendors={vendors}
          clubId={clubId}
          api={api}
          canManage={canManage}
        />
      </div>
    </motion.div>
  )
}
