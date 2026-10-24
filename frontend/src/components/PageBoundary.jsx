import { Component, Suspense } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'
import { SkeletonRows } from '@/components/ui/States'

// Keeps one broken screen from blanking the whole app: the sidebar and other screens stay usable.
class Boundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info?.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="glass max-w-md rounded-3xl p-8 text-center">
          <AlertOctagon className="mx-auto size-8 text-bad" aria-hidden />
          <h2 className="font-display mt-4 text-lg font-bold">This screen hit a snag</h2>
          <p className="mt-2 text-sm text-muted">The rest of ClubOS still works. Reload to try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-fg ring-1 ring-white/10 hover:bg-white/5"
          >
            <RefreshCw className="size-4" aria-hidden /> Reload
          </button>
        </div>
      </div>
    )
  }
}

export function PageBoundary({ children }) {
  return (
    <Boundary>
      <Suspense
        fallback={
          <div className="glass mt-2 rounded-2xl p-6">
            <SkeletonRows rows={5} />
          </div>
        }
      >
        {children}
      </Suspense>
    </Boundary>
  )
}
