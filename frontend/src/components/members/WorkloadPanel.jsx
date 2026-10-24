import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Scale, UserCheck } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { LoadBar, LoadLegend, barTransition } from './LoadBar'
import { LevelTag } from './LevelTag'
import { LEVELS, LEVEL_ORDER, openOf } from './workload'

// "Who should take this task?" at a glance: everyone ranked by open tasks, with a plain-language level.
export function WorkloadPanel({ members, workload, clubId, onSelect }) {
  const { levels, maxTotal, counts, bestFit, avg } = workload
  const ranked = [...members].sort(
    (a, b) => openOf(b) - openOf(a) || (b.task_count ?? 0) - (a.task_count ?? 0) || String(a.name).localeCompare(String(b.name)),
  )
  const summary = LEVEL_ORDER.filter((k) => counts[k] > 0)
    .map((k) => `${counts[k]} ${LEVELS[k].label.toLowerCase()}`)
    .join(', ')

  return (
    <Card className="pb-2">
      <CardHeader
        title="Workload"
        icon={Scale}
        subtitle={`Ranked by open tasks. Average ${avg.toFixed(1)} open per officer: ${summary}.`}
        action={
          <Link
            to={`/c/${clubId}/tasks`}
            className="shrink-0 text-[13px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Task board
          </Link>
        }
      />

      {bestFit && (
        <div className="mx-5 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-ink-850 py-2 pl-3 pr-2">
          <UserCheck className="size-4 shrink-0 text-ok" aria-hidden />
          <Avatar user={bestFit} size={24} />
          <p className="min-w-0 flex-1 text-[13px] text-muted">
            <span className="font-medium text-fg">{bestFit.name}</span> has the most room for a new task, with{' '}
            <span className="tabular text-fg">{openOf(bestFit)}</span> open.
          </p>
          <Button variant="ghost" size="sm" onClick={() => onSelect(bestFit)}>
            See their tasks
          </Button>
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <caption className="sr-only">Board members ranked by open tasks</caption>
          <thead>
            <tr className="text-left text-[12px] text-faint">
              <th scope="col" className="py-2 pl-5 pr-3 font-medium">
                Officer
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Load
              </th>
              <th scope="col" className="w-[38%] px-3 py-2 font-medium">
                <span className="sr-only">Tasks bar, </span>
                <LoadLegend />
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Open
              </th>
              <th scope="col" className="py-2 pl-3 pr-5 text-right font-medium">
                Done
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((m) => {
              const open = openOf(m)
              const done = m.tasks_completed ?? 0
              return (
                <motion.tr key={m.id} layout="position" transition={barTransition} className="border-t border-line hover:bg-white/[0.02]">
                  <td className="py-2 pl-5 pr-3">
                    <button
                      type="button"
                      onClick={() => onSelect(m)}
                      className="group flex min-w-0 items-center gap-2.5 rounded-md text-left"
                      aria-label={`View ${m.name}'s tasks`}
                    >
                      <Avatar user={m} size={26} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-fg group-hover:underline">{m.name}</span>
                        <span className="block truncate text-[12px] text-faint">{m.position}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <LevelTag level={levels[m.id]} />
                  </td>
                  <td className="px-3 py-2">
                    <LoadBar done={done} open={open} max={maxTotal} label={`${m.name}: ${open} open, ${done} done`} />
                  </td>
                  <td className="tabular px-3 py-2 text-right font-semibold text-fg">{open}</td>
                  <td className="tabular py-2 pl-3 pr-5 text-right text-muted">{done}</td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
