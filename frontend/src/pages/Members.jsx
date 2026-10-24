import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useClub } from '@/lib/club'
import { useAuth } from '@/lib/auth'
import { rise, stagger } from '@/lib/motion'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { MemberCard } from '@/components/members/MemberCard'
import { WorkloadPanel } from '@/components/members/WorkloadPanel'
import { MemberTasksSheet } from '@/components/members/MemberTasksSheet'
import { computeWorkload } from '@/components/members/workload'

function Fact({ label, children }) {
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <dt className="text-[12px] text-faint">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold text-fg">{children}</dd>
    </div>
  )
}

function ClubHeader({ club, boardSize, totalOpen }) {
  return (
    <motion.div variants={rise} className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        <h2 className="font-display text-[22px] font-semibold leading-tight text-fg">{club?.name ?? 'Executive board'}</h2>
        {club?.description && <p className="mt-1 text-[14px] leading-relaxed text-muted">{club.description}</p>}
      </div>
      <dl className="flex flex-wrap divide-x divide-line">
        {club?.member_count > 0 && (
          <Fact label="Members">
            <span className="tabular">{club.member_count}</span>
          </Fact>
        )}
        <Fact label="Demo board">
          <span className="tabular">{boardSize}</span> <span className="font-normal text-muted">sample accounts</span>
        </Fact>
        <Fact label="Open tasks">
          <span className="tabular">{totalOpen}</span>
        </Fact>
        {club?.email && (
          <Fact label="Club email">
            <a href={`mailto:${club.email}`} className="font-medium underline-offset-4 hover:underline">
              {club.email}
            </a>
          </Fact>
        )}
      </dl>
    </motion.div>
  )
}

function MembersSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the executive board">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-80" />
      </div>
      <Skeleton className="h-[320px] rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[330px] rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function PublicFacts({ club }) {
  const facts = club?.public_facts
  if (!facts) return null
  const officer = facts.officer_from_spreadsheet
  return (
    <motion.section variants={rise} className="rounded-xl border border-line bg-ink-900 p-5" aria-label="SBCS public facts">
      <p className="page-kicker">SBCS public facts</p>
      <div className="mt-3 grid gap-5 text-[13px] leading-relaxed text-muted md:grid-cols-2">
        <div>
          <p className="font-semibold text-fg">Club contact</p>
          <a href={`mailto:${club.email}`} className="underline-offset-4 hover:underline">{club.email}</a>
          {officer && <p className="mt-3"><span className="font-semibold text-fg">Spreadsheet listing:</span> {officer.name}, {officer.role}. <span className="text-faint">{officer.note}</span></p>}
          {officer?.email && <a href={`mailto:${officer.email}`} className="mt-1 block underline-offset-4 hover:underline">{officer.email}</a>}
        </div>
        <div>
          <p className="font-semibold text-fg">Meeting information</p>
          <p>{facts.meeting_note}</p>
          <a href={facts.club_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-copper underline-offset-4 hover:underline">View SBCS’s university page ↗</a>
        </div>
      </div>
    </motion.section>
  )
}

export default function Members() {
  const { clubId, club, api } = useClub()
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['club', String(clubId), 'members'], queryFn: api.members.list })

  // Keep the last selected member while the sheet animates out.
  const [selected, setSelected] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const openSheet = (m) => {
    setSelected(m)
    setSheetOpen(true)
  }

  const members = useMemo(() => (Array.isArray(q.data) ? q.data : (q.data?.members ?? [])), [q.data])
  const workload = useMemo(() => computeWorkload(members), [members])

  if (q.isPending) return <MembersSkeleton />
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} className="mt-4" />

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={rise}>
        <p className="page-kicker">Club profile and demo workspace</p>
        <h2 className="page-title mt-2">Members</h2>
        <p className="mt-2 text-[14px] text-muted">Real club details above; fictional board accounts below for exploring ClubOS.</p>
      </motion.div>
      <ClubHeader club={club} boardSize={members.length} totalOpen={workload.totalOpen} />
      <PublicFacts club={club} />

      {members.length === 0 ? (
        <motion.div variants={rise} className="rounded-xl border border-line bg-ink-900">
          <EmptyState
            icon={Users}
            title="No board members yet"
            hint="Officers you add to this club appear here with their tasks and responsibilities."
          />
        </motion.div>
      ) : (
        <>
          <WorkloadPanel members={members} workload={workload} clubId={clubId} onSelect={openSheet} />

          <section aria-labelledby="board-heading">
            <motion.h2 id="board-heading" variants={rise} className="mb-3 text-[14px] font-semibold text-fg">
              Demo board members <span className="tabular font-normal text-faint">{members.length}</span>
            </motion.h2>
            <motion.div variants={stagger()} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {members.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  level={workload.levels[m.id]}
                  maxTotal={workload.maxTotal}
                  isMe={user?.id != null && String(user.id) === String(m.id)}
                  onViewTasks={openSheet}
                />
              ))}
            </motion.div>
          </section>
        </>
      )}

      <MemberTasksSheet
        member={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        clubId={clubId}
        api={api}
        level={selected ? workload.levels[selected.id] : null}
        maxTotal={workload.maxTotal}
      />
    </motion.div>
  )
}
