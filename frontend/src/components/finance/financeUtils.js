import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { money } from '@/lib/format'

export const financeKey = (clubId, ...rest) => ['club', String(clubId), 'finance', ...rest]

export const READ_ONLY_REASON = 'Only the President or Treasurer can change the budget.'

// Money that keeps cents only when the value has them ($45 vs $12.50).
export const moneySmart = (n) => money(n, { cents: !Number.isInteger(Math.round(Number(n) * 100) / 100) })

// Budget health for a planned/spent pair. Always text + icon, never colour alone.
// Copper is the progress colour; warn/bad only appear when the line is near or over its plan.
export function budgetTone(spent, planned) {
  const pct = planned > 0 ? (spent / planned) * 100 : spent > 0 ? Infinity : 0
  if (pct > 100) return { key: 'over', pct, label: `Over by ${moneySmart(spent - planned)}`, icon: XCircle, text: 'text-bad', fill: 'bg-bad' }
  if (pct >= 85) return { key: 'near', pct, label: 'Near its limit', icon: AlertTriangle, text: 'text-warn', fill: 'bg-warn' }
  return { key: 'ok', pct, label: 'On track', icon: CheckCircle2, text: 'text-faint', fill: 'bg-copper' }
}

// Merge a server budget_summary (from POST /expenses or PATCH /categories) into the cached summary.
export function mergeBudget(summary, budget) {
  if (!summary || !budget) return summary
  return { ...summary, ...budget }
}

// Local recount after a delete (DELETE returns 204, no budget). The refetch right after corrects any drift.
export function withoutExpense(summary, expense) {
  if (!summary) return summary
  const round = (n) => Math.round(n * 100) / 100
  const categories = summary.categories.map((c) => {
    if (c.id !== expense.category_id) return c
    const spent = round(Math.max(0, c.spent - expense.amount))
    return {
      ...c,
      spent,
      remaining: round(c.planned - spent),
      percent_used: c.planned ? Math.round((100 * spent) / c.planned) : 0,
    }
  })
  const spent = round(Math.max(0, summary.spent - expense.amount))
  return {
    ...summary,
    categories,
    spent,
    remaining: round(summary.annual_budget - spent),
    percent_used: summary.annual_budget ? Math.round((100 * spent) / summary.annual_budget) : 0,
    recent_expenses: summary.recent_expenses.filter((x) => x.id !== expense.id),
  }
}
