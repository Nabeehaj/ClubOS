import clsx from 'clsx'
import { dateParts } from './eventUtils'

// Calendar tile shared by the event cards and the workspace header, so an event looks like the same object in both.
export function DateBlock({ date, size = 'md', className }) {
  const { month, day, weekday } = dateParts(date)
  const lg = size === 'lg'
  return (
    <div
      className={clsx(
        'grid shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-center',
        lg ? 'size-[76px]' : 'size-[54px]',
        className,
      )}
      aria-hidden
    >
      <div className="leading-none">
        <div className={clsx('font-medium text-copper', lg ? 'text-[12px]' : 'text-[11px]')}>{month}</div>
        <div className={clsx('font-display tabular font-semibold text-fg', lg ? 'mt-1 text-[28px]' : 'mt-0.5 text-[20px]')}>
          {day}
        </div>
        {lg && weekday && <div className="mt-1 text-[11px] text-faint">{weekday}</div>}
      </div>
    </div>
  )
}
