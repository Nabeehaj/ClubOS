import { useCallback, useSyncExternalStore } from 'react'

// Light/dark theme. The choice lives in localStorage; with no choice we follow the OS setting.
// index.html applies it before first paint (same key) so there is no white flash on load.
const KEY = 'clubos.theme'
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const listeners = new Set()
let memory = null // used when storage is blocked

function saved() {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* storage blocked */
  }
  return memory
}

export function currentTheme() {
  return saved() ?? (media?.matches ? 'dark' : 'light')
}

function apply() {
  const theme = currentTheme()
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121614' : '#f4f1eb')
  listeners.forEach((l) => l())
}

media?.addEventListener('change', () => {
  if (!saved()) apply()
})

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light')
  const setTheme = useCallback((next) => {
    memory = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage blocked: applies for this visit only */
    }
    apply()
  }, [])
  const toggle = useCallback(() => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'), [setTheme])
  return { theme, setTheme, toggle }
}
