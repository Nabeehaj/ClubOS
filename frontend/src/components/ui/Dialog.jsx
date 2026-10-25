import * as RadixDialog from '@radix-ui/react-dialog'
import { useLayoutEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { spring } from '@/lib/motion'

// Modal (center) or sheet (slides in from the right). Controlled: pass open + onOpenChange.
export function Dialog({ open, onOpenChange, title, description, children, side = 'center', className, footer }) {
  const isSheet = side === 'right'
  const opener = useRef(null)
  const wasOpen = useRef(false)
  useLayoutEffect(() => {
    if (open && !wasOpen.current && document.activeElement !== document.body) opener.current = document.activeElement
    wasOpen.current = open
  }, [open])

  function restoreFocus() {
    const target = opener.current?.isConnected ? opener.current : document.getElementById('main-content')
    window.setTimeout(() => target?.focus(), 0)
    opener.current = null
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen)
      if (!nextOpen) restoreFocus()
    }}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-[#15221f]/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild forceMount>
              <motion.div
                onOpenAutoFocus={() => {
                  if (!opener.current && document.activeElement !== document.body) opener.current = document.activeElement
                }}
                onCloseAutoFocus={(event) => {
                  event.preventDefault()
                }}
                className={clsx(
                  'fixed z-50 flex flex-col overflow-hidden border border-line-strong bg-ink-900 shadow-2xl shadow-black/15 focus:outline-none',
                  isSheet
                    ? 'inset-y-0 right-0 w-[min(460px,100vw)] border-y-0 border-r-0'
                    : 'left-1/2 top-1/2 max-h-[85vh] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl',
                  className,
                )}
                initial={isSheet ? { x: '100%' } : { opacity: 0, scale: 0.98 }}
                animate={isSheet ? { x: 0 } : { opacity: 1, scale: 1 }}
                exit={isSheet ? { x: '100%' } : { opacity: 0, scale: 0.98 }}
                transition={spring}
              >
                <div className="flex items-start justify-between gap-4 px-6 pt-6">
                  <div>
                    <RadixDialog.Title className="font-display text-[17px] font-semibold">{title}</RadixDialog.Title>
                    {description ? (
                      <RadixDialog.Description className="mt-1 text-sm text-muted">{description}</RadixDialog.Description>
                    ) : (
                      <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
                    )}
                  </div>
                  <RadixDialog.Close
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-ink-800 hover:text-fg"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </RadixDialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}
