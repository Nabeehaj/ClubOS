import { Navigate, useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useAuth } from '@/lib/auth'
import { useClub } from '@/lib/club'
import { sectionFromPath } from '@/lib/nav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Toaster } from '@/components/ui/Toast'

// Frame for every club screen. Pages cross-fade with a slight lift and blur on navigation.
export function AppShell() {
  const { clubs = [], defaultClubId } = useAuth()
  const { club } = useClub()
  const { pathname } = useLocation()
  const outlet = useOutlet()

  if (!club) {
    const fallback = clubs[0]?.id ?? defaultClubId
    return fallback ? <Navigate to={`/c/${fallback}/dashboard`} replace /> : <NoClubs />
  }

  // Key on club + section so switching clubs or screens both animate, but in-page changes don't.
  const pageKey = `${club.id}/${sectionFromPath(pathname)}/${pathname.split('/')[4] ?? ''}`

  return (
    <Tooltip.Provider>
      <div className="flex h-full flex-col md:flex-row">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main-content" tabIndex={-1} className="workspace-main relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-8 pb-12 pt-7">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pageKey}
                className="mx-auto max-w-[1320px]"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <Toaster />
    </Tooltip.Provider>
  )
}

function NoClubs() {
  const { signOut } = useAuth()
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="glass max-w-sm rounded-3xl p-8">
        <h1 className="font-display text-xl font-bold">No clubs yet</h1>
        <p className="mt-2 text-sm text-muted">
          Your account isn&apos;t on any club&apos;s executive board. Ask your club president to add you.
        </p>
        <button onClick={signOut} className="mt-5 text-sm font-medium text-cyan hover:underline">
          Log out
        </button>
      </div>
    </div>
  )
}
