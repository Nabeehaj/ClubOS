import { useId, useLayoutEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { SendHorizontal } from 'lucide-react'

const MAX = 4000

// Enter sends, Shift+Enter adds a line. The box grows with the text up to ~5 lines.
export function Composer({ channelName, onSend, disabled }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const hintId = useId()
  const ready = text.trim().length > 0 && !disabled

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [text])

  const submit = (e) => {
    e?.preventDefault()
    if (!ready) return
    onSend(text)
    setText('')
    ref.current?.focus()
  }

  return (
    <form onSubmit={submit} className="border-t border-line px-4 pb-3 pt-3">
      <div
        className={clsx(
          'flex items-end gap-2 rounded-xl border bg-ink-900 p-1.5 pl-3.5 transition-colors',
          'border-line hover:border-line-strong focus-within:border-copper',
        )}
      >
        <label htmlFor={`${hintId}-input`} className="sr-only">
          Message #{channelName}
        </label>
        <textarea
          id={`${hintId}-input`}
          ref={ref}
          rows={1}
          value={text}
          maxLength={MAX}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
          }}
          placeholder={`Message #${channelName}`}
          className="max-h-[132px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[14px] leading-relaxed text-fg placeholder:text-faint/80 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!ready}
          aria-label="Send message"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-copper text-ink-950 transition-colors hover:bg-copper-soft disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-faint"
        >
          <SendHorizontal className="size-4" aria-hidden />
        </button>
      </div>
      <p id={hintId} className="mt-1.5 px-1 text-[10.5px] text-faint">
        Press Enter to send, Shift+Enter for a new line.
      </p>
    </form>
  )
}
