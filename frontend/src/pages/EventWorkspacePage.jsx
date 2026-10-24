import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useClub } from '@/lib/club'
import { EventHero } from '@/components/events/EventHero'
import { EventTasks } from '@/components/events/EventTasks'
import { EventLogistics } from '@/components/events/EventLogistics'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { Card } from '@/components/ui/Card'

export default function EventWorkspacePage() {
  const { eventId } = useParams()
  const { clubId, api } = useClub()
  const q = useQuery({ queryKey: ['club', String(clubId), 'events', String(eventId), 'workspace'], queryFn: () => api.events.workspace(eventId) })
  return <div className="space-y-5">
    <Link to={`/c/${clubId}/events`} className="inline-flex items-center gap-2 text-[13px] font-medium text-muted hover:text-copper"><ArrowLeft className="size-4" aria-hidden /> All events</Link>
    {q.isPending ? <Card className="p-5"><SkeletonRows rows={6} /></Card> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : <>
      <EventHero ws={q.data} clubId={clubId} api={api} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
        <EventTasks ws={q.data} clubId={clubId} eventId={eventId} api={api} />
        <EventLogistics ws={q.data} clubId={clubId} eventId={eventId} api={api} />
      </div>
    </>}
  </div>
}
