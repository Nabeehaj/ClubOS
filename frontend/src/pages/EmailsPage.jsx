import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Mail, Save, Sparkles, Trash2 } from 'lucide-react'
import { useClub } from '@/lib/club'
import { keys } from '@/lib/queryClient'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'

export default function EmailsPage() {
  const { clubId, api } = useClub()
  const qc = useQueryClient()
  const [template, setTemplate] = useState('event_invitation')
  const [eventId, setEventId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [note, setNote] = useState('')
  const [tone, setTone] = useState('friendly')
  const [email, setEmail] = useState(null)
  const templates = useQuery({ queryKey: ['club', String(clubId), 'emails', 'templates'], queryFn: api.emails.templates })
  const events = useQuery({ queryKey: ['club', String(clubId), 'emails', 'events'], queryFn: () => api.events.list() })
  const vendors = useQuery({ queryKey: ['club', String(clubId), 'emails', 'vendors'], queryFn: () => api.vendors.list() })
  const drafts = useQuery({ queryKey: ['club', String(clubId), 'emails', 'drafts'], queryFn: () => api.emails.drafts() })
  const agent = useQuery({ queryKey: keys.agentStatus(clubId), queryFn: api.agent.status, retry: false })
  const generate = useMutation({ mutationFn: api.emails.generate, onSuccess: (data) => setEmail(data) })
  const polish = useMutation({ mutationFn: api.emails.polish, onSuccess: (data) => { setEmail((e) => ({ ...e, subject: data.subject, body: data.body })); toast('Draft polished. Review it before opening your mail app.') } })
  const save = useMutation({ mutationFn: api.emails.saveDraft, onSuccess: () => { qc.invalidateQueries({ queryKey: ['club', String(clubId), 'emails', 'drafts'] }); toast('Draft saved') } })
  const remove = useMutation({ mutationFn: api.emails.removeDraft, onSuccess: () => { qc.invalidateQueries({ queryKey: ['club', String(clubId), 'emails', 'drafts'] }); toast('Draft deleted') } })
  const needsEvent = template !== 'meeting_reminder'
  const needsVendor = template === 'catering_quote'

  async function openMail() {
    if (!email?.subject?.trim() || !email?.body?.trim()) return
    try {
      const result = await api.emails.mailto({ template, event_id: email.event_id, to: email.to, subject: email.subject, body: email.body })
      window.location.href = result.mailto
    } catch (err) { toast.error(err) }
  }
  function body() { return { template, event_id: needsEvent ? Number(eventId) : null, vendor_id: needsVendor ? Number(vendorId) : null, extra_note: note } }

  return <div className="space-y-6">
    <div><p className="page-kicker">From details to draft</p><h2 className="page-title mt-2">Email studio</h2><p className="mt-2 text-[14px] text-muted">Start with your club's real event details. Nothing sends from ClubOS.</p></div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
      <Card className="p-5 sm:p-6"><div className="mb-5"><span className="page-kicker">01 / Compose</span><h3 className="mt-2 text-[18px] font-semibold text-fg">Choose your starting point</h3></div>
        {templates.isPending ? <SkeletonRows rows={3} /> : templates.isError ? <ErrorState compact error={templates.error} onRetry={templates.refetch} /> : <div className="space-y-4">
          <Field label="Template">{(id) => <Select id={id} value={template} onChange={(e) => { setTemplate(e.target.value); setEmail(null) }}>{(templates.data ?? []).map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</Select>}</Field>
          {needsEvent && (events.isError ? <ErrorState compact error={events.error} onRetry={events.refetch} /> : <Field label="Event">{(id) => <Select id={id} value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Select an event</option>{(events.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>}</Field>)}
          {needsVendor && (vendors.isError ? <ErrorState compact error={vendors.error} onRetry={vendors.refetch} /> : <Field label="Vendor" hint="Sample vendors are not SBU-verified.">{(id) => <Select id={id} value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">Select a vendor</option>{(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}{v.is_sample ? ' · sample' : ''}</option>)}</Select>}</Field>)}
          <Field label="Anything to add?" hint="Optional; appears in the generated message.">{(id) => <Textarea id={id} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for your recipients…" />}</Field>
          {generate.isError && <ErrorState compact error={generate.error} />}
          <Button className="w-full" disabled={(needsEvent && !eventId) || (needsVendor && !vendorId)} loading={generate.isPending} onClick={() => generate.mutate(body())}>Generate draft</Button>
        </div>}
      </Card>
      <Card className="overflow-hidden"><header className="border-b border-line px-5 py-5 sm:px-6"><span className="page-kicker">02 / Review</span><h3 className="mt-2 text-[18px] font-semibold text-fg">Make it yours</h3><p className="mt-1 text-[13px] text-muted">Read and edit every line before opening your mail app.</p></header>
        {!email ? <EmptyState icon={Mail} title="Your draft will appear here" hint="Pick a template and generate a message from your club's information." className="min-h-[340px]" /> : <div className="space-y-4 px-5 py-5 sm:px-6">
          <Field label="To">{(id) => <Input id={id} value={email.to ?? ''} onChange={(e) => setEmail({ ...email, to: e.target.value })} />}</Field>
          <Field label="Subject">{(id) => <Input id={id} value={email.subject ?? ''} onChange={(e) => setEmail({ ...email, subject: e.target.value })} />}</Field>
          <Field label="Message">{(id) => <Textarea id={id} rows={14} value={email.body ?? ''} onChange={(e) => setEmail({ ...email, body: e.target.value })} className="min-h-[300px] resize-y font-mono text-[12.5px] leading-6" />}</Field>
          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4"><Field label="AI tone" className="min-w-[140px] flex-1">{(id) => <Select id={id} value={tone} onChange={(e) => setTone(e.target.value)}>{['friendly','professional','hype','concise'].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</Select>}</Field><Button variant="secondary" disabled={agent.data?.available !== true} loading={polish.isPending} onClick={() => polish.mutate({ subject: email.subject, body: email.body, tone })}><Sparkles className="size-4" aria-hidden /> AI polish</Button></div>
          {agent.data?.available !== true && <p className="text-[12px] text-faint">AI polish is coming soon. You can edit the draft yourself.</p>}
          {polish.isError && <ErrorState compact error={polish.error} />}
          <div className="flex flex-wrap gap-2 pt-2"><Button variant="secondary" loading={save.isPending} onClick={() => save.mutate({ template, event_id: email.event_id, to: email.to, subject: email.subject, body: email.body })}><Save className="size-4" aria-hidden /> Save draft</Button><Button onClick={openMail}><ArrowUpRight className="size-4" aria-hidden /> Open in mail app</Button></div>
        </div>}
      </Card>
    </div>
    <Card className="overflow-hidden"><header className="flex items-baseline justify-between border-b border-line px-5 py-4"><h3 className="text-[15px] font-semibold">Saved drafts</h3><span className="font-mono text-[11px] text-faint">{drafts.data?.length ?? 0}</span></header>{drafts.isPending ? <div className="p-5"><SkeletonRows rows={2} /></div> : drafts.isError ? <div className="p-5"><ErrorState compact error={drafts.error} onRetry={drafts.refetch} /></div> : !drafts.data?.length ? <EmptyState title="No saved drafts" hint="Save a draft when you want to come back to it." /> : <ul className="divide-y divide-line">{drafts.data.map((d) => <li key={d.id} className="flex items-center gap-3 px-5 py-3"><button type="button" onClick={() => { setTemplate(d.template); setEmail(d); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="min-w-0 flex-1 text-left"><span className="block truncate text-[13px] font-semibold text-fg">{d.subject}</span><span className="block truncate text-[12px] text-faint">{d.to || 'No recipient yet'}</span></button><button type="button" onClick={() => { if (window.confirm(`Delete “${d.subject}”?`)) remove.mutate(d.id) }} aria-label={`Delete draft ${d.subject}`} className="grid size-9 place-items-center rounded-md text-faint hover:bg-bad/5 hover:text-bad"><Trash2 className="size-4" aria-hidden /></button></li>)}</ul>}</Card>
  </div>
}
