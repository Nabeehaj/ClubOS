import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useApprovalsCenter } from '@/components/approvals/useApprovals'
import { ApprovalsTable } from '@/components/approvals/ApprovalsTable'
import { EventApprovals } from '@/components/approvals/EventApprovals'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'

export default function ApprovalsPage() {
  const q = useApprovalsCenter()
  const [picked, setPicked] = useState(null)
  const entries = q.data ?? []
  const selected = entries.find((e) => String(e.event.id) === String(picked)) ?? entries[0]
  return <div className="space-y-5">
    <div><p className="page-kicker">Campus paperwork, in one place</p><h2 className="page-title mt-2">Approvals</h2><p className="mt-2 text-[14px] text-muted">Follow room reservations, event approval, and funding for each event.</p></div>
    {q.isPending ? <Card className="p-5"><SkeletonRows rows={5} /></Card> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : entries.length === 0 ? <Card><EmptyState icon={ShieldCheck} title="No approvals to track" hint="Create an event and its approval path will appear here." /></Card> : <><ApprovalsTable entries={entries} selectedId={selected.event.id} onSelect={setPicked} /><EventApprovals entry={selected} /></>}
  </div>
}
