import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  Banknote, CheckCircle2, ClipboardCheck, ListPlus, Loader2, Mail, MessageSquare, PenLine, SendHorizontal,
  Sparkles, Stamp, Trash2, XCircle,
} from 'lucide-react'
import { useClub } from '@/lib/club'
import { keys } from '@/lib/queryClient'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'

// Chat with the backend assistant. Every change it proposes comes back as a card; nothing happens until
// someone confirms. Contract: POST /agent/chat -> { reply, proposals[], emails[] }.

const SUGGESTIONS = [
  'Plan the remaining tasks for the End-of-Semester Celebration',
  'Turn #event-planning into tasks',
  "What's left before Fall Tech Networking Night?",
  'Who has the most open tasks? Rebalance them',
  'Draft the invite for the AI Workshop',
]

const KIND = {
  create_task: { icon: ListPlus, label: 'New task' },
  update_task: { icon: PenLine, label: 'Task change' },
  delete_task: { icon: Trash2, label: 'Delete task' },
  post_message: { icon: MessageSquare, label: 'Chat post' },
  save_email_draft: { icon: Mail, label: 'Email draft' },
  add_expense: { icon: Banknote, label: 'Expense' },
  financial_request: { icon: Banknote, label: 'NXT request' },
  advance_approval: { icon: Stamp, label: 'Approval step' },
}

function ProposalCard({ proposal, busy, onConfirm, onReject }) {
  const { icon: Icon, label } = KIND[proposal.kind] ?? { icon: ClipboardCheck, label: 'Change' }
  const pending = proposal.status === 'Proposed'
  return (
    <div
      className={clsx(
        'rounded-lg border bg-ink-900 px-3 py-2.5 transition-colors',
        proposal.status === 'Applied' ? 'border-ok/40' : proposal.status === 'Failed' ? 'border-bad/40' : 'border-line',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-copper" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-medium uppercase tracking-wide text-faint">{label}</p>
          <p className="text-[13px] leading-snug text-fg">{proposal.summary}</p>
          {proposal.error && <p className="mt-1 text-[12px] text-bad">{proposal.error}</p>}
          {pending && !proposal.can_confirm && (
            <p className="mt-1 text-[12px] text-warn">Needs a {proposal.requires_role} to confirm.</p>
          )}
        </div>
      </div>
      {pending ? (
        <div className="mt-2 flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" disabled={busy} onClick={onReject}>Reject</Button>
          <Button size="sm" disabled={busy || !proposal.can_confirm} loading={busy} onClick={onConfirm}>Confirm</Button>
        </div>
      ) : (
        <p
          className={clsx(
            'mt-1.5 flex items-center justify-end gap-1 text-[12px]',
            proposal.status === 'Applied' ? 'text-ok' : 'text-faint',
          )}
        >
          {proposal.status === 'Applied' ? <CheckCircle2 className="size-3.5" aria-hidden /> : <XCircle className="size-3.5" aria-hidden />}
          {proposal.status === 'Applied' ? 'Done' : proposal.status}
        </p>
      )}
    </div>
  )
}

function EmailCard({ email }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-line bg-ink-900 px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <Mail className="mt-0.5 size-4 shrink-0 text-copper" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-medium uppercase tracking-wide text-faint">Email draft</p>
          <p className="text-[13px] leading-snug text-fg">{email.subject}</p>
          {email.to && <p className="truncate text-[12px] text-faint">To: {email.to}</p>}
          {open && <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">{email.body}</p>}
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Preview'}</Button>
        <a
          href={email.mailto}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-ink-850 px-3 text-[12.5px] font-medium text-fg hover:bg-ink-800"
        >
          Open in mail app
        </a>
      </div>
    </div>
  )
}

function AssistantTurn({ turn, busyIds, onConfirm, onReject, onConfirmAll }) {
  const confirmable = turn.proposals.filter((p) => p.status === 'Proposed' && p.can_confirm)
  return (
    <div className="space-y-2">
      <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-ink-850 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-fg whitespace-pre-wrap">
        {turn.text}
      </div>
      {turn.proposals.map((p) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          busy={busyIds.has(p.id)}
          onConfirm={() => onConfirm(p.id)}
          onReject={() => onReject(p.id)}
        />
      ))}
      {confirmable.length > 1 && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" disabled={confirmable.some((p) => busyIds.has(p.id))}
            onClick={() => onConfirmAll(confirmable.map((p) => p.id))}>
            <CheckCircle2 className="size-4" aria-hidden /> Confirm all ({confirmable.length})
          </Button>
        </div>
      )}
      {turn.emails.map((e, i) => <EmailCard key={i} email={e} />)}
    </div>
  )
}

