import { Tag } from '@/components/ui/Badges'
import { LEVELS } from './workload'

export function LevelTag({ level, className }) {
  const lv = LEVELS[level] ?? LEVELS.steady
  const Icon = lv.icon
  return (
    <Tag tone={lv.tone} className={className}>
      <Icon className="size-3" aria-hidden />
      {lv.label}
    </Tag>
  )
}
