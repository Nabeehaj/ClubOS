import { forwardRef, useId } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

const control =
  'w-full rounded-lg bg-ink-900 px-3.5 text-[14px] text-fg ring-1 ring-inset ring-line-strong transition-colors placeholder:text-faint/70 hover:ring-muted focus:outline-none focus:ring-[var(--accent)] disabled:opacity-50'

// Label + control + optional hint/error. Pass `id` or let it generate one.
export function Field({ label, hint, error, children, className, id: idProp }) {
  const auto = useId()
  const id = idProp ?? auto
  return (
    <div className={clsx('block', className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
          {label}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {error ? (
        <p className="mt-1 text-xs text-bad" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-faint">{hint}</p>
      )}
    </div>
  )
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={clsx(control, 'h-10', className)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx(control, 'resize-y py-2.5 leading-relaxed', className)} {...props} />
})

// Native select styled to match (keeps keyboard and screen-reader behaviour for free).
export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <span className="relative block">
      <select ref={ref} className={clsx(control, 'h-10 appearance-none pr-9 [&>option]:bg-ink-800', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
    </span>
  )
})
