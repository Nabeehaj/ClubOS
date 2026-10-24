import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { rise } from '@/lib/motion'

// Flat panel with a hairline border. Enters as part of a parent stagger.
// `spotlight` is accepted for backwards compatibility and ignored.
// eslint-disable-next-line no-unused-vars
export const Card = forwardRef(function Card({ className, children, as = 'section', spotlight, ...rest }, ref) {
  const Comp = motion[as] ?? motion.section
  return (
    <Comp ref={ref} variants={rise} className={clsx('rounded-xl border border-line bg-ink-900', className)} {...rest}>
      {children}
    </Comp>
  )
})

export function CardHeader({ title, icon: Icon, action, subtitle, className }) {
  return (
    <header className={clsx('flex items-start justify-between gap-3 px-5 pt-4', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          {Icon && <Icon className="size-4 text-faint" aria-hidden />}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-faint">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
