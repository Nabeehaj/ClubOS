import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'

const defaultFormat = (n) => Math.round(n).toLocaleString('en-US')

// Rolls a number to its value, and rolls again whenever the value changes
// (that re-roll is the "back to dashboard, everything updated" demo moment).
export function CountUp({ value, format = defaultFormat, duration = 1.4, className }) {
  const ref = useRef(null)
  const from = useRef(0)
  const fmt = useRef(format)
  fmt.current = format
  const inView = useInView(ref, { once: true })
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || value === null || value === undefined || !inView) return
    if (reduced) {
      el.textContent = fmt.current(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        from.current = v
        el.textContent = fmt.current(v)
      },
    })
    return () => controls.stop()
  }, [value, inView, reduced, duration])

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  )
}
