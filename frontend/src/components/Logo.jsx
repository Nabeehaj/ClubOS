import clsx from 'clsx'

// ClubOS mark: a copper gear with a solid hub. Static; it is a mark, not a toy.
export function LogoMark({ size = 28, className }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={clsx('shrink-0', className)} aria-hidden>
      <path
        d="M32 6l4.5 6.5 7.8-2.2 1 8 7.8 2.4-3.3 7.3 5.6 5.6-6.6 4.4 1.1 7.9-7.9-.1-3.3 7.3-6.7-4.5-6.7 4.5-3.3-7.3-7.9.1 1.1-7.9-6.6-4.4 5.6-5.6-3.3-7.3 7.8-2.4 1-8 7.8 2.2z"
        fill="#a8422d"
      />
      <circle cx="32" cy="34" r="10" fill="#202824" />
      <circle cx="32" cy="34" r="4.5" fill="#f4f2ed" />
    </svg>
  )
}

export function Wordmark({ className }) {
  return <span className={clsx('font-display text-[17px] font-semibold text-fg', className)}>ClubOS</span>
}
