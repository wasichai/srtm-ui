import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

// a menu button (the wai-aria pattern), as the header's theme and session menus draw it: a click or the up and down
// arrows on the button open it; open, focus goes to `primero` of its items (by `rol`: menuitem, menuitemradio), the
// arrows walk them round, home and end jump to the ends, escape closes it and gives focus back to the button, and tab
// or a press anywhere else closes it. the component spreads the props on its root, its button and its menu; `close`
// gives focus back to the button, setOpen(false) does not (a pick that leaves the page)
export function useMenuButton({
  rol,
  primero = (items) => items[0]
}: {
  rol: 'menuitem' | 'menuitemradio'
  primero?: (items: HTMLElement[]) => HTMLElement | undefined
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>(`[role="${rol}"]`) ?? [])

  // opened: focus on its first item, and a press anywhere else closes it
  useEffect(() => {
    if (!open) return
    primero(items())?.focus()
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  const onMenuKey = (event: KeyboardEvent) => {
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLElement)
    const focus = (index: number) => {
      event.preventDefault()
      list[(index + list.length) % list.length]?.focus()
    }
    if (event.key === 'ArrowDown') focus(at + 1)
    else if (event.key === 'ArrowUp') focus(at < 0 ? -1 : at - 1)
    else if (event.key === 'Home') focus(0)
    else if (event.key === 'End') focus(-1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') setOpen(false)
  }

  const onButtonKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    setOpen(true)
  }

  return {
    open,
    setOpen,
    close,
    rootProps: { ref: root },
    buttonProps: {
      ref: button,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': open,
      'aria-controls': open ? menuId : undefined,
      onClick: () => setOpen((was) => !was),
      onKeyDown: onButtonKey
    },
    menuProps: { ref: menu, id: menuId, role: 'menu', onKeyDown: onMenuKey }
  }
}
