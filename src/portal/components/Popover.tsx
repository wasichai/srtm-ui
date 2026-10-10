import { useEffect, useId, useRef, useState, type FocusEvent, type ReactNode } from 'react'

// a value with more behind it than a title attribute can show (title does nothing on a tap, nor for a screen reader):
// a disclosure, its button saying whether it is open (aria-expanded) and what it opens (aria-controls). a click, a tap,
// Enter or Space open it and never close it: a real pointer sends mouseover, focus and click in a row, and a toggle
// would close what the hover had just opened. hovering it with a mouse opens it too, and leaving it closes it - the
// trigger and the content both: the content sits inside, with no gap, so the pointer can move onto it. Escape (with
// the focus anywhere), a click or a tap outside, or the focus leaving it close it. the content opens under the
// trigger, toward the side with room: from the right half of the screen it opens to the left, so a late month of a
// table that scrolls sideways is not cut off at its edge. no dependency added: plain state and aria, like MenuSesion
export function Popover({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [haciaIzquierda, setHaciaIzquierda] = useState(false)
  const id = useId()
  const raiz = useRef<HTMLSpanElement>(null)

  const abrir = () => {
    if (open) return
    const caja = raiz.current?.getBoundingClientRect()
    setHaciaIzquierda(caja !== undefined && caja.left + caja.width / 2 > window.innerWidth / 2)
    setOpen(true)
  }
  const cerrar = () => setOpen(false)

  // while open, and only then: Escape wherever the focus is, and a press anywhere outside
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!raiz.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const onBlur = (event: FocusEvent) => {
    if (!raiz.current?.contains(event.relatedTarget as Node | null)) cerrar()
  }

  return (
    <span ref={raiz} className="relative inline-block" onMouseEnter={abrir} onMouseLeave={cerrar} onBlur={onBlur}>
      <button
        type="button"
        className="underline decoration-dotted decoration-1 underline-offset-2"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={abrir}
      >
        {trigger}
      </button>
      {open && (
        // pt-1, not mt-1: the space between trigger and content is still inside, so crossing it does not close it
        <span id={id} className={`absolute top-full z-30 block pt-1 ${haciaIzquierda ? 'right-0' : 'left-0'}`}>
          <span className="block w-max max-w-sm rounded-md border border-border bg-surface p-2 text-left text-xs text-ink shadow-lg">{children}</span>
        </span>
      )}
    </span>
  )
}
