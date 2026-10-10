import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'

// the shell of the portal-tributario theme (issue #52): brand bar with the search and a session menu, a light
// lateral and the institutional footer. light, dark and system keep the classic shell

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

// the home page drawn, and the permissions in: the bar says so, by the session menu (portal) or by the way to the
// administration (classic)
async function listo() {
  expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  const bar = screen.getByRole('banner')
  await waitFor(() =>
    expect(
      within(bar).queryByRole('button', { name: 'Admin Rentas, Administrador: menú de sesión' }) ?? within(bar).queryByRole('link', { name: /Administración/ })
    ).toBeInTheDocument()
  )
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
    // white on the bar, with its own dark text: the bar's white would not show on it. it takes the room the
    // administration left, up to 36rem
    expect(within(bar).getByRole('searchbox', { name: 'Buscar' })).toHaveClass('bg-surface', 'text-ink')
    expect(within(bar).getByRole('search')).toHaveClass('max-w-xl')
    expect(within(bar).getByRole('search')).not.toHaveClass('max-w-md')
    // no administration in the bar: an admin has it in the session menu and at the end of the tree
    expect(within(bar).queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument()
    expect(within(lateral()).getByRole('link', { name: 'Administración' })).toHaveAttribute('href', '/admin')
    expect(within(bar).getByRole('button', { name: /^Tema: Portal tributario/ })).toBeInTheDocument()
    // the session: initials, name and role on the button, sign-out inside its menu
    expect(within(bar).getByRole('button', { name: 'Admin Rentas, Administrador: menú de sesión' })).toHaveTextContent('ARAdmin RentasAdministrador')
    expect(within(bar).queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()

    // not the dark sidebar: the lateral is light, its links in the link colour, the current one marked (the tree
    // itself: arbolNav.test.tsx)
    expect(lateral()).not.toHaveClass('bg-shell')
    expect(lateral()).toHaveClass('bg-table-head')
    expect(within(lateral()).getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('aria-current', 'page')
    expect(within(lateral()).getByRole('link', { name: 'Buscar contribuyentes' })).toHaveClass('text-link')

    expect(screen.getByRole('contentinfo')).toHaveTextContent('Municipalidad Distrital de Perené — Sistema de Gestión Tributaria Municipal')
    // the workspace tabs over the content, as in the classic shell
    expect(screen.getByRole('navigation', { name: 'Fichas abiertas' })).toBeInTheDocument()
  })

  it.each(['light', 'dark', 'system'])('keeps the classic shell with %s', async (theme) => {
    start(theme)
    await listo()
    expect(screen.getByRole('banner')).not.toHaveClass('bg-shell')
    // the administration in the bar, and the search as it was
    expect(within(screen.getByRole('banner')).getByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/admin')
    expect(within(screen.getByRole('banner')).getByRole('search')).toHaveClass('relative w-full max-w-md', { exact: true })
    expect(lateral()).toHaveClass('bg-shell')
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

  // the trail: under the portal, a plain line atop the scrolling content (no strip under the workspace tabs any more)
  it('writes the trail as a plain line atop the content, before the page', async () => {
    start('portal-tributario', { path: '/contribuyentes' })
    const titulo = await screen.findByRole('heading', { name: 'Contribuyentes' })
    const ruta = screen.getByRole('navigation', { name: 'Ruta' })
    expect(
      within(ruta)
        .getAllByRole('listitem')
        .map((paso) => paso.textContent)
    ).toEqual(['Registro tributario y determinación', 'Registro tributario', 'Contribuyentes'])
    // 12px muted, 8px over the page, no white strip nor border
    expect(ruta).toHaveClass('mb-2', 'text-xs', 'text-ink-muted')
    expect(ruta).not.toHaveClass('border-b')
    expect(ruta).not.toHaveClass('bg-surface')
    const ultimo = within(ruta).getAllByRole('listitem').at(-1)!
    expect(ultimo).toHaveAttribute('aria-current', 'page')
    expect(ultimo).toHaveClass('font-bold', 'text-ink')
    // first in the scrolling content, the page after it; not right under the workspace tabs
    const contenido = ruta.parentElement!
    expect(contenido).toHaveClass('overflow-auto')
    expect(contenido.firstElementChild).toBe(ruta)
    expect(contenido).toContainElement(titulo)
    expect(screen.getByRole('navigation', { name: 'Fichas abiertas' }).nextElementSibling).toBe(contenido)
  })

  it.each(['light', 'dark'])('keeps the trail as a strip under the workspace tabs with %s', async (theme) => {
    start(theme, { path: '/contribuyentes' })
    await screen.findByRole('heading', { name: 'Contribuyentes' })
    const ruta = screen.getByRole('navigation', { name: 'Ruta' })
    expect(ruta).toHaveClass('border-b border-border bg-surface px-6 py-2 text-xs text-ink-muted', { exact: true })
    expect(screen.getByRole('navigation', { name: 'Fichas abiertas' }).nextElementSibling).toBe(ruta)
    expect(within(ruta).getAllByRole('listitem').at(-1)).toHaveClass('flex items-center gap-1 font-semibold text-ink', { exact: true })
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
    // the trail moved into the content, the page with it untouched
    expect(screen.getByRole('navigation', { name: 'Ruta' })).toHaveClass('mb-2')
  })
})
