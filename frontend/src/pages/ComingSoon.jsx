import { motion } from 'framer-motion'
import { LogoMark } from '@/components/Logo'

// Placeholder for screens that aren't built yet, so the demo never shows a broken page.
export default function ComingSoon({ title }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass flex max-w-md flex-col items-center rounded-3xl px-10 py-12 text-center"
      >
        <LogoMark size={56} />
        <h2 className="font-display mt-6 text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted">This screen is on the workbench. Check back soon.</p>
      </motion.div>
    </div>
  )
}