function Composer({ onSend, disabled }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const ready = text.trim().length > 0 && !disabled

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [text])

  const submit = (e) => {
    e?.preventDefault()
    if (!ready) return
    onSend(text.trim())
    setText('')
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 rounded-xl border border-line bg-ink-900 p-1.5 pl-3.5 focus-within:border-copper">
      <label htmlFor="assistant-input" className="sr-only">Ask the assistant</label>
      <textarea
        id="assistant-input"
        ref={ref}
        rows={1}
        value={text}
        maxLength={4000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
        }}
        placeholder="Ask ClubOS to plan, assign, or draft..."
        className="max-h-[132px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[14px] leading-relaxed text-fg placeholder:text-faint/80 focus:outline-none"
      />
      <button
        type="submit"
        disabled={!ready}
        aria-label="Send"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-copper text-ink-950 transition-colors hover:bg-copper-soft disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-faint"
      >
        <SendHorizontal className="size-4" aria-hidden />
      </button>
    </form>
  )
}

export function AssistantPanel({ open, onOpenChange }) {
  const { clubId, api } = useClub()
  const qc = useQueryClient()
  const [turns, setTurns] = useState([]) // { role: 'user'|'assistant', text, proposals?, emails?, error? }
  const [busyIds, setBusyIds] = useState(() => new Set())
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, open])

  const refreshClub = () => qc.invalidateQueries({ queryKey: keys.club(clubId) })

  const patchProposals = (updates) =>
    setTurns((all) => all.map((t) => (t.proposals
      ? { ...t, proposals: t.proposals.map((p) => (updates[p.id] ? { ...p, ...updates[p.id] } : p)) }
      : t)))

  const setBusy = (ids, on) =>
    setBusyIds((s) => {
      const next = new Set(s)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })

  const ask = useMutation({
    mutationFn: ({ message, history }) => api.agent.chat(message, history),
    onSuccess: (res) =>
      setTurns((all) => [...all, { role: 'assistant', text: res.reply, proposals: res.proposals, emails: res.emails }]),
    onError: (err) =>
      setTurns((all) => [...all, {
        role: 'assistant', error: true, proposals: [], emails: [],
        text: err?.isUnavailable ? 'The AI is busy or switched off right now. Try again in a minute.' : err?.message,
      }]),
  })

  const send = (message) => {
    const history = turns.filter((t) => !t.error).map((t) => ({ role: t.role, text: t.text }))
    setTurns((all) => [...all, { role: 'user', text: message }])
    ask.mutate({ message, history })
  }

  const confirm = async (id) => {
    setBusy([id], true)
    try {
      await api.agent.confirm(id)
      patchProposals({ [id]: { status: 'Applied', error: null } })
      refreshClub()
    } catch (err) {
      patchProposals({ [id]: { error: err?.message } })
      toast.error(err)
    } finally {
      setBusy([id], false)
    }
  }

  const confirmAll = async (ids) => {
    setBusy(ids, true)
    try {
      const res = await api.agent.confirmMany(ids)
      patchProposals(Object.fromEntries(res.results.map((r) => [r.id, r.ok
        ? { status: 'Applied', error: null }
        : { error: typeof r.error === 'string' ? r.error : 'Could not apply' }])))
      refreshClub()
      toast(res.failed ? `${res.applied} applied, ${res.failed} need attention` : `${res.applied} changes applied`)
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy(ids, false)
    }
  }

  const reject = async (id) => {
    setBusy([id], true)
    try {
      await api.agent.reject(id)
      patchProposals({ [id]: { status: 'Rejected' } })
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy([id], false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title="ClubOS Assistant"
      description="Plans events, assigns tasks and drafts emails. Nothing changes until you confirm."
      footer={<div className="w-full"><Composer onSend={send} disabled={ask.isPending} /></div>}
    >
      <div className="space-y-4">
        {turns.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <Sparkles className="size-4 text-copper" aria-hidden /> Try asking:
            </div>
            <div className="flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-line bg-ink-900 px-3 py-2 text-left text-[13px] text-fg transition-colors hover:border-copper hover:bg-ink-850"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-copper px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white whitespace-pre-wrap">
                {t.text}
              </div>
            </div>
          ) : (
            <AssistantTurn
              key={i}
              turn={t}
              busyIds={busyIds}
              onConfirm={confirm}
              onReject={reject}
              onConfirmAll={confirmAll}
            />
          ),
        )}

        {ask.isPending && (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 className="size-4 animate-spin text-copper" aria-hidden />
            Working on it. Bigger plans can take up to half a minute.
          </div>
        )}
        <div ref={endRef} />
      </div>
    </Dialog>
  )
}
