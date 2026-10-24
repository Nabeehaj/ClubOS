import { createContext, useContext, useEffect, useState } from 'react'
import { MotionConfig, useReducedMotion } from 'framer-motion'

// Motion language: springs without bounce. Motion answers an action or shows a change; it is never ambient.
export const spring = { type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }
export const softSpring = { type: 'spring', stiffness: 160, damping: 26 }
export const easeOutExpo = [0.16, 1, 0.3, 1]

export const stagger = (step = 0.035, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
})

export const rise = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOutExpo } },
}

export const pop = {
  hidden: { opacity: 0, scale: 0.98 },
  show: { opacity: 1, scale: 1, transition: spring },
}

const QualityContext = createContext({ quality: 'high', reduced: false, setQuality: () => {} })

const QUALITY_KEY = 'clubos.quality'

// Drops heavy effects (the login 3D scene) to 'low' if the device can't hold the frame rate.
function useFpsGuard(enabled, onSlow) {
  useEffect(() => {
    if (!enabled) return
    let frames = 0
    let slowWindows = 0
    let last = performance.now()
    let raf
    const tick = (now) => {
      frames++
      if (now - last >= 1000) {
        const fps = (frames * 1000) / (now - last)
        slowWindows = fps < 38 ? slowWindows + 1 : 0
        if (slowWindows >= 3) {
          onSlow()
          return
        }
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    const start = setTimeout(() => (raf = requestAnimationFrame(tick)), 1500)
    return () => {
      clearTimeout(start)
      cancelAnimationFrame(raf)
    }
  }, [enabled, onSlow])
}

export function MotionProvider({ children }) {
  const reduced = useReducedMotion()
  const [quality, setQualityState] = useState(() => {
    try {
      return localStorage.getItem(QUALITY_KEY) || 'auto'
    } catch {
      return 'auto'
    }
  })
  const [autoLow, setAutoLow] = useState(false)

  const setQuality = (q) => {
    setQualityState(q)
    setAutoLow(false)
    try {
      localStorage.setItem(QUALITY_KEY, q)
    } catch {
      /* ignore */
    }
  }

  useFpsGuard(quality === 'auto' && !autoLow && !reduced, () => setAutoLow(true))

  const effective = reduced || quality === 'low' || (quality === 'auto' && autoLow) ? 'low' : 'high'

  useEffect(() => {
    document.documentElement.dataset.quality = effective
  }, [effective])

  return (
    <QualityContext.Provider value={{ quality: effective, setting: quality, reduced: !!reduced, setQuality }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QualityContext.Provider>
  )
}

export function useQuality() {
  return useContext(QualityContext)
}
