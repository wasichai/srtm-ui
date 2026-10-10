import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useMenuButton } from './useMenuButton'

// the header's menus (ThemeMenu, MenuSesion) go through PortalApp's and shellPortal's tests; this is the pattern alone

function Menu({ marcado }: { marcado?: string }) {
  const { open, close, rootProps, buttonProps, menuProps } = useMenuButton({
    rol: 'menuitemradio',
    primero: marcado ? (items) => items.find((item) => item.textContent === marcado) : undefined
  })
  return (
    <>
      <div {...rootProps}>
        <button {...buttonProps} type="button">
          Opciones
        </button>
        {open && (
          <div {...menuProps} aria-label="Opciones">
            {['Uno', 'Dos', 'Tres'].map((texto) => (
              <button key={texto} type="button" role="menuitemradio" aria-checked={texto === marcado} tabIndex={-1} onClick={close}>
                {texto}
              </button>
            ))}
          </div>
        )}
      </div>
      <p>fuera</p>
    </>
  )
}

const opcion = (name: string) => screen.getByRole('menuitemradio', { name })

describe('useMenuButton', () => {
  it('ties the button to its menu while it is open', async () => {
    render(<Menu />)
    const boton = screen.getByRole('button', { name: 'Opciones' })
    expect(boton).toHaveAttribute('aria-haspopup', 'menu')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(boton).not.toHaveAttribute('aria-controls')
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(boton).toHaveAttribute('aria-controls', screen.getByRole('menu', { name: 'Opciones' }).id)
  })

  it('focuses the first item, or the one asked for, when it opens', async () => {
    const { unmount } = render(<Menu />)
    await userEvent.click(screen.getByRole('button', { name: 'Opciones' }))
    expect(opcion('Uno')).toHaveFocus()
    unmount()
    render(<Menu marcado="Dos" />)
    await userEvent.click(screen.getByRole('button', { name: 'Opciones' }))
    expect(opcion('Dos')).toHaveFocus()
  })

  it('opens from the keyboard and walks the items round, home and end to the ends', async () => {
    render(<Menu />)
    screen.getByRole('button', { name: 'Opciones' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(opcion('Uno')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(opcion('Tres')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(opcion('Uno')).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(opcion('Tres')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(opcion('Uno')).toHaveFocus()
  })

  it('closes with escape, focus back on the button; with tab or a press outside, without moving it', async () => {
    render(<Menu />)
    const boton = screen.getByRole('button', { name: 'Opciones' })
    await userEvent.click(boton)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(boton).toHaveFocus()

    await userEvent.click(boton)
    await userEvent.tab()
    expect(screen.queryByRole('menu')).toBeNull()

    await userEvent.click(boton)
    await userEvent.click(screen.getByText('fuera'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('a pick that closes it gives focus back to the button', async () => {
    render(<Menu />)
    await userEvent.click(screen.getByRole('button', { name: 'Opciones' }))
    await userEvent.click(opcion('Dos'))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'Opciones' })).toHaveFocus()
  })
})
