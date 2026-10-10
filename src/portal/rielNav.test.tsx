import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { currentNavTreeLeaf } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { FileText, Gavel, Landmark, LandPlot, MapPinned, Megaphone, Printer, Users } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'
import { arbolPara, NAV_TREE, type GrupoNav, type NodoNav } from './shell/navTree'

// the module rail of the portal-tributario theme: one item per group of the tree of trámites (NAV_TREE), its trámites
// in a panel beside the rail (core's NavTree). it never folds. light, dark and system keep the classic sidebar

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
  vi.unstubAllGlobals()
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

// the shell drawn, and the permissions in: an admin gets the way to the administration (the bar's in classic, the
// rail's under the theme)
async function listo() {
  await screen.findByRole('banner')
  expect(await screen.findByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/admin')
}

const riel = () => screen.getByRole('navigation', { name: 'Secciones' })
const grupo = (name: string) => within(riel()).getByRole('button', { name })
// the open group's trámites, beside the rail
const panel = (name: string) => screen.getByRole('navigation', { name: `Trámites: ${name}` })
const sinPanel = () => expect(screen.queryByRole('navigation', { name: /^Trámites:/ })).not.toBeInTheDocument()
const actuales = () => Array.from(riel().querySelectorAll('[data-ui="riel-item"][aria-current]')).map((el) => el.textContent)

// a screen of `ancho` px for the css media queries the shell asks about (jsdom has no matchMedia)
function pantalla(ancho: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query)
    return {
      matches: max ? ancho <= Number(max[1]) : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }
  })
}

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

  // what the rail draws of each group: its icon and, when the full label does not fit 104px, a short one
  it('gives every group its icon for the rail, and a short label to the long ones', () => {
    const grupos = NAV_TREE.filter((nodo): nodo is GrupoNav => 'children' in nodo)
    expect(grupos.map((g) => [g.corto ?? g.label, g.icon])).toEqual([
      ['Contribuyentes', Users],
      ['Predios', MapPinned],
      ['Declaraciones', FileText],
      ['Catastro', LandPlot],
      ['Arbitrios', Landmark],
      ['Infracciones', Gavel],
      ['Anuncios', Megaphone],
      ['Emisión', Printer]
    ])
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

describe('portal-tributario rail', () => {
  it('draws the rail of modules in the light lateral: Inicio, one item per group, the administration last', async () => {
    start('portal-tributario')
    await listo()
    const nav = riel()
    expect(nav).toHaveAttribute('id', 'sidebar')
    expect(nav).not.toHaveAttribute('data-slot', 'nav-tree')
    expect(nav).toHaveClass('w-26', 'bg-table-head', 'border-r', 'border-border')
    expect(within(nav).queryByText('Mis trámites')).not.toBeInTheDocument()

    expect(Array.from(nav.querySelectorAll('a, button')).map((el) => [el.tagName, el.textContent])).toEqual([
      ['A', 'Inicio'],
      ['BUTTON', 'Contribuyentes'],
      ['BUTTON', 'Predios'],
      ['BUTTON', 'Declaraciones'],
      ['BUTTON', 'Catastro'],
      ['BUTTON', 'Arbitrios'],
      ['BUTTON', 'Infracciones'],
      ['BUTTON', 'Anuncios'],
      ['BUTTON', 'Emisión'],
      ['A', 'Administración']
    ])
    const inicio = within(nav).getByRole('link', { name: 'Inicio' })
    expect(inicio).toHaveAttribute('href', '/')
    // the icon over the label, stacked and centred
    for (const item of nav.querySelectorAll('[data-ui="riel-item"]')) {
      expect(item).toHaveClass('flex-col', 'items-center', 'text-center', 'text-[11.5px]', 'text-ink')
      expect(item.querySelector('svg')).toHaveClass('size-5')
    }
    for (const boton of within(nav).getAllByRole('button')) {
      expect(boton).toHaveAttribute('aria-expanded', 'false')
      expect(boton).toHaveAttribute('aria-controls', 'sidebar-tramites')
    }
    // another app, after a line
    const admin = within(nav).getByRole('link', { name: 'Administración' })
    expect(admin).toHaveAttribute('href', '/admin')
    expect(admin.closest('li')).toHaveClass('border-t', 'border-border')
    sinPanel()
    // the rail does not fold: no hamburger in the bar
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Mostrar el menú' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Menú' })).not.toBeInTheDocument()
  })

  it.each([
    ['/', 'Inicio'],
    ['/buscar', undefined],
    ['/contribuyentes/123', 'Contribuyentes'],
    ['/contribuyentes/nuevo', 'Contribuyentes'],
    ['/contribuyentes/123/declaraciones/nueva', 'Declaraciones'],
    ['/predios/p1', 'Predios'],
    ['/declaraciones/d1', undefined],
    ['/infracciones/cuis', 'Infracciones'],
    ['/anuncios/nuevo', 'Anuncios']
  ])('on %s marks %s, the group of the current leaf', async (path, label) => {
    start('portal-tributario', { path })
    await listo()
    expect(actuales()).toEqual(label ? [label] : [])
    if (label && label !== 'Inicio') {
      expect(grupo(label)).toHaveAttribute('aria-current', 'true')
      expect(grupo(label)).toHaveClass('border-link', 'font-bold')
    }
    expect(grupo('Catastro')).not.toHaveAttribute('aria-current')
    expect(grupo('Catastro')).toHaveClass('border-transparent')
  })

  it("opens a group's trámites beside the rail, titled with its full label, one group at a time", async () => {
    start('portal-tributario')
    await listo()
    await userEvent.click(grupo('Contribuyentes'))
    expect(grupo('Contribuyentes')).toHaveAttribute('aria-expanded', 'true')
    const contribuyentes = panel('Contribuyentes')
    // core's tree, with the group's leaves
    expect(contribuyentes).toHaveAttribute('id', grupo('Contribuyentes').getAttribute('aria-controls'))
    expect(contribuyentes).toHaveAttribute('data-slot', 'nav-tree')
    expect(within(contribuyentes).getByText('Contribuyentes')).toHaveClass('text-lg', 'font-bold', 'text-link')
    expect(
      within(contribuyentes)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')])
    ).toEqual([
      ['Ir al inicio', '/'],
      ['Buscar contribuyentes', '/contribuyentes'],
      ['Nuevo contribuyente', '/contribuyentes/nuevo']
    ])
    // over the content, beside the rail
    expect(contribuyentes.parentElement).toHaveAttribute('data-ui', 'riel-panel')
    expect(contribuyentes.parentElement).toHaveClass('absolute', 'left-full', 'top-0', 'bottom-0', 'z-20')

    await userEvent.click(grupo('Infracciones'))
    expect(grupo('Contribuyentes')).toHaveAttribute('aria-expanded', 'false')
    expect(grupo('Infracciones')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('navigation', { name: /^Trámites:/ })).toHaveLength(1)
    const infracciones = panel('Infracciones administrativas')
    expect(within(infracciones).getByText('Infracciones administrativas')).toBeInTheDocument()
    expect(
      within(infracciones)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Ir al inicio', 'Expedientes', 'Nueva acta', 'Notificaciones previas', 'CUIS', 'Escalas y plazos'])

    // a second press closes it
    await userEvent.click(grupo('Infracciones'))
    expect(grupo('Infracciones')).toHaveAttribute('aria-expanded', 'false')
    sinPanel()
  })

  it('closes the panel with its own button, focus back on the group', async () => {
    start('portal-tributario')
    await listo()
    await userEvent.click(grupo('Predios'))
    await userEvent.click(within(panel('Predios')).getByRole('button', { name: 'Ocultar el menú' }))
    sinPanel()
    expect(grupo('Predios')).toHaveAttribute('aria-expanded', 'false')
    expect(grupo('Predios')).toHaveFocus()
  })

  it('opens from the keyboard, its trámites next in the tab order, and escape closes it, focus back on the group', async () => {
    start('portal-tributario')
    await listo()
    grupo('Arbitrios').focus()
    await userEvent.keyboard('{Enter}')
    expect(grupo('Arbitrios')).toHaveAttribute('aria-expanded', 'true')
    await userEvent.tab()
    expect(within(panel('Arbitrios')).getByRole('link', { name: 'Ir al inicio' })).toHaveFocus()
    await userEvent.tab()
    await userEvent.tab()
    expect(within(panel('Arbitrios')).getByRole('link', { name: 'Consulta de cuotas' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    sinPanel()
    expect(grupo('Arbitrios')).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(panel('Arbitrios')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    sinPanel()
  })

  it('closes on a click anywhere else and on a route change', async () => {
    start('portal-tributario')
    await listo()
    await userEvent.click(grupo('Catastro'))
    expect(panel('Catastro')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('heading', { name: 'Inicio' }))
    sinPanel()

    // a press inside the rail does not count as elsewhere
    await userEvent.click(grupo('Catastro'))
    await userEvent.click(within(panel('Catastro')).getByText('Catastro'))
    expect(panel('Catastro')).toBeInTheDocument()

    // the header's search, from the keyboard (no press outside): the new route closes it
    within(screen.getByRole('banner')).getByRole('searchbox', { name: 'Buscar' }).focus()
    await userEvent.keyboard('quispe{Enter}')
    expect(await screen.findByRole('heading', { name: 'Resultados para “quispe”' })).toBeInTheDocument()
    sinPanel()
    expect(grupo('Catastro')).toHaveAttribute('aria-expanded', 'false')
  })

  it.each([
    ['/contribuyentes/123', 'Contribuyentes', 'Buscar contribuyentes'],
    ['/contribuyentes/nuevo', 'Contribuyentes', 'Nuevo contribuyente'],
    ['/predios/p1', 'Predios', 'Buscar predios']
  ])('on %s marks %s and, in its panel, %s', async (path, nombre, hoja) => {
    start('portal-tributario', { path })
    await listo()
    await userEvent.click(grupo(nombre))
    const actual = within(panel(nombre)).getByRole('link', { name: hoja })
    expect(actual).toHaveAttribute('aria-current', 'page')
    // core draws the leaves of its root with the groups' hook: shell.css gives them the leaves' look
    expect(actual).toHaveAttribute('data-slot', 'nav-tree-group')
    expect(
      within(panel(nombre))
        .getAllByRole('link')
        .filter((link) => link.hasAttribute('aria-current'))
    ).toEqual([actual])
  })

  it('takes a leaf to its page, closing the panel, and Inicio home', async () => {
    start('portal-tributario', { path: '/predios' })
    await listo()
    expect(actuales()).toEqual(['Predios'])
    await userEvent.click(grupo('Contribuyentes'))
    await userEvent.click(within(panel('Contribuyentes')).getByRole('link', { name: 'Nuevo contribuyente' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo contribuyente' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/contribuyentes/nuevo')
    sinPanel()
    expect(actuales()).toEqual(['Contribuyentes'])

    await userEvent.click(within(riel()).getByRole('link', { name: 'Inicio' }))
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
    expect(actuales()).toEqual(['Inicio'])
    expect(within(riel()).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the administration only to an admin', async () => {
    start('portal-tributario', { admin: false })
    await screen.findByRole('heading', { name: 'Inicio' })
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/auth/me/permissions')).toBe(true))
    await waitFor(() => expect(screen.getByRole('button', { name: /menú de sesión/ })).toHaveAccessibleName('Admin Rentas, Usuario: menú de sesión'))
    expect(within(riel()).queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument()
    expect(within(riel()).getByRole('button', { name: 'Emisión' })).toBeInTheDocument()
  })

  // the rail spans the row on a phone and wraps its items; the panel then covers the width (css)
  it.each([500, 1000, 1440])('never folds on a screen of %ipx, and remembers nothing', async (ancho) => {
    pantalla(ancho)
    start('portal-tributario')
    await listo()
    expect(riel()).toBeVisible()
    expect(riel()).toHaveClass('max-sm:w-full')
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Mostrar el menú' })).not.toBeInTheDocument()
    await userEvent.click(grupo('Predios'))
    await userEvent.click(within(panel('Predios')).getByRole('link', { name: 'Buscar predios' }))
    expect(await screen.findByRole('heading', { name: 'Predios' })).toBeInTheDocument()
    expect(riel()).toBeVisible()
    expect(sessionStorage.getItem('srtm.nav')).toBeNull()
  })

  it.each(['light', 'dark'])('keeps the classic sidebar and its menu button with %s', async (theme) => {
    pantalla(1000)
    start(theme)
    await listo()
    const nav = riel()
    expect(nav).toHaveClass('bg-shell')
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Inicio', 'Contribuyentes', 'Predios', 'Arbitrios', 'Infracciones', 'Anuncios', 'Emisión masiva'])
    expect(nav.querySelector('[data-ui="riel-item"]')).toBeNull()
    const menu = within(screen.getByRole('banner')).getByRole('button', { name: 'Menú' })
    expect(menu).toHaveClass('md:hidden')
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    expect(sessionStorage.getItem('srtm.nav')).toBeNull()
  })
})
