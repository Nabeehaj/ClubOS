import { useState } from 'react'
import clsx from 'clsx'
import { initials } from '@/lib/format'

// Initials on a neutral disc by default; avatar_url only when `photo` is set (DiceBear art reads as clip-art at small sizes).
// eslint-disable-next-line no-unused-vars
export function Avatar({ user, size = 28, className, ring = false, photo = false }) {
  const [broken, setBroken] = useState(false)
  const name = user?.name ?? ''
  return (
    <span
      className={clsx(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-line-strong bg-ink-800 font-medium text-muted',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      title={name}
    >
      {photo && user?.avatar_url && !broken ? (
        <img src={user.avatar_url} alt="" className="size-full object-cover" onError={() => setBroken(true)} loading="lazy" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  )
}
