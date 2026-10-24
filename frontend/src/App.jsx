import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/shell/AppShell'
import { AmbientBackground } from '@/components/AmbientBackground'
import { LogoMark } from '@/components/Logo'
import { PageBoundary } from '@/components/PageBoundary'
import Dashboard from '@/pages/Dashboard'

const Login = lazy(() => import('@/pages/StudentLogin'))

// Each screen loads on demand, so a problem in one screen can't take down the others.
const Events = lazy(() => import('@/pages/EventsPage'))
const EventWorkspace = lazy(() => import('@/pages/EventWorkspacePage'))
const Tasks = lazy(() => import('@/pages/TaskBoardPage'))
const Chat = lazy(() => import('@/pages/ChatPage'))
const Approvals = lazy(() => import('@/pages/ApprovalsPage'))
const Finance = lazy(() => import('@/pages/Finance'))
const Emails = lazy(() => import('@/pages/EmailsPage'))
const Vendors = lazy(() => import('@/pages/Vendors'))
const Members = lazy(() => import('@/pages/Members'))

function Splash({ label = 'Loading ClubOS' }) {
  return (
    <div className="grid h-full place-items-center" role="status" aria-label={label}>
      <LogoMark size={56} />
    </div>
  )
}

function Offline() {
  const { retry } = useAuth()
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="glass max-w-sm rounded-3xl p-8 text-center">
        <h1 className="font-display text-xl font-bold">Can&apos;t reach ClubOS</h1>
        <p className="mt-2 text-sm text-muted">The server isn&apos;t answering. Start the backend, then try again.</p>
        <button onClick={retry} className="mt-5 text-sm font-medium text-cyan hover:underline">
          Try again
        </button>
      </div>
    </div>
  )
}

function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'checking') return <Splash />
  if (status === 'offline') return <Offline />
  if (status !== 'authed') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function Home() {
  const { defaultClubId, clubs = [] } = useAuth()
  const id = defaultClubId ?? clubs[0]?.id
  return <Navigate to={id ? `/c/${id}/dashboard` : '/login'} replace />
}

const PAGES = [
  ['dashboard', Dashboard],
  ['events', Events],
  ['events/:eventId', EventWorkspace],
  ['tasks', Tasks],
  ['chat', Chat],
  ['approvals', Approvals],
  ['finance', Finance],
  ['emails', Emails],
  ['vendors', Vendors],
  ['members', Members],
]

export default function App() {
  return (
    <>
      <AmbientBackground />
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route index element={<Home />} />
            <Route path="/c/:clubId" element={<AppShell />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              {PAGES.map(([path, Page]) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <PageBoundary>
                      <Page />
                    </PageBoundary>
                  }
                />
              ))}
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
