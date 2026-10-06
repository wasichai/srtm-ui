import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'

// the shell of the portal-tributario theme (issue #52): brand bar with the search and a session menu, the open fichas
// as its second row, a light rail of modules and the institutional footer. light, dark and system keep the classic shell

// jsdom has no webgl: the map is not what these tests look at
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const user = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin Rentas', organizationId: 'o1', roles: ['ADMIN'] }
const page = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => fetch?.restore())

// signed in with the theme stored in the browser and for the user (the server's copy wins once it loads)
function start(theme: string, { path = '/', admin = true } = {}) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(user))
  localStorage.setItem('srtm.theme', theme)
  window.history.pushState({}, '', path)
  const routes: MockRoute[] = [
    { path: '/auth/me/permissions', body: { admin, objects: {} } },
    { path: '/auth/me/preferences', body: { theme, locale: null } },
    { method: 'PUT', path: '/auth/me/preferences', body: { theme: 'portal-tributario', locale: null } },
    { path: '/srtm/resumen', body: { anio: 2026, contribuyentes: 11840, predios: 14947, declaraciones: 15644 } },
    { path: '/srtm/contribuyentes', body: page([]) },
    { path: '/srtm/predios', body: page([]) }
  ]
  fetch = mockFetch(routes)
  render(<PortalApp />)
}

// the home page drawn, and the permissions in: an admin gets the way to the administration (in the classic bar; in the
// portal's rail and its session menu)
async function listo() {
  expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/admin')
}

const sesion = () => screen.getByRole('button', { name: /menú de sesión/ })
const lateral = () => screen.getByRole('navigation', { name: 'Secciones' })

describe('portal-tributario shell', () => {
  it('draws the brand bar, a light lateral and the institutional footer', async () => {
    start('portal-tributario')
    await listo()

    const bar = screen.getByRole('banner')
    expect(bar).toHaveClass('bg-shell', 'text-shell-ink')
    expect(within(bar).getByText('Rentas municipales')).toBeInTheDocument()
    expect(within(bar).getByText('Municipalidad Distrital de Perené')).toBeInTheDocument()
    // white on the bar, with its own dark text: the bar's white would not show on it
    expect(within(bar).getByRole('searchbox', { name: 'Buscar' })).toHaveClass('bg-surface', 'text-ink')
    // the administration is in the rail and the session menu, not in the bar
    expect(within(bar).queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: /^Tema: Portal tributario/ })).toBeInTheDocument()
    // the session: initials, name and role on the button, sign-out inside its menu
    expect(within(bar).getByRole('button', { name: 'Admin Rentas, Administrador: menú de sesión' })).toHaveTextContent('ARAdmin RentasAdministrador')
    expect(within(bar).queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()

    // not the dark sidebar: a light rail, the current section marked (the rail itself: rielNav.test.tsx)
    expect(lateral()).not.toHaveClass('bg-shell')
    expect(lateral()).toHaveClass('bg-table-head')
    expect(within(lateral()).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')

    expect(screen.getByRole('contentinfo')).toHaveTextContent('Municipalidad Distrital de Perené — Sistema de Gestión Tributaria Municipal')
    // the open fichas are the bar's second row, like a browser's tabs: not over the content
    const fichas = within(bar).getByRole('navigation', { name: 'Fichas abiertas' })
    expect(fichas).toHaveAttribute('data-ubicacion', 'cabecera')
    expect(fichas).toHaveClass('basis-full')
    expect(bar).toHaveClass('flex-wrap')
    expect(bar.lastElementChild).toBe(fichas)
    expect(within(screen.getByRole('main')).queryByRole('navigation', { name: 'Fichas abiertas' })).not.toBeInTheDocument()
    expect(within(fichas).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it.each(['light', 'dark', 'system'])('keeps the classic shell with %s', async (theme) => {
    start(theme)
    await listo()
    expect(screen.getByRole('banner')).not.toHaveClass('bg-shell')
    expect(within(screen.getByRole('banner')).getByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/admin')
    expect(lateral()).toHaveClass('bg-shell')
    // the workspace tabs over the content
    const fichas = within(screen.getByRole('main')).getByRole('navigation', { name: 'Fichas abiertas' })
    expect(fichas).not.toHaveAttribute('data-ubicacion')
    expect(fichas).toHaveClass('border-b', 'border-border', 'bg-surface', 'px-4')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /menú de sesión/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })

  it('opens the session menu, walks it with the arrows and closes it with escape, focus back on the button', async () => {
    start('portal-tributario')
    await listo()
    const button = sesion()
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Sesión' })
    expect(button).toHaveAttribute('aria-controls', menu.id)
    // who is signed in heads the panel
    expect(screen.getByText('admin@wasichai.local')).toBeInTheDocument()
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Administración', 'Cerrar sesión'])
    expect(items[0]).toHaveAttribute('href', '/admin')
    expect(items[0]).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(items[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(items[1]).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(items[0]).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(items[1]).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu', { name: 'Sesión' })).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()

    // from the keyboard, and a click anywhere else closes it
    await userEvent.keyboard('{ArrowDown}')
    expect(within(screen.getByRole('menu', { name: 'Sesión' })).getByRole('menuitem', { name: 'Administración' })).toHaveFocus()
    await userEvent.click(screen.getByRole('heading', { name: 'Inicio' }))
    expect(screen.queryByRole('menu', { name: 'Sesión' })).not.toBeInTheDocument()
  })

  it('signs out from the session menu, back to the login', async () => {
    start('portal-tributario')
    await listo()
    sessionStorage.setItem('srtm.tabs', '[]')
    await userEvent.click(sesion())
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument()
    expect(localStorage.getItem('srtm.token')).toBeNull()
    expect(sessionStorage.getItem('srtm.tabs')).toBeNull()
  })

  it('tells a user who is not admin as such, with no way to the administration', async () => {
    start('portal-tributario', { admin: false })
    await screen.findByRole('heading', { name: 'Inicio' })
    // the permissions asked for and answered: not an admin
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/auth/me/permissions')).toBe(true))
    await waitFor(() => expect(sesion()).toHaveAccessibleName('Admin Rentas, Usuario: menú de sesión'))
    expect(screen.queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument()
    await userEvent.click(sesion())
    expect(
      within(screen.getByRole('menu', { name: 'Sesión' }))
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Cerrar sesión'])
  })

  it.each(['portal-tributario', 'light'])('searches both padrones from the header with %s', async (theme) => {
    start(theme)
    await listo()
    await userEvent.type(within(screen.getByRole('banner')).getByRole('searchbox', { name: 'Buscar' }), '  quispe {Enter}')
    expect(await screen.findByRole('heading', { name: 'Resultados para “quispe”' })).toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe('/buscar?q=quispe')
  })

  // one frame for both shells: a theme switch changes the bar, the lateral and the footer, not the page or the menu
  it('switches to the portal shell keeping the page and the theme menu', async () => {
    start('light', { path: '/contribuyentes' })
    await userEvent.type(await screen.findByLabelText('Buscar contribuyentes'), 'quispe')
    await userEvent.click(screen.getByRole('button', { name: /^Tema: Claro/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Portal tributario' }))

    await waitFor(() => expect(screen.getByRole('banner')).toHaveClass('bg-shell'))
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar contribuyentes')).toHaveValue('quispe')
    expect(screen.getByRole('button', { name: /^Tema: Portal tributario/ })).toHaveFocus()
  })
})
