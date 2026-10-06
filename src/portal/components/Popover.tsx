import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'

// a value with more behind it than a title attribute can show (title does not work on a tap, nor read by a screen
// reader): hovering the trigger opens it, same as giving it focus; a tap or a click toggles it (title does nothing
// on touch); Escape or losing focus closes it. no dependency added: plain state and aria, like MenuSesion's menu
export function Popover({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setOpen(false)
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="underline decoration-dotted decoration-1 underline-offset-2"
        aria-describedby={id}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={onKeyDown}
      >
        {trigger}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1 w-max max-w-sm rounded-md border border-border bg-surface p-2 text-left text-xs text-ink shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  )
}
