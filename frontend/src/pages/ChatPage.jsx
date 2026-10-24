import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessagesSquare } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useClub } from '@/lib/club'
import { keys } from '@/lib/queryClient'
import { useChatThread } from '@/components/chat/useChatThread'
import { ChannelList } from '@/components/chat/ChannelList'
import { MessageThread } from '@/components/chat/MessageThread'
import { TaskPanel } from '@/components/chat/TaskPanel'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'

export default function ChatPage() {
  const { clubId, api } = useClub()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [result, setResult] = useState(null)
  const [created, setCreated] = useState({})
  const quoteRef = useRef(null)
  const channels = useQuery({ queryKey: ['club', String(clubId), 'channels'], queryFn: api.chat.channels })
  const events = useQuery({ queryKey: ['club', String(clubId), 'chat', 'events'], queryFn: () => api.events.list() })
  const members = useQuery({ queryKey: ['club', String(clubId), 'chat', 'members'], queryFn: api.members.list })
  const activeId = channels.data?.some((c) => String(c.id) === String(selectedId)) ? selectedId : channels.data?.[0]?.id
  const channel = channels.data?.find((c) => String(c.id) === String(activeId))
  const thread = useChatThread({ api, clubId, channelId: channel?.id ?? null, me: user })
  const event = events.data?.find((e) => e.id === channel?.event_id)
  const people = Array.isArray(members.data) ? members.data : (members.data?.members ?? [])

  return <div className="flex min-h-[640px] flex-col gap-4">
    <div><p className="page-kicker">Conversations into action</p><h2 className="page-title mt-2">ClubChat</h2><p className="mt-2 text-[14px] text-muted">Keep the conversation close to the work. Turn a message into a task in one step.</p></div>
    <div className="grid min-h-[560px] flex-1 content-start gap-3 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[220px_minmax(0,1fr)_300px]">
      <ChannelList query={channels} activeId={activeId} onSelect={(id) => { setSelectedId(id); setDraft(null); setResult(null) }} className="max-h-[66px] lg:col-span-2 2xl:col-span-1 2xl:max-h-none" />
      {channel ? <MessageThread key={channel.id} channel={channel} event={event} clubId={clubId} me={user} thread={thread} draftId={draft?.message.id} created={created} onMakeTask={(message) => { setResult(null); setDraft({ message, channel, nonce: Date.now() }) }} className="h-[530px] lg:h-[min(650px,calc(100vh-280px))] 2xl:h-[min(650px,calc(100vh-230px))]" /> : <Card className="grid h-[530px] place-items-center"><EmptyState icon={MessagesSquare} title="Choose a channel" hint="Your club's conversations appear here." /></Card>}
      <TaskPanel draft={draft} landed={!!draft} quoteRef={quoteRef} result={result} members={people} events={events.data ?? []} api={api} clubId={clubId} onCreated={(task, source) => { setCreated((prev) => ({ ...prev, [source.message.id]: task })); setResult({ task, draft: source }); setDraft(null); qc.invalidateQueries({ queryKey: keys.club(clubId) }) }} onCancel={() => setDraft(null)} onAnother={() => setResult(null)} className="min-h-[300px] lg:h-[min(650px,calc(100vh-280px))] 2xl:h-[min(650px,calc(100vh-230px))]" />
    </div>
  </div>
}
