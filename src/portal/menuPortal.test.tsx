import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { currentNavTreeLeaf, isNavTreeGroup } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'
import { arbolPara, NAV_TREE, type GrupoNav, type NodoNav } from './shell/navTree'

// the menu of the portal-tributario theme: the tree of trámites (#53) as a bar under the brand bar, one dropdown per
// group, and no lateral. light, dark and system keep the classic sidebar

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
afterEach(() => {
  fetch?.restore()
  fetch = null
  vi.restoreAllMocks()
})

// signed in with the theme stored in the browser and for the user (the server's copy wins once it loads)
function start(theme: string, { path = '/', admin = true } = {}) {
  fetch?.restore()
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(user))
  localStorage.setItem('srtm.theme', theme)
  window.history.pushState({}, '', path)
  const routes: MockRoute[] = [
    { path: '/auth/me/permissions', body: { admin, objects: {} } },
    { path: '/auth/me/preferences', body: { theme, locale: null } },
    { path: '/srtm/resumen', body: { anio: 2026, contribuyentes: 11840, predios: 14947, declaraciones: 15644 } },
    { path: '/srtm/contribuyentes', body: page([]) },
    { path: '/srtm/predios', body: page([]) }
  ]
  fetch = mockFetch(routes)
  return render(<PortalApp />)
}

