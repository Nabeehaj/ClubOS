import { motion } from 'framer-motion'
import { FlaskConical } from 'lucide-react'

// The page-level disclaimer required by the guide. Flat panel; the copper edge marks it as something to read.
export function SampleNotice() {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
      role="note"
      aria-label="About these vendors"
      className="flex items-start gap-3 rounded-lg border border-line border-l-2 border-l-copper bg-ink-900 px-4 py-3"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-copper" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-fg">Sample vendors, not verified SBU-approved businesses</p>
        <p className="mt-0.5 text-[12.5px] text-muted">
          The businesses and contacts here are demo data for planning. Confirm a vendor yourself before you book it.
        </p>
      </div>
    </motion.div>
  )
}
