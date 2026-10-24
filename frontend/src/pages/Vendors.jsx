import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Plus, Store } from 'lucide-react'
import { useClub } from '@/lib/club'
import { spring } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { SampleNotice } from '@/components/vendors/SampleNotice'
import { CategoryFilter } from '@/components/vendors/CategoryFilter'
import { VendorCard } from '@/components/vendors/VendorCard'
import { VendorSheet } from '@/components/vendors/VendorSheet'
import { AddVendorDialog } from '@/components/vendors/AddVendorDialog'
import { quoteUrl, vendorKeys } from '@/components/vendors/shared'

const enter = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }
const page = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading vendors">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[300px] rounded-xl" />
      ))}
    </div>
  )
}

// Pipeline across every vendor link: how many are being considered, quoted, booked.
function Summary({ vendors }) {
  const links = vendors.flatMap((v) => v.events ?? [])
  const count = (s) => links.filter((l) => l.status === s).length
  const items = [
    { label: vendors.length === 1 ? 'vendor' : 'vendors', value: vendors.length },
    { label: 'considering', value: count('Considering') },
    { label: 'quote requested', value: count('Quote Requested') },
    { label: 'booked', value: count('Booked') },
  ]
  return (
    <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-baseline gap-1.5">
          <span className="tabular text-[15px] font-semibold text-fg">{it.value}</span>
          <span className="text-[13px] text-muted">{it.label}</span>
        </span>
      ))}
    </p>
  )
}

export default function Vendors() {
  const { clubId, api } = useClub()
  const navigate = useNavigate()
  const [category, setCategory] = useState('')
  const [sheet, setSheet] = useState({ open: false, id: null, seed: null })
  const [adding, setAdding] = useState(false)

  // The unfiltered list feeds the filter counts; the filtered one uses the endpoint's ?category=.
  const all = useQuery({ queryKey: vendorKeys.list(clubId, ''), queryFn: () => api.vendors.list() })
  const filtered = useQuery({
    queryKey: vendorKeys.list(clubId, category),
    queryFn: () => api.vendors.list({ category }),
    enabled: !!category,
    // Show the client-side filter instantly while the server confirms it.
    placeholderData: () => all.data?.filter((v) => v.category === category),
  })

  const categories = useMemo(() => {
    const counts = new Map()
    for (const v of all.data ?? []) counts.set(v.category, (counts.get(v.category) ?? 0) + 1)
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
  }, [all.data])
  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories])

  const active = category ? filtered : all
  const vendors = active.data ?? []

  const openVendor = (v) => setSheet({ open: true, id: v.id, seed: v })
  const requestQuote = (v) => navigate(quoteUrl(clubId, v))

  return (
    <motion.div variants={page} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={enter}>
        <p className="page-kicker">The people behind the plan</p>
        <h2 className="page-title mt-2">Vendors</h2>
        <p className="mt-2 text-[14px] text-muted">Compare partners, track quotes, and keep each event's needs in view.</p>
      </motion.div>
      <motion.div variants={enter} className="flex flex-wrap items-center justify-between gap-3">
        {all.data ? <Summary vendors={all.data} /> : <Skeleton className="h-5 w-72" />}
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          Add vendor
        </Button>
      </motion.div>

      <SampleNotice />

      <motion.div variants={enter} className="space-y-4">
        {all.isPending ? (
          <Skeleton className="h-9 w-full max-w-xl" />
        ) : (
          all.data?.length > 0 && (
            <CategoryFilter categories={categories} value={category} onChange={setCategory} total={all.data.length} />
          )
        )}

        {all.isPending || (active.isPending && !active.data) ? (
          <GridSkeleton />
        ) : active.isError && !active.data ? (
          <ErrorState error={active.error} onRetry={active.refetch} />
        ) : vendors.length === 0 ? (
          <div className="rounded-xl border border-line bg-ink-900">
            <EmptyState
              icon={Store}
              title={category ? `No ${category.toLowerCase()} vendors` : 'No vendors yet'}
              hint={
                category
                  ? 'Try another category, or add a vendor for this one.'
                  : 'Add the caterers, printers and rental shops your club works with, then attach them to events.'
              }
              action={
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => setAdding(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  Add vendor
                </Button>
              }
            />
          </div>
        ) : (
          <motion.div layout transition={spring} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {vendors.map((v) => (
                <VendorCard key={v.id} vendor={v} onOpen={openVendor} onRequestQuote={requestQuote} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        {active.isError && active.data && <ErrorState compact error={active.error} onRetry={active.refetch} />}
      </motion.div>

      <VendorSheet
        open={sheet.open}
        vendorId={sheet.id}
        seed={sheet.seed}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        clubId={clubId}
        api={api}
        categories={categoryNames}
        onRequestQuote={requestQuote}
      />

      <AddVendorDialog
        open={adding}
        onOpenChange={setAdding}
        clubId={clubId}
        api={api}
        categories={categoryNames}
        defaultCategory={category}
        onCreated={(v) => {
          if (category && v.category !== category) setCategory('')
        }}
      />
    </motion.div>
  )
}