// the shell drawn, and the permissions in: an admin gets the way to the administration, at the end of the portal's
// menu bar or in the classic bar
async function listo() {
  expect(await screen.findByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/admin')
}

const menu = () => screen.getByRole('navigation', { name: 'Secciones' })
const grupo = (name: string) => within(menu()).getByRole('button', { name })
// the dropdown a group's button controls
const panelDe = (boton: HTMLElement) => document.getElementById(boton.getAttribute('aria-controls')!)!
const GRUPOS = ['Contribuyentes', 'Predios', 'Declaraciones', 'Catastro', 'Arbitrios', 'Infracciones administrativas', 'Anuncios y propaganda', 'Emisión']

describe('NAV_TREE', () => {
  it('has no group with soloAdmin: arbolPara reads it on leaves only', () => {
    const grupos = (nodos: NodoNav[]): NodoNav[] => nodos.flatMap((nodo) => ('children' in nodo ? [nodo, ...grupos(nodo.children)] : []))
    expect(grupos(NAV_TREE).filter((nodo) => 'soloAdmin' in nodo)).toEqual([])
  })

  it('groups what a clerk does, the administration for admins only', () => {
    const ver = (nodos: NodoNav[]): unknown => nodos.map((nodo) => ('children' in nodo ? [nodo.label, ver(nodo.children)] : `${nodo.label} ${nodo.to}`))
    expect(ver(arbolPara(NAV_TREE, { isAdmin: true }))).toEqual([
      ['Contribuyentes', ['Buscar contribuyentes /contribuyentes', 'Nuevo contribuyente /contribuyentes/nuevo']],
      ['Predios', ['Buscar predios /predios', 'Nuevo predio /predios/nuevo']],
      ['Declaraciones', ['Nueva declaración /declaraciones/nueva']],
      ['Catastro', ['Nuevo lote /catastro/nuevo']],
      ['Arbitrios', ['Consulta de cuotas /arbitrios', 'Tasas del año /arbitrios/tasas', 'Determinación masiva /arbitrios/determinaciones']],
      [
        'Infracciones administrativas',
        [
          'Expedientes /infracciones',
          'Nueva acta /infracciones/nueva',
          'Notificaciones previas /infracciones/notificaciones',
          'CUIS /infracciones/cuis',
          'Escalas y plazos /infracciones/plazos'
        ]
      ],
      ['Anuncios y propaganda', ['Padrón de anuncios /anuncios', 'Nuevo anuncio /anuncios/nuevo', 'Tasas de anuncios /anuncios/tasas']],
      ['Emisión', ['Emisión masiva /emisiones']],
      'Administración /admin'
    ])
    expect(ver(arbolPara(NAV_TREE, { isAdmin: false }))).not.toContain('Administración /admin')
    expect(arbolPara(NAV_TREE, { isAdmin: false })).toHaveLength(8)
  })

  // the bar has room for one line: the long names go short there, the dropdown keeps the full one
  it('gives the long groups a short label for the bar, and keeps it through arbolPara', () => {
    const cortos = (nodos: NodoNav[]) => nodos.filter((nodo): nodo is GrupoNav => isNavTreeGroup(nodo) && nodo.corto !== undefined)
    expect(cortos(NAV_TREE).map((g) => [g.label, g.corto])).toEqual([
      ['Infracciones administrativas', 'Infracciones'],
      ['Anuncios y propaganda', 'Anuncios']
    ])
    expect(cortos(arbolPara(NAV_TREE, { isAdmin: false })).map((g) => g.corto)).toEqual(['Infracciones', 'Anuncios'])
  })

  // a leaf is current on its route and the routes under it, the most specific leaf winning; a ficha with no leaf of
  // its own (a declaration, a lote) marks none
  it.each([
    ['/', undefined],
    ['/buscar', undefined],
    ['/contribuyentes', 'Buscar contribuyentes'],
    ['/contribuyentes/123', 'Buscar contribuyentes'],
    ['/contribuyentes/nuevo', 'Nuevo contribuyente'],
    ['/contribuyentes/123/declaraciones/nueva', 'Nueva declaración'],
    ['/declaraciones/nueva', 'Nueva declaración'],
    ['/declaraciones/d1', undefined],
    ['/predios', 'Buscar predios'],
    ['/predios/p1', 'Buscar predios'],
    ['/predios/nuevo', 'Nuevo predio'],
    ['/catastro/nuevo', 'Nuevo lote'],
    ['/catastro/l1', undefined],
    ['/emisiones', 'Emisión masiva'],
    ['/arbitrios', 'Consulta de cuotas'],
    ['/arbitrios/tasas', 'Tasas del año'],
    ['/arbitrios/determinaciones', 'Determinación masiva'],
    ['/infracciones', 'Expedientes'],
    ['/infracciones/0b5e8f1a-0000-4000-8000-000000000001', 'Expedientes'],
    ['/infracciones/nueva', 'Nueva acta'],
    ['/infracciones/notificaciones', 'Notificaciones previas'],
    ['/infracciones/cuis', 'CUIS'],
    ['/infracciones/plazos', 'Escalas y plazos'],
    ['/anuncios', 'Padrón de anuncios'],
    ['/anuncios/a1', 'Padrón de anuncios'],
    ['/anuncios/nuevo', 'Nuevo anuncio'],
    ['/anuncios/tasas', 'Tasas de anuncios'],
    ['/contribuyentesx', undefined],
    ['/admin', undefined]
  ])('on %s the current leaf is %s', (path, label) => {
    expect(currentNavTreeLeaf(NAV_TREE, path)?.label).toBe(label)
  })
})

describe('portal-tributario menu bar', () => {
  it('draws the sections in a bar right under the brand bar, with no lateral and no hamburger', async () => {
    start('portal-tributario')
    await listo()
    const nav = menu()
    const bar = screen.getByRole('banner')
    expect(bar.nextElementSibling).toBe(nav)
    expect(nav).toHaveAttribute('data-ui', 'menu-portal')
    expect(nav).toHaveClass('bg-table-head', 'border-b', 'border-border')
    expect(nav).not.toHaveAttribute('id', 'sidebar')
    expect(document.getElementById('sidebar')).toBeNull()
    expect(document.querySelector('[data-slot="nav-tree"]')).toBeNull()
    // nothing to fold: no menu button in the brand bar
    expect(within(bar).queryByRole('button', { name: /^(Menú|Mostrar el menú)$/ })).not.toBeInTheDocument()

    // home first, current on the home page
    const inicio = within(nav).getByRole('link', { name: 'Inicio' })
    expect(inicio).toHaveAttribute('href', '/')
    expect(inicio).toHaveAttribute('aria-current', 'page')
    expect(inicio).toHaveClass('text-base', 'text-link')
    expect(inicio.querySelector('svg')).toHaveClass('size-4')

    // a disclosure button per group, closed, its short label in the bar and its full name for assistive tech
    const botones = within(nav).getAllByRole('button')
    expect(botones).toEqual(GRUPOS.map(grupo))
    expect(botones.map((b) => b.textContent)).toEqual([
      'Contribuyentes',
      'Predios',
      'Declaraciones',
      'Catastro',
      'Arbitrios',
      'Infracciones',
      'Anuncios',
      'Emisión'
    ])
    for (const boton of botones) {
      expect(boton).toHaveAttribute('aria-expanded', 'false')
      expect(boton).not.toHaveAttribute('aria-haspopup')
      expect(boton).toHaveAttribute('data-ui', 'menu-grupo')
      expect(boton).toHaveClass('text-base', 'font-bold', 'text-ink')
      expect(panelDe(boton)).not.toBeVisible()
    }

    // the administration at the far right, another app: a plain link with its icon
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')])
    ).toEqual([
      ['Inicio', '/'],
      ['Administración', '/admin']
    ])
    const admin = within(nav).getByRole('link', { name: 'Administración' })
    expect(admin.parentElement).toHaveClass('ml-auto')
    expect(admin.querySelector('svg')).not.toBeNull()

    // the workspace tabs and the page take the whole width under it
    const pestanas = screen.getByRole('navigation', { name: 'Fichas abiertas' })
    expect(nav.nextElementSibling).toContainElement(pestanas)
    expect(pestanas.closest('main')!.previousElementSibling).toBeNull()
  })

  it("opens a group's panel under its button, one at a time, headed by the group's full name", async () => {
    start('portal-tributario')
    await listo()
    const contribuyentes = grupo('Contribuyentes')
    const caret = contribuyentes.querySelector('svg')!
    expect(caret).toHaveClass('transition-transform', 'motion-reduce:transition-none')
    expect(caret).not.toHaveClass('rotate-180')

    await userEvent.click(contribuyentes)
    expect(contribuyentes).toHaveAttribute('aria-expanded', 'true')
    expect(caret).toHaveClass('rotate-180')
    // open, the button joins its panel: white, with the border's sides
    expect(contribuyentes).toHaveClass('bg-surface', 'border-x-border')
    const panel = panelDe(contribuyentes)
    expect(panel).toBeVisible()
    expect(panel).toHaveAttribute('data-ui', 'menu-panel')
    expect(panel).toHaveClass('absolute', 'top-full', 'min-w-70', 'max-w-[calc(100vw-1rem)]', 'bg-surface', 'border-t-0', 'border-border')
    expect(contribuyentes.parentElement).toContainElement(panel)
    expect(within(panel).getByText('Contribuyentes')).toHaveClass('text-[17px]', 'font-bold', 'text-ink')
    expect(
      within(panel)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')])
    ).toEqual([
      ['Buscar contribuyentes', '/contribuyentes'],
      ['Nuevo contribuyente', '/contribuyentes/nuevo']
    ])
    expect(within(panel).getByRole('link', { name: 'Buscar contribuyentes' })).toHaveClass('text-[15px]', 'text-link', 'border-l-4', 'border-transparent')

    const infracciones = grupo('Infracciones administrativas')
    await userEvent.click(infracciones)
    expect(contribuyentes).toHaveAttribute('aria-expanded', 'false')
    expect(contribuyentes).not.toHaveClass('bg-surface')
    expect(panel).not.toBeVisible()
    expect(infracciones).toHaveAttribute('aria-expanded', 'true')
    expect(within(panelDe(infracciones)).getByText('Infracciones administrativas')).toBeVisible()
    expect(within(panelDe(infracciones)).getAllByRole('link')).toHaveLength(5)

    // the button toggles it
    await userEvent.click(infracciones)
    expect(infracciones).toHaveAttribute('aria-expanded', 'false')
    expect(panelDe(infracciones)).not.toBeVisible()
  })

  it('works from the keyboard: escape closes the panel and gives focus back to its button', async () => {
    start('portal-tributario')
    await listo()
    const predios = grupo('Predios')
    predios.focus()
    await userEvent.keyboard('{Enter}')
    expect(predios).toHaveAttribute('aria-expanded', 'true')
    // the panel follows its button: tab walks into it
    await userEvent.tab()
    expect(within(panelDe(predios)).getByRole('link', { name: 'Buscar predios' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(predios).toHaveAttribute('aria-expanded', 'false')
    expect(predios).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(predios).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes on a click outside, on home, and when the focus leaves the bar', async () => {
    start('portal-tributario')
    await listo()
    const arbitrios = grupo('Arbitrios')
    await userEvent.click(arbitrios)
    await userEvent.click(screen.getByRole('heading', { name: 'Inicio' }))
    expect(arbitrios).toHaveAttribute('aria-expanded', 'false')

    // home is the page on screen: no route change, the click closes it all the same
    await userEvent.click(arbitrios)
    await userEvent.click(within(menu()).getByRole('link', { name: 'Inicio' }))
    expect(arbitrios).toHaveAttribute('aria-expanded', 'false')

    // the last group: tab through its leaf and the administration, then out of the bar
    const emision = grupo('Emisión')
    emision.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.tab()
    expect(within(panelDe(emision)).getByRole('link', { name: 'Emisión masiva' })).toHaveFocus()
    await userEvent.tab()
    expect(within(menu()).getByRole('link', { name: 'Administración' })).toHaveFocus()
    expect(emision).toHaveAttribute('aria-expanded', 'true')
    await userEvent.tab()
    expect(menu()).not.toContainElement(document.activeElement as HTMLElement)
    expect(emision).toHaveAttribute('aria-expanded', 'false')
  })

  it('takes a leaf to its page and closes, marking its group and the leaf', async () => {
    start('portal-tributario', { path: '/predios' })
    await listo()
    expect(grupo('Predios')).toHaveAttribute('aria-current', 'true')
    expect(grupo('Predios')).toHaveClass('border-b-link', 'text-link')
    expect(grupo('Contribuyentes')).not.toHaveAttribute('aria-current')
    expect(within(menu()).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current')

    await userEvent.click(grupo('Contribuyentes'))
    await userEvent.click(within(panelDe(grupo('Contribuyentes'))).getByRole('link', { name: 'Nuevo contribuyente' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo contribuyente' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/contribuyentes/nuevo')
    expect(grupo('Contribuyentes')).toHaveAttribute('aria-expanded', 'false')
    expect(grupo('Contribuyentes')).toHaveAttribute('aria-current', 'true')
    expect(grupo('Predios')).not.toHaveAttribute('aria-current')
    expect(grupo('Predios')).not.toHaveClass('border-b-link')

    // the leaf of the page, current in its panel, with a chevron
    await userEvent.click(grupo('Contribuyentes'))
    const panel = panelDe(grupo('Contribuyentes'))
    const hoja = within(panel).getByRole('link', { name: 'Nuevo contribuyente' })
    expect(hoja).toHaveAttribute('aria-current', 'page')
    expect(hoja).toHaveAttribute('data-ui', 'menu-hoja')
    expect(hoja).toHaveClass('border-link', 'font-bold')
    expect(hoja.querySelector('svg')).not.toBeNull()
    const otra = within(panel).getByRole('link', { name: 'Buscar contribuyentes' })
    expect(otra).not.toHaveAttribute('aria-current')
    expect(otra).toHaveClass('border-transparent')
    expect(otra.querySelector('svg')).toBeNull()
    expect(menu().querySelectorAll('[aria-current="page"]')).toHaveLength(1)

    // a pick of the leaf already on screen closes it too
    await userEvent.click(hoja)
    expect(grupo('Contribuyentes')).toHaveAttribute('aria-expanded', 'false')
  })

  it.each([
    ['/contribuyentes/123', 'Contribuyentes', 'Buscar contribuyentes'],
    ['/predios/p1', 'Predios', 'Buscar predios'],
    ['/contribuyentes/123/declaraciones/nueva', 'Declaraciones', 'Nueva declaración']
  ])('on %s marks the group %s and its leaf %s', async (path, nombre, hoja) => {
    start('portal-tributario', { path })
    await listo()
    expect(within(menu()).getAllByRole('button', { current: true })).toEqual([grupo(nombre)])
    await userEvent.click(grupo(nombre))
    expect(within(panelDe(grupo(nombre))).getByRole('link', { name: hoja })).toHaveAttribute('aria-current', 'page')
  })

  it('closes on a route change from elsewhere: the browser going back', async () => {
    start('portal-tributario')
    await listo()
    await userEvent.click(grupo('Predios'))
    await userEvent.click(within(panelDe(grupo('Predios'))).getByRole('link', { name: 'Buscar predios' }))
    expect(await screen.findByRole('heading', { name: 'Predios' })).toBeInTheDocument()

    await userEvent.click(grupo('Catastro'))
    expect(grupo('Catastro')).toHaveAttribute('aria-expanded', 'true')
    act(() => window.history.back())
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    await waitFor(() => expect(grupo('Catastro')).toHaveAttribute('aria-expanded', 'false'))
  })

  // where a group falls depends on how the bar wraps: a panel that would leave the screen moves left
  it('keeps a panel near the right edge on the screen', async () => {
    start('portal-tributario')
    await listo()
    const caja = (right: number) =>
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: this.dataset.ui === 'menu-panel' ? right : 0, width: 0, height: 0, toJSON: () => ({}) }
      })
    // jsdom's window: 1024px wide. 8px of room on the right
    caja(1100)
    await userEvent.click(grupo('Emisión'))
    expect(panelDe(grupo('Emisión')).style.left).toBe('-84px')
    await userEvent.click(grupo('Emisión'))

    caja(400)
    await userEvent.click(grupo('Predios'))
    expect(panelDe(grupo('Predios')).style.left).toBe('')
  })

  it('shows the administration only to an admin', async () => {
    start('portal-tributario', { admin: false })
    await screen.findByRole('heading', { name: 'Inicio' })
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/auth/me/permissions')).toBe(true))
    await waitFor(() => expect(screen.getByRole('button', { name: /menú de sesión/ })).toHaveAccessibleName('Admin Rentas, Usuario: menú de sesión'))
    expect(within(menu()).queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument()
    expect(within(menu()).getAllByRole('button')).toHaveLength(8)
  })

  it.each(['light', 'dark'])('keeps the classic sidebar and its menu button with %s', async (theme) => {
    start(theme)
    await listo()
    const nav = menu()
    expect(nav).toHaveClass('bg-shell')
    expect(nav).toHaveAttribute('id', 'sidebar')
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Inicio', 'Contribuyentes', 'Predios', 'Arbitrios', 'Infracciones', 'Anuncios', 'Emisión masiva'])
    expect(document.querySelector('[data-ui="menu-portal"]')).toBeNull()
    const boton = within(screen.getByRole('banner')).getByRole('button', { name: 'Menú' })
    expect(boton).toHaveClass('md:hidden')
    expect(boton).toHaveAttribute('aria-controls', 'sidebar')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(nav).toHaveClass('block')
    // a pick closes it
    await userEvent.click(within(nav).getByRole('link', { name: 'Predios' }))
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(nav).toHaveClass('hidden')
  })
})
