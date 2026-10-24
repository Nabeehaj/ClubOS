import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertOctagon, CheckCircle2, Info } from 'lucide-react'
import { spring } from '@/lib/motion'

// Tiny toast system: call toast('Task created') or toast.error(err) from anywhere. <Toaster/> lives in AppShell.
const listeners = new Set()
let nextId = 1

function push(t) {
  const item = { id: nextId++, tone: 'ok', ...t }
  listeners.forEach((l) => l(item))
}

export function toast(message, opts = {}) {
  push({ message, ...opts })
}
toast.error = (errOrMessage) =>
  push({ tone: 'bad', message: typeof errOrMessage === 'string' ? errOrMessage : errOrMessage?.message ?? 'Something went wrong' })
toast.info = (message) => push({ tone: 'info', message })

const ICONS = { ok: CheckCircle2, bad: AlertOctagon, info: Info }
const COLORS = { ok: 'text-ok', bad: 'text-bad', info: 'text-cyan' }

export function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const add = (item) => {
      setItems((xs) => [...xs.slice(-3), item])
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== item.id)), item.duration ?? 3200)
    }
    listeners.add(add)
    return () => listeners.delete(add)
  }, [])

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[340px] flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = ICONS[t.tone] ?? Info
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
              transition={spring}
              className="glass pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3"
              role={t.tone === 'bad' ? 'alert' : 'status'}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${COLORS[t.tone]}`} aria-hidden />
              <p className="text-[13px] leading-snug text-fg">{t.message}</p>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
