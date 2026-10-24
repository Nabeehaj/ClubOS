import { lazy, Suspense, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useQuality, easeOutExpo } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { LogoMark, Wordmark } from '@/components/Logo'

const GearScene = lazy(() => import('@/components/login/GearScene'))

const HEADLINE = ['Run your club', 'like a well-oiled', 'machine.']

function Headline() {
  let n = 0
  return (
    <h1 className="font-display text-[clamp(2.6rem,5.2vw,4.6rem)] font-bold leading-[0.98] tracking-[-0.035em]">
      {HEADLINE.map((line, li) => (
        <span key={li} className="block overflow-hidden pb-1">
          {line.split(' ').map((word, wi) => {
            const i = n++
            return (
              <motion.span
                key={wi}
                className={`mr-[0.22em] inline-block ${li === 2 ? 'text-energy' : 'text-fg'}`}
                initial={{ y: '110%', rotate: 6, opacity: 0 }}
                animate={{ y: '0%', rotate: 0, opacity: 1 }}
                transition={{ duration: 0.9, ease: easeOutExpo, delay: 0.35 + i * 0.07 }}
              >
                {word}
              </motion.span>
            )
          })}
        </span>
      ))}
    </h1>
  )
}

function Field({ icon: Icon, label, id, trailing, ...input }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <span className="group relative flex items-center rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/10 transition focus-within:bg-white/[0.06] focus-within:ring-[var(--accent)]">
        <Icon className="pointer-events-none absolute left-3.5 size-4 text-faint transition group-focus-within:text-[var(--accent)]" aria-hidden />
        <input
          id={id}
          className="h-12 w-full bg-transparent pl-10 pr-11 text-[15px] text-fg placeholder:text-faint/70 focus:outline-none"
          {...input}
        />
        {trailing}
      </span>
    </label>
  )
}

export default function Login() {
  const { status, signIn, expired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { quality } = useQuality()
  const boostTarget = useRef(1)
  const shake = useAnimationControls()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [launching, setLaunching] = useState(false)
  // Set before signIn resolves, so the auth change doesn't redirect before the launch animation plays.
  const submitted = useRef(false)

  if (status === 'authed' && !launching && !submitted.current) return <Navigate to="/" replace />

  async function logIn(loginEmail, loginPassword) {
    setError(null)
    setBusy(true)
    submitted.current = true
    try {
      await signIn(loginEmail, loginPassword)
      // Engine start: spin the machine up, then fly into the app.
      setLaunching(true)
      boostTarget.current = 14
      setTimeout(() => navigate(location.state?.from ?? '/', { replace: true }), quality === 'high' ? 1100 : 250)
    } catch (err) {
      submitted.current = false
      setBusy(false)
      setError(
        err.status === 401 ? 'That email and password don’t match a ClubOS account.' : err.message,
      )
      shake.start({ x: [0, -12, 10, -7, 5, -2, 0], transition: { duration: 0.5 } })
    }
  }

  function onSubmit(e) {
    e.preventDefault()
    logIn(email.trim(), password)
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* 3D machine */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 1.08 }}
        animate={launching ? { opacity: 0, scale: 1.6 } : { opacity: 1, scale: 1 }}
        transition={{ duration: launching ? 1.1 : 2, ease: easeOutExpo }}
        aria-hidden
      >
        <Suspense fallback={null}>
          <GearScene boostTarget={boostTarget} quality={quality} />
        </Suspense>
      </motion.div>

      {/* Scrims: keep the headline and the card readable over the machine */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_15%_100%,rgb(5_7_13/0.92),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[45%] bg-gradient-to-l from-ink-950/70 to-transparent" />

      <div className="relative z-10 mx-auto grid h-full max-w-[1400px] grid-cols-1 items-center gap-10 px-8 lg:grid-cols-[1fr_440px] lg:px-16">
        {/* Story */}
        <motion.div
          className="pointer-events-none hidden self-end pb-16 lg:block"
          animate={launching ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-copper-soft ring-1 ring-inset ring-copper/25"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-copper" /> Stony Brook student organizations
          </motion.div>
          <Headline />
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.8, ease: easeOutExpo }}
            className="mt-6 max-w-md text-[15px] leading-relaxed text-muted"
          >
            Events, tasks, chat, approvals and budgets in one place, so your e-board spends less time chasing forms
            and more time building.
          </motion.p>
        </motion.div>

        {/* Sign-in card */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 12 }}
          animate={
            launching
              ? { opacity: 0, scale: 0.9, y: -30, filter: 'blur(12px)' }
              : { opacity: 1, y: 0, rotateX: 0 }
          }
          transition={{ duration: launching ? 0.7 : 1, ease: easeOutExpo, delay: launching ? 0.15 : 0.5 }}
          style={{ perspective: 1200 }}
        >
          <motion.form
            onSubmit={onSubmit}
            animate={shake}
            className="glass relative overflow-hidden rounded-[28px] p-8 sm:p-10"
            noValidate
          >
            {/* top edge glow */}
            <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
            <div className="flex items-center gap-3">
              <LogoMark size={40} />
              <Wordmark className="text-2xl" />
            </div>
            <h2 className="font-display mt-8 text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted">Pick up where your e-board left off.</p>

            <AnimatePresence>
              {expired && !error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn ring-1 ring-inset ring-warn/20"
                >
                  Your session expired. Please sign in again.
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-7 space-y-4">
              <Field
                icon={Mail}
                id="email"
                label="Email"
                type="email"
                autoComplete="username"
                placeholder="you@sbu.clubos"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Field
                icon={Lock}
                id="password"
                label="Password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                trailing={
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 grid size-8 place-items-center rounded-lg text-faint hover:text-fg"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 text-sm text-bad"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              size="lg"
              magnetic
              loading={busy}
              disabled={!email || !password}
              className="mt-7 w-full"
            >
              {launching ? 'Starting engines…' : 'Log in'}
              {!busy && <ArrowRight className="size-4" aria-hidden />}
            </Button>

            <div className="mt-5 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={() => logIn('sarah@sbu.clubos', 'Sarah!Tech2026')}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-fg transition hover:border-[var(--accent)] hover:bg-white/[0.06] disabled:opacity-50"
              >
                Explore the SBCS demo <ArrowRight className="size-4" aria-hidden />
              </button>
              <p className="mt-3 text-center text-xs leading-relaxed text-faint">
                Public SBCS facts plus clearly labeled demo workflows. Changes may reset and aren’t shared.
              </p>
            </div>
          </motion.form>
        </motion.div>
      </div>
    </div>
  )
}
