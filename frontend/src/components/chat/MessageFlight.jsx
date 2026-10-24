import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'

// Shared-element move for the demo beat: a copy of the chat message travels from its row in the thread
// to the quote slot at the top of the task panel, then hands over to the real quote card.
// Left/top use slightly different springs so the path curves a little. Both are critically damped (no bounce).
// Rendered in a portal: ancestors with filter/transform would otherwise trap position: fixed.
const path = {
  left: { type: 'spring', stiffness: 240, damping: 31 },
  top: { type: 'spring', stiffness: 170, damping: 26 },
  width: { type: 'spring', stiffness: 240, damping: 31 },
  height: { type: 'spring', stiffness: 240, damping: 31 },
}

export function MessageFlight({ flight, targetRef, onLanded }) {
  const [to, setTo] = useState(null)

  useLayoutEffect(() => {
    let raf
    const measure = (tries) => {
      const el = targetRef.current
      if (el) {
        const r = el.getBoundingClientRect()
        setTo({ left: r.left, top: r.top, width: r.width, height: r.height })
      } else if (tries > 0) {
        raf = requestAnimationFrame(() => measure(tries - 1))
      } else {
        onLanded(flight.nonce)
      }
    }
    measure(2)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.nonce])

  if (!to) return null
  const { from, message } = flight

  return createPortal(
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[70] overflow-hidden rounded-lg border border-copper bg-ink-850 p-3"
      initial={{ left: from.left, top: from.top, width: from.width, height: from.height, opacity: 1 }}
      animate={to}
      transition={path}
      onAnimationComplete={() => onLanded(flight.nonce)}
    >
      <div className="flex items-center gap-2">
        <Avatar user={message.author} size={22} />
        <span className="truncate text-[12.5px] font-semibold text-fg">{message.author?.name}</span>
      </div>
      <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-muted">{message.body}</p>
    </motion.div>,
    document.body,
  )
}
