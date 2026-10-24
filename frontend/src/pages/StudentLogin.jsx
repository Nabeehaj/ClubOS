import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, CalendarDays, MessagesSquare, CircleCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { LogoMark, Wordmark } from '@/components/Logo'

const stops = [
  { n: '01', icon: CalendarDays, title: 'Plan the thing', detail: 'Events, budgets, and the details in between.' },
  { n: '02', icon: MessagesSquare, title: 'Bring the board', detail: 'Keep tasks and conversations together.' },
  { n: '03', icon: CircleCheck, title: 'Make it happen', detail: 'See what is ready and what needs a nudge.' },
]

export default function StudentLogin() {
  const { status, signIn, expired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'authed' && !busy) return <Navigate to="/" replace />

  async function logIn(loginEmail, loginPassword) {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await signIn(loginEmail, loginPassword)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err.status === 401 ? 'That email and password do not match. Try again.' : err.message)
      setBusy(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    logIn(email.trim(), password)
  }

  return (
    <main className="grid h-full overflow-y-auto bg-ink-950 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,.92fr)]">
      <section className="relative order-last flex min-h-[380px] flex-col overflow-hidden bg-[#1f302c] px-7 py-7 text-[#f8f5ed] sm:px-12 lg:order-first lg:min-h-full lg:px-[clamp(48px,6vw,112px)] lg:py-12">
        <div className="flex items-center gap-3">
          <LogoMark size={29} />
          <span className="font-display text-[20px] font-semibold tracking-tight">ClubOS</span>
          <span className="ml-auto border border-white/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[.14em] text-[#d4dfd7]">SBU clubs</span>
        </div>

        <div className="my-auto max-w-[620px] py-12">
          <p className="font-mono text-[11px] uppercase tracking-[.2em] text-[#e6a892]">Your board's home base</p>
          <h1 className="font-display mt-6 text-[clamp(48px,6vw,88px)] font-semibold leading-[.99] tracking-[-.065em]">
            Good ideas take <span className="text-[#e6a892]">a whole club.</span>
          </h1>
          <p className="mt-6 max-w-[440px] text-[16px] leading-7 text-[#d4dfd7]">
            From the first “what if?” to doors open, keep everyone and everything moving together.
          </p>
        </div>

        <div className="grid gap-0 border-t border-white/25 md:grid-cols-3 md:divide-x md:divide-white/15">
          {stops.map(({ n, icon: Icon, title, detail }) => (
            <div key={n} className="flex gap-3 border-b border-white/15 py-4 last:border-b-0 md:block md:border-b-0 md:px-4 md:first:pl-0">
              <div className="flex items-center gap-2 text-[#e6a892]"><Icon className="size-4" aria-hidden /><span className="font-mono text-[10px]">{n}</span></div>
              <div><p className="mt-1 text-[14px] font-semibold">{title}</p><p className="mt-1 text-[12px] leading-5 text-[#c4d0c7]">{detail}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="order-first flex min-h-[540px] items-center justify-center px-6 py-12 sm:px-12 lg:order-last">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-2 text-copper lg:hidden"><LogoMark size={27} /><Wordmark /></div>
          <div className="page-kicker">Welcome back</div>
          <h2 className="page-title mt-3 text-fg">Let’s get to work.</h2>
          <p className="mt-3 text-[15px] leading-6 text-muted">Sign in to your club's workspace.</p>

          {expired && !error && <p role="status" className="mt-6 rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-[13px] text-warn">Your session expired. Sign in again to continue.</p>}
          <form onSubmit={submit} className="mt-9 space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-2 block text-[13px] font-semibold text-fg">Email address</label>
              <div className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden /><input id="login-email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sbu.clubos" className="h-12 w-full rounded-lg border border-line-strong bg-ink-900 pl-11 pr-4 text-[15px] text-fg placeholder:text-faint focus:border-copper focus:outline-none focus:ring-2 focus:ring-copper/20" /></div>
            </div>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-[13px] font-semibold text-fg">Password</label>
              <div className="relative"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden /><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-lg border border-line-strong bg-ink-900 pl-11 pr-12 text-[15px] text-fg placeholder:text-faint focus:border-copper focus:outline-none focus:ring-2 focus:ring-copper/20" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-faint hover:bg-ink-800 hover:text-fg">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
            </div>
            {error && <p role="alert" className="rounded-lg border border-bad/25 bg-bad/5 px-4 py-3 text-[13px] text-bad">{error}</p>}
            <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-copper px-5 text-[15px] font-semibold text-white transition-colors hover:bg-copper-soft disabled:cursor-wait disabled:opacity-60">{busy ? 'Signing in…' : 'Enter ClubOS'}<ArrowRight className="size-4" aria-hidden /></button>
          </form>
          <div className="mt-8 border-t border-line pt-5">
            <button type="button" onClick={() => logIn('sarah@sbu.clubos', 'Sarah!Tech2026')} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-line-strong text-[14px] font-semibold text-fg transition-colors hover:border-copper hover:bg-ink-900 disabled:opacity-60">Explore the SBCS demo <ArrowRight className="size-4" aria-hidden /></button>
            <p className="mt-3 text-center text-[12px] leading-5 text-faint">Public SBCS facts plus simulated workflows. Changes may reset and aren’t shared.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
