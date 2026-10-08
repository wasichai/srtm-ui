import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Popover } from './Popover'

// a disclosure (aria-expanded and aria-controls), not a tooltip: a real pointer sends mouseover, focus and click in a
// row, so each way in is driven as the browser sends it (userEvent), never one bare event that hides the others

function montar() {
  return render(
    <div>
      <Popover trigger="S/ 8.50">
        <span>0.0514 S/ por m² × 100.00 m² = 5.14</span>
      </Popover>
      <button type="button">Otra cosa</button>
    </div>
  )
}

const boton = () => screen.getByRole('button', { name: 'S/ 8.50' })
const contenido = () => screen.queryByText('0.0514 S/ por m² × 100.00 m² = 5.14')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Popover', () => {
  it('a click with a mouse opens it, and it stays open (the hover and the click do not undo each other)', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(boton())
    expect(boton()).toHaveAttribute('aria-expanded', 'true')
    expect(contenido()).toBeInTheDocument()
    await user.click(boton())
    expect(contenido()).toBeInTheDocument()
  })

  it('a tap opens it, and it stays open', async () => {
    const user = userEvent.setup()
    montar()
    await user.pointer([{ keys: '[TouchA]', target: boton() }])
    expect(boton()).toHaveAttribute('aria-expanded', 'true')
    expect(contenido()).toBeInTheDocument()
  })

  // opened by the hover, the focus nowhere and the pointer still over it: only the press outside can close it
  it('a press outside closes it, with nothing focused', async () => {
    const user = userEvent.setup()
    montar()
    await user.hover(boton())
    expect(boton()).not.toHaveFocus()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Otra cosa' }))
    expect(contenido()).not.toBeInTheDocument()
  })

  it('a tap outside closes it', async () => {
    const user = userEvent.setup()
    montar()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(contenido()).toBeInTheDocument()
    await user.pointer([{ keys: '[TouchA]', target: screen.getByRole('button', { name: 'Otra cosa' }) }])
    expect(contenido()).not.toBeInTheDocument()
    expect(boton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('a click outside closes it', async () => {
    const user = userEvent.setup()
    montar()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(contenido()).toBeInTheDocument()
    await user.click(document.body)
    expect(contenido()).not.toBeInTheDocument()
  })

  it('from the keyboard: Tab reaches it closed, Enter opens it and keeps it open, Escape closes it', async () => {
    const user = userEvent.setup()
    montar()
    await user.tab()
    expect(boton()).toHaveFocus()
    expect(contenido()).not.toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(contenido()).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(contenido()).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(contenido()).not.toBeInTheDocument()
    expect(boton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('Tab out of it closes it', async () => {
    const user = userEvent.setup()
    montar()
    await user.tab()
    await user.keyboard('{Enter}')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Otra cosa' })).toHaveFocus()
    expect(contenido()).not.toBeInTheDocument()
  })

  it('hovering opens it, and leaving it closes it', async () => {
    const user = userEvent.setup()
    montar()
    await user.hover(boton())
    expect(contenido()).toBeInTheDocument()
    await user.unhover(boton())
    expect(contenido()).not.toBeInTheDocument()
  })

  // the browser's own events, each mouseout with the element the pointer goes to (relatedTarget): userEvent sends
  // none, which React reads as the pointer leaving the window
  it('the pointer can move from the trigger onto the content, and leaving the content closes it', async () => {
    const user = userEvent.setup()
    montar()
    await user.hover(boton())
    const panel = contenido()!
    fireEvent.mouseOut(boton(), { relatedTarget: panel })
    fireEvent.mouseOver(panel, { relatedTarget: boton() })
    expect(contenido()).toBeInTheDocument()
    const otra = screen.getByRole('button', { name: 'Otra cosa' })
    fireEvent.mouseOut(panel, { relatedTarget: otra })
    fireEvent.mouseOver(otra, { relatedTarget: panel })
    expect(contenido()).not.toBeInTheDocument()
  })

  it('Escape closes it even when it was opened by hovering, without the focus', async () => {
    const user = userEvent.setup()
    montar()
    await user.hover(boton())
    expect(boton()).not.toHaveFocus()
    await user.keyboard('{Escape}')
    expect(contenido()).not.toBeInTheDocument()
  })

  it('is a disclosure: the button controls the content, which is no tooltip', async () => {
    const user = userEvent.setup()
    montar()
    expect(boton()).toHaveAttribute('aria-expanded', 'false')
    await user.click(boton())
    const panel = contenido()!.closest('[id]')!
    expect(boton()).toHaveAttribute('aria-controls', panel.id)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('stops listening to the document once closed or unmounted', async () => {
    const user = userEvent.setup()
    const quita = vi.spyOn(document, 'removeEventListener')
    const { unmount } = montar()
    await user.click(boton())
    await user.keyboard('{Escape}')
    expect(quita).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(quita).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    quita.mockClear()
    await user.click(boton())
    unmount()
    expect(quita).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(quita).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  })

  // a late month of a table that scrolls sideways: the content opens toward the side with room, not past the edge
  it('opens toward the left when its trigger is in the right half of the screen, toward the right otherwise', async () => {
    const user = userEvent.setup()
    montar()
    const ancho = window.innerWidth
    const caja = (left: number) => ({ left, right: left + 40, width: 40, top: 0, bottom: 20, height: 20, x: left, y: 0, toJSON: () => ({}) })
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(caja(ancho - 60) as DOMRect)
    await user.click(boton())
    expect(contenido()!.closest('[id]')).toHaveClass('right-0')
    await user.keyboard('{Escape}')
    rect.mockReturnValue(caja(10) as DOMRect)
    await user.click(boton())
    expect(contenido()!.closest('[id]')).toHaveClass('left-0')
  })
})
