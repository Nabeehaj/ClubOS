import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import { findRanges } from './facts'

// An auto-growing textarea with a mirrored layer behind it, so event facts can be marked *under* the text
// while it stays a normal, editable field. Text metrics on both layers must stay identical.
const metrics = 'px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap [overflow-wrap:break-word]'

export const HighlightField = forwardRef(function HighlightField(
  { id, value, onChange, facts, mark = false, caret = false, readOnly = false, singleLine = false, className, minHeight, onSkip, ...rest },
  ref,
) {
  const local = useRef(null)

  // Grow with the content so the field never scrolls internally (keeps the mirror aligned).
  useLayoutEffect(() => {
    const el = local.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const segments = useMemo(() => {
    const ranges = findRanges(value, facts)
    const out = []
    let at = 0
    ranges.forEach(([s, e, key], i) => {
      if (s > at) out.push(value.slice(at, s))
      out.push(
        <mark
          key={`${key}-${i}`}
          className={clsx(
            'rounded-[3px] text-transparent transition-colors duration-700 ease-out',
            mark ? 'bg-copper/30' : 'bg-transparent',
          )}
        >
          {value.slice(s, e)}
        </mark>,
      )
      at = e
    })
    if (at < value.length) out.push(value.slice(at))
    return out
  }, [value, facts, mark])

  return (
    <div
      className={clsx(
        'relative rounded-lg bg-ink-850 ring-1 ring-inset ring-line transition-colors hover:ring-line-strong focus-within:ring-copper',
        readOnly && 'cursor-progress',
        className,
      )}
      style={minHeight ? { minHeight } : undefined}
      onMouseDown={readOnly ? onSkip : undefined}
    >
      <div aria-hidden className={clsx('pointer-events-none absolute inset-0 overflow-hidden text-transparent', metrics)}>
        {segments}
        {caret && <span className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-copper" />}
        {/* a trailing newline needs a character after it to take up a line, like the textarea does */}
        {value.endsWith('\n') && '​'}
      </div>
      <textarea
        ref={(node) => {
          local.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        id={id}
        value={value}
        readOnly={readOnly}
        rows={1}
        spellCheck={!readOnly}
        onChange={(e) => onChange?.(singleLine ? e.target.value.replace(/\r?\n/g, ' ') : e.target.value)}
        onKeyDown={singleLine ? (e) => e.key === 'Enter' && e.preventDefault() : undefined}
        className={clsx(
          'relative block w-full resize-none overflow-hidden bg-transparent text-fg caret-copper placeholder:text-faint focus:outline-none focus-visible:outline-none',
          metrics,
        )}
        style={minHeight ? { minHeight } : undefined}
        {...rest}
      />
    </div>
  )
})
