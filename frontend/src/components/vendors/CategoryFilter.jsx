import { motion } from 'framer-motion'
import clsx from 'clsx'
import { spring } from '@/lib/motion'

// Category filter as a tab row. A copper bar slides under the active category.
export function CategoryFilter({ categories, value, onChange, total }) {
  const chips = [{ name: '', label: 'All', count: total }, ...categories.map((c) => ({ ...c, label: c.name }))]
  return (
    <div role="group" aria-label="Filter vendors by category" className="flex flex-wrap items-end gap-x-1 border-b border-line">
      {chips.map((c) => {
        const active = value === c.name
        return (
          <button
            key={c.name || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c.name)}
            className={clsx(
              'relative inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-medium transition-colors',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {c.label}
            <span className="tabular text-[12px] text-faint">{c.count}</span>
            {active && (
              <motion.span
                layoutId="vendor-category-bar"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-copper"
                transition={spring}
                aria-hidden
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
