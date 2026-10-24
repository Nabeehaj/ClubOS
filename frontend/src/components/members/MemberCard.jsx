import { GraduationCap, ListChecks, Mail } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Badges'
import { LoadBar } from './LoadBar'
import { LevelTag } from './LevelTag'
import { openOf } from './workload'

const MAX_DUTIES = 3

export function MemberCard({ member, level, maxTotal, isMe, onViewTasks }) {
  const total = member.task_count ?? 0
  const done = member.tasks_completed ?? 0
  const open = openOf(member)
  const duties = member.responsibilities ?? []
  const extra = duties.length - MAX_DUTIES

  return (
    <Card
      as="article"
      aria-labelledby={`member-${member.id}-name`}
      className="flex flex-col p-5 transition-colors hover:border-line-strong"
    >
      <div className="flex items-start gap-3">
        <Avatar user={member} size={44} />
        <div className="min-w-0 flex-1">
          <h3 id={`member-${member.id}-name`} className="font-display truncate text-[15px] font-semibold leading-tight text-fg">
            {member.name}
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-muted">{member.position || 'Board member'}</p>
        </div>
        {isMe && <Tag tone="copper">You</Tag>}
      </div>

      {/* task load */}
      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <LevelTag level={level} />
          <span className="tabular text-[12px] text-muted">
            {total === 0 ? (
              'No tasks yet'
            ) : (
              <>
                <span className="font-semibold text-fg">{open}</span> open, {done} done
              </>
            )}
          </span>
        </div>
        <LoadBar done={done} open={open} max={maxTotal} label={`${member.name}: ${open} open and ${done} done of ${total} tasks`} />
      </div>

      {/* responsibilities */}
      {duties.length > 0 && (
        <div className="mt-4">
          <p className="text-[12px] font-medium text-faint">Responsibilities</p>
          <ul className="mt-1.5 space-y-1">
            {duties.slice(0, MAX_DUTIES).map((d) => (
              <li key={d} className="flex items-start gap-2 text-[13px] leading-snug text-muted">
                <span className="mt-[9px] h-px w-2 shrink-0 bg-faint" aria-hidden />
                <span className="min-w-0">{d}</span>
              </li>
            ))}
            {extra > 0 && (
              <li className="pl-4 text-[12px] text-faint" title={duties.slice(MAX_DUTIES).join(', ')}>
                {extra} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* details */}
      <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-[12.5px]">
        {(member.major || member.class_year) && (
          <div className="flex items-center gap-2 text-muted">
            <dt>
              <GraduationCap className="size-3.5 text-faint" aria-hidden />
              <span className="sr-only">Studies</span>
            </dt>
            <dd className="flex min-w-0 gap-2">
              {member.major && <span className="truncate">{member.major}</span>}
              {member.class_year && <span className="tabular shrink-0 text-faint">Class of {member.class_year}</span>}
            </dd>
          </div>
        )}
        {member.email && (
          <div className="flex items-center gap-2">
            <dt>
              <Mail className="size-3.5 text-faint" aria-hidden />
              <span className="sr-only">Email</span>
            </dt>
            <dd className="min-w-0">
              <a
                href={`mailto:${member.email}`}
                className="block truncate text-muted underline-offset-4 hover:text-fg hover:underline"
              >
                {member.email}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-auto pt-4">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => onViewTasks(member)}
          aria-label={`View ${member.name}'s tasks`}
        >
          <ListChecks className="size-3.5" aria-hidden />
          View tasks
        </Button>
      </div>
    </Card>
  )
}
