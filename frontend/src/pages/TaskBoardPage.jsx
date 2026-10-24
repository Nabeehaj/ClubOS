import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useTaskActions, useTaskQueries } from '@/components/tasks/useTaskBoard'
import { STATUSES, PRIORITIES, sortForColumn } from '@/components/tasks/taskModel'
import { useAuth } from '@/lib/auth'
import { shortDate } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { PriorityTag } from '@/components/ui/Badges'
import { ErrorState, SkeletonRows } from '@/components/ui/States'

const blank = () => ({ title: '', description: '', event_id: '', assignee_id: '', priority: 'Medium', due_date: '', status: 'To Do' })

export default function TaskBoardPage() {
  const { user } = useAuth()
  const [search, setSearchParams] = useSearchParams()
  const [mine, setMine] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [formError, setFormError] = useState('')
  const event = search.get('event') ?? search.get('event_id') ?? ''
  const { list, members, events } = useTaskQueries({ event, mine, assignee: '' })
  const actions = useTaskActions()
  const tasks = actions.applyOverrides(list.data ?? [])
  const people = Array.isArray(members.data) ? members.data : (members.data?.members ?? [])
  const eventList = events.data ?? []

  function openTask(task) {
    setFormError('')
    setEditing(task ?? 'new')
    setForm(task ? { title: task.title, description: task.description ?? '', event_id: task.event_id ?? '', assignee_id: task.assignee_id ?? '', priority: task.priority, due_date: task.due_date ?? '', status: task.status } : { ...blank(), event_id: event })
  }
  function payload() {
    return { ...form, event_id: form.event_id ? Number(form.event_id) : null, assignee_id: form.assignee_id ? Number(form.assignee_id) : null, due_date: form.due_date || null }
  }
  async function save(e) {
    e.preventDefault()
    setFormError('')
    try {
      if (editing === 'new') await actions.create.mutateAsync(payload())
      else await actions.save.mutateAsync({ id: editing.id, body: payload() })
      setEditing(null)
    } catch (err) { setFormError(err.message) }
  }
  async function remove() {
    if (editing === 'new' || !window.confirm(`Delete “${editing.title}”? This cannot be undone.`)) return
    try { await actions.remove.mutateAsync(editing.id); setEditing(null) } catch (err) { setFormError(err.message) }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker">Keep the board moving</p><h2 className="page-title mt-2">Tasks</h2><p className="mt-2 text-[14px] text-muted">Give every idea an owner and a next step.</p></div><Button onClick={() => openTask(null)}><Plus className="size-4" aria-hidden /> New task</Button></div>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-900 px-4 py-3">
      <label className="flex min-w-[220px] flex-1 items-center gap-3 text-[13px] font-medium text-muted">Event <select value={event} onChange={(e) => setSearchParams(e.target.value ? { event: e.target.value } : {})} className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-ink-900 px-2 text-fg"><option value="">All events</option>{eventList.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <button type="button" aria-pressed={mine} onClick={() => setMine((v) => !v)} className={`h-9 rounded-lg border px-3 text-[13px] font-medium ${mine ? 'border-copper bg-copper/5 text-copper-soft' : 'border-line-strong text-muted hover:text-fg'}`}>Assigned to me{user?.name ? ` · ${user.name.split(' ')[0]}` : ''}</button>
    </div>
    {list.isPending && !list.data ? <Card className="p-5"><SkeletonRows rows={6} /></Card> : list.isError && !list.data ? <ErrorState error={list.error} onRetry={list.refetch} /> : <div className="grid gap-4 lg:grid-cols-3">
      {STATUSES.map(({ id, label, icon: Icon, tone }) => { const column = sortForColumn(id, tasks.filter((t) => t.status === id)); return <section key={id} className="min-w-0 rounded-xl border border-line bg-ink-850 p-3" aria-label={`${label} tasks`}>
        <header className="flex items-center gap-2 px-2 pb-3"><Icon className={`size-4 ${tone}`} aria-hidden /><h3 className="font-display text-[15px] font-semibold text-fg">{label}</h3><span className="ml-auto rounded-md bg-ink-800 px-2 py-0.5 font-mono text-[11px] text-muted">{column.length}</span></header>
        {column.length === 0 ? <div className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-[12px] text-faint">No tasks here</div> : <ul className="space-y-2">{column.map((task) => <li key={task.id} className="rounded-lg border border-line bg-ink-900 p-3.5 shadow-sm shadow-black/[.02]"><div className="flex items-start justify-between gap-2"><button type="button" onClick={() => openTask(task)} className="text-left text-[14px] font-semibold leading-snug text-fg hover:text-copper-soft">{task.title}</button><PriorityTag priority={task.priority} /></div><p className="mt-2 truncate text-[12px] text-muted">{task.event_name || 'General club task'}</p><div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3"><span className="min-w-0 text-[12px] leading-4 text-muted"><span className="block truncate">{task.assignee?.name || 'Unassigned'}</span>{task.due_date && <span className="block text-faint">Due {shortDate(task.due_date)}</span>}</span><label className="sr-only" htmlFor={`move-${task.id}`}>Move {task.title}</label><select id={`move-${task.id}`} value={task.status} onChange={(e) => actions.patchTask(task, { status: e.target.value })} className="max-w-[120px] shrink-0 rounded-md border border-line-strong bg-ink-900 px-1.5 py-1 text-[11px] text-fg">{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div></li>)}</ul>}
      </section> })}
    </div>}
    {list.isError && list.data && <ErrorState compact error={list.error} onRetry={list.refetch} />}
    <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null) }} title={editing === 'new' ? 'New task' : 'Edit task'} description="Make it clear who is doing what and when.">
      <form onSubmit={save} className="space-y-4"><Field label="Task">{(id) => <Input id={id} required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Book a photographer" />}</Field><Field label="Details">{(id) => <Textarea id={id} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field><div className="grid grid-cols-2 gap-3"><Field label="Event">{(id) => <Select id={id} value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })}><option value="">General</option>{eventList.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>}</Field><Field label="Assignee">{(id) => <Select id={id} value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}><option value="">Unassigned</option>{people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}</Field></div><div className="grid grid-cols-2 gap-3"><Field label="Due date">{(id) => <Input id={id} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />}</Field><Field label="Priority">{(id) => <Select id={id} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select>}</Field></div><Field label="Status">{(id) => <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>}</Field>{formError && <p role="alert" className="text-sm text-bad">{formError}</p>}<div className="flex justify-between gap-2 pt-2">{editing !== 'new' ? <Button type="button" variant="danger" onClick={remove} loading={actions.remove.isPending}>Delete</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={actions.create.isPending || actions.save.isPending}>Save task</Button></div></div></form>
    </Dialog>
  </div>
}
