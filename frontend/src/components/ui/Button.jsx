import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-copper text-white hover:bg-copper-soft',
  secondary: 'border border-line-strong bg-ink-850 text-fg hover:bg-ink-800',
  ghost: 'text-muted hover:bg-ink-800 hover:text-fg',
  copper: 'bg-copper text-white hover:bg-copper-soft',
  danger: 'border border-line-strong bg-ink-850 text-bad hover:bg-bad/10',
}
const SIZES = { sm: 'h-8 px-3 text-[12.5px] gap-1.5', md: 'h-9 px-3.5 text-[13.5px] gap-2', lg: 'h-11 px-5 text-[14.5px] gap-2' }

// `magnetic` is accepted for backwards compatibility and ignored.
export const Button = forwardRef(function Button(
  // eslint-disable-next-line no-unused-vars
  { variant = 'primary', size = 'md', magnetic, loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.98 }}
      disabled={disabled || loading}
      className={clsx(
        'relative inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </motion.button>
  )
})
