import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Plus } from 'lucide-react'
import { useClub } from '@/lib/club'
import { keys } from '@/lib/queryClient'
import { shortDate, time12 } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { StatusPill } from '@/components/ui/Badges'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'

const fresh = () => ({ name: '', date: '', start_time: '18:00', end_time: '20:00', location: '', description: '' })

export default function EventsPage() {
  const { clubId, api } = useClub()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('upcoming')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(fresh)
  const q = useQuery({ queryKey: ['club', String(clubId), 'events', 'list'], queryFn: () => api.events.list() })
  const create = useMutation({ mutationFn: api.events.create, onSuccess: (event) => { qc.invalidateQueries({ queryKey: keys.club(clubId) }); setOpen(false); setForm(fresh()); navigate(`/c/${clubId}/events/${event.id}`) } })
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const shown = (q.data ?? []).filter((e) => filter === 'all' || (filter === 'upcoming' ? e.date >= today : e.date < today))

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="page-kicker">Plan together</p><h2 className="page-title mt-2">Events</h2><p className="mt-2 text-[14px] text-muted">From first idea to final approval, keep the full plan in view.</p></div>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden /> New event</Button>
    </div>
    <div className="flex gap-1 border-b border-line" role="group" aria-label="Filter events">
      {[['upcoming','Upcoming'], ['past','Past'], ['all','All events']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${filter === value ? 'border-copper text-fg' : 'border-transparent text-muted hover:text-fg'}`}>{label}</button>)}
    </div>
    {q.isPending ? <Card className="p-5"><SkeletonRows rows={4} /></Card> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : shown.length === 0 ? <Card><EmptyState icon={CalendarDays} title={filter === 'all' ? 'No events yet' : `No ${filter} events`} hint="Create an event to give your board one place to coordinate the details." action={<Button size="sm" className="mt-2" onClick={() => setOpen(true)}>Create event</Button>} /></Card> : <div className="grid gap-3 md:grid-cols-2">
      {shown.map((event) => <Link key={event.id} to={`/c/${clubId}/events/${event.id}`} className="group block rounded-xl border border-line bg-ink-900 p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/5 focus-visible:outline-2">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="page-kicker">{shortDate(event.date)}</p><h3 className="font-display mt-2 text-[20px] font-semibold leading-tight text-fg">{event.name}</h3></div><ArrowRight className="mt-1 size-5 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-copper" aria-hidden /></div>
        <p className="mt-3 line-clamp-2 min-h-10 text-[13px] leading-5 text-muted">{event.description || 'No description added yet.'}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-[12.5px] text-muted"><StatusPill status={event.status} /><span>{time12(event.start_time)} · {event.location || 'Location to be confirmed'}</span><span className="ml-auto tabular font-semibold text-fg">{event.readiness?.score ?? 0}% ready</span></div>
      </Link>)}
    </div>}
    <Dialog open={open} onOpenChange={setOpen} title="New event" description="Start with the essentials. You can fill in the rest in the event workspace.">
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(form) }} className="space-y-4">
        <Field label="Event name">{(id) => <Input id={id} required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fall Tech Networking Night" />}</Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Date">{(id) => <Input id={id} required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field><Field label="Location">{(id) => <Input id={id} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="SAC Ballroom" />}</Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Starts">{(id) => <Input id={id} required type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />}</Field><Field label="Ends">{(id) => <Input id={id} required type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />}</Field></div>
        <Field label="What is it about?">{(id) => <Textarea id={id} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A little context for the board…" />}</Field>
        {create.isError && <p role="alert" className="text-sm text-bad">{create.error.message}</p>}
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={create.isPending}>Create event</Button></div>
      </form>
    </Dialog>
  </div>
}
