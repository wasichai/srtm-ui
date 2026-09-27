import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'
import { ArbolNav } from './shell/ArbolNav'
import { arbolPara, hojaActiva, NAV_TREE, type NodoNav } from './shell/navTree'

// the tree menu of the portal-tributario theme (issue #53): the portal's lateral becomes a foldable tree of what a
// clerk does, remembered per browser tab. light, dark and system keep the classic sidebar

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

// the shell drawn, and the permissions in: an admin gets the way to the administration in the bar
async function listo() {
  const bar = await screen.findByRole('banner')
  expect(await within(bar).findByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/admin')
}

const lateral = () => screen.getByRole('navigation', { name: 'Secciones' })
const sinLateral = () => expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument()
const hamburguesa = () => within(screen.getByRole('banner')).getByRole('button', { name: 'Mostrar el menú' })
const actuales = () => Array.from(lateral().querySelectorAll('[aria-current="page"]')).map((el) => el.textContent)

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
  it('groups what a clerk does, the administration for admins only', () => {
    const ver = (nodos: NodoNav[]): unknown => nodos.map((nodo) => ('hijos' in nodo ? [nodo.label, ver(nodo.hijos)] : `${nodo.label} ${nodo.to}`))
    expect(ver(arbolPara(NAV_TREE, { isAdmin: true }))).toEqual([
      ['Contribuyentes', ['Buscar contribuyentes /contribuyentes', 'Nuevo contribuyente /contribuyentes/nuevo']],
      ['Predios', ['Buscar predios /predios', 'Nuevo predio /predios/nuevo']],
      ['Declaraciones', ['Nueva declaración /declaraciones/nueva']],
      ['Catastro', ['Nuevo lote /catastro/nuevo']],
      ['Emisión', ['Emisión masiva /emisiones']],
      'Administración /admin'
    ])
    expect(ver(arbolPara(NAV_TREE, { isAdmin: false }))).not.toContain('Administración /admin')
    expect(arbolPara(NAV_TREE, { isAdmin: false })).toHaveLength(5)
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
    ['/contribuyentesx', undefined],
    ['/admin', undefined]
  ])('on %s the current leaf is %s', (path, label) => {
    expect(hojaActiva(NAV_TREE, path)?.label).toBe(label)
  })
})

describe('ArbolNav', () => {
  // generic: groups hold leaves or subgroups (16px, indented), whose leaves go deeper
  it('draws subgroups with their own caret and deeper leaves', async () => {
    const nodos: NodoNav[] = [
      {
        label: 'Tributos',
        hijos: [
          { label: 'Impuesto predial', hijos: [{ label: 'Cuenta corriente', to: '/cuenta' }] },
          { label: 'Arbitrios', to: '/arbitrios' }
        ]
      }
    ]
    const onGrupo = vi.fn()
    render(
      <MemoryRouter initialEntries={['/cuenta/2026']}>
        <ArbolNav etiqueta="Trámites" titulo="Mis trámites" nodos={nodos} abierto grupos={{}} onGrupo={onGrupo} onNavegar={() => {}} onPlegar={() => {}} />
      </MemoryRouter>
    )
    const nav = screen.getByRole('navigation', { name: 'Trámites' })
    const sub = within(nav).getByRole('button', { name: 'Impuesto predial' })
    expect(sub).toHaveAttribute('aria-expanded', 'true')
    expect(sub).toHaveClass('text-base', 'pl-[26px]')
    const hoja = within(nav).getByRole('link', { name: 'Cuenta corriente' })
    expect(hoja).toHaveAttribute('aria-current', 'page')
    expect(hoja).toHaveClass('pl-[48px]')
    expect(within(nav).getByRole('link', { name: 'Arbitrios' })).toHaveClass('pl-[34px]')
    await userEvent.click(sub)
    expect(onGrupo).toHaveBeenCalledWith('Tributos/Impuesto predial')
  })
})

describe('portal-tributario tree menu', () => {
  it('draws the tree of trámites in the light lateral, every group open', async () => {
    start('portal-tributario')
    await listo()
    const nav = lateral()
    // what the header's menu button controls, drawn like the prototype's panel
    expect(nav).toHaveAttribute('id', 'sidebar')
    expect(nav).toHaveAttribute('data-ui', 'arbol-nav')
    expect(nav).toHaveClass('w-73', 'bg-table-head', 'border-r', 'border-border')
    expect(within(nav).getByText('Mis trámites')).toHaveClass('text-lg', 'font-bold', 'text-link')

    // home is not a leaf but the panel's header, next to the button that folds the panel
    expect(within(nav).getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: 'Ocultar el menú' })).toHaveAttribute('aria-controls', 'sidebar')

    const grupos = ['Contribuyentes', 'Predios', 'Declaraciones', 'Catastro', 'Emisión'].map((name) => within(nav).getByRole('button', { name }))
    for (const grupo of grupos) {
      expect(grupo).toHaveAttribute('aria-expanded', 'true')
      expect(grupo).toHaveClass('text-[17px]', 'font-bold', 'text-ink')
    }
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')])
    ).toEqual([
      ['Ir al inicio', '/'],
      ['Buscar contribuyentes', '/contribuyentes'],
      ['Nuevo contribuyente', '/contribuyentes/nuevo'],
      ['Buscar predios', '/predios'],
      ['Nuevo predio', '/predios/nuevo'],
      ['Nueva declaración', '/declaraciones/nueva'],
      ['Nuevo lote', '/catastro/nuevo'],
      ['Emisión masiva', '/emisiones'],
      ['Administración', '/admin']
    ])
    expect(within(nav).getByRole('link', { name: 'Buscar contribuyentes' })).toHaveClass('text-[15px]', 'text-link', 'pl-[34px]')
    // on the home page no leaf is current
    expect(actuales()).toEqual(['Ir al inicio'])
    // open, the header's menu button is not there: the panel's own button folds it
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Mostrar el menú' })).not.toBeInTheDocument()
  })

  it('folds and unfolds a group, with the mouse and the keyboard', async () => {
    start('portal-tributario')
    await listo()
    const grupo = within(lateral()).getByRole('button', { name: 'Contribuyentes' })
    const caret = grupo.querySelector('[data-ui="arbol-caret"]')!
    expect(grupo).toHaveAttribute('aria-controls')
    expect(document.getElementById(grupo.getAttribute('aria-controls')!)).toContainElement(
      within(lateral()).getByRole('link', { name: 'Buscar contribuyentes' })
    )
    expect(caret).toHaveClass('rotate-90', 'transition-transform', 'motion-reduce:transition-none')

    await userEvent.click(grupo)
    expect(grupo).toHaveAttribute('aria-expanded', 'false')
    expect(caret).not.toHaveClass('rotate-90')
    expect(within(lateral()).queryByRole('link', { name: 'Buscar contribuyentes' })).not.toBeInTheDocument()
    expect(within(lateral()).queryByRole('link', { name: 'Nuevo contribuyente' })).not.toBeInTheDocument()
    // the other groups stay as they were
    expect(within(lateral()).getByRole('link', { name: 'Buscar predios' })).toBeInTheDocument()

    await userEvent.click(grupo)
    expect(grupo).toHaveAttribute('aria-expanded', 'true')
    expect(caret).toHaveClass('rotate-90')
    expect(within(lateral()).getByRole('link', { name: 'Buscar contribuyentes' })).toBeInTheDocument()

    grupo.focus()
    await userEvent.keyboard('{Enter}')
    expect(grupo).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard(' ')
    expect(grupo).toHaveAttribute('aria-expanded', 'true')
  })

  it.each([
    ['/contribuyentes/123', 'Buscar contribuyentes'],
    ['/contribuyentes/nuevo', 'Nuevo contribuyente'],
    ['/predios/p1', 'Buscar predios']
  ])('on %s marks %s, with the active look and a chevron', async (path, label) => {
    start('portal-tributario', { path })
    await listo()
    expect(actuales()).toEqual([label])
    const hoja = within(lateral()).getByRole('link', { name: label })
    expect(hoja).toHaveAttribute('aria-current', 'page')
    expect(hoja).toHaveClass('border-link', 'font-bold')
    expect(hoja.querySelector('svg')).not.toBeNull()
    // the others: no chevron, their border there but transparent
    const otra = within(lateral()).getByRole('link', { name: 'Nuevo lote' })
    expect(otra).toHaveClass('border-transparent')
    expect(otra.querySelector('svg')).toBeNull()
  })

  it('takes a leaf to its page, and home from the header, keeping the panel open on a wide screen', async () => {
    start('portal-tributario', { path: '/predios' })
    await listo()
    await userEvent.click(within(lateral()).getByRole('link', { name: 'Nuevo contribuyente' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo contribuyente' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/contribuyentes/nuevo')
    expect(actuales()).toEqual(['Nuevo contribuyente'])

    await userEvent.click(within(lateral()).getByRole('link', { name: 'Ir al inicio' }))
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
    expect(actuales()).toEqual(['Ir al inicio'])
  })

  it('shows the administration only to an admin', async () => {
    start('portal-tributario', { admin: false })
    await screen.findByRole('heading', { name: 'Inicio' })
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/auth/me/permissions')).toBe(true))
    await waitFor(() => expect(screen.getByRole('button', { name: /menú de sesión/ })).toHaveAccessibleName('Admin Rentas, Usuario: menú de sesión'))
    expect(within(lateral()).queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument()
    expect(within(lateral()).getByRole('link', { name: 'Nuevo lote' })).toBeInTheDocument()
  })

  it('folds the panel, and the hamburger in the bar brings it back', async () => {
    start('portal-tributario')
    await listo()
    await userEvent.click(within(lateral()).getByRole('button', { name: 'Ocultar el menú' }))
    sinLateral()
    const menu = hamburguesa()
    expect(menu).toHaveAttribute('aria-controls', 'sidebar')
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    // focus does not get lost with the button that folded the panel
    expect(menu).toHaveFocus()

    await userEvent.click(menu)
    expect(lateral()).toBeVisible()
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Mostrar el menú' })).not.toBeInTheDocument()
    expect(within(lateral()).getByRole('link', { name: 'Ir al inicio' })).toHaveFocus()

    // from the keyboard too
    await userEvent.tab()
    expect(within(lateral()).getByRole('button', { name: 'Ocultar el menú' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    sinLateral()
    expect(hamburguesa()).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(lateral()).toBeVisible()
  })

  it('remembers the panel and its groups for the browser tab', async () => {
    const { unmount } = start('portal-tributario')
    await listo()
    await userEvent.click(within(lateral()).getByRole('button', { name: 'Predios' }))
    await userEvent.click(within(lateral()).getByRole('button', { name: 'Ocultar el menú' }))
    expect(JSON.parse(sessionStorage.getItem('srtm.nav')!)).toEqual({ abierto: false, grupos: { Predios: false } })
    unmount()

    start('portal-tributario')
    await listo()
    sinLateral()
    await userEvent.click(hamburguesa())
    expect(within(lateral()).getByRole('button', { name: 'Predios' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(lateral()).queryByRole('link', { name: 'Buscar predios' })).not.toBeInTheDocument()
    expect(within(lateral()).getByRole('button', { name: 'Contribuyentes' })).toHaveAttribute('aria-expanded', 'true')
    expect(JSON.parse(sessionStorage.getItem('srtm.nav')!)).toEqual({ abierto: true, grupos: { Predios: false } })
  })

  it('opens with every group open when what was stored cannot be read or written', async () => {
    sessionStorage.setItem('srtm.nav', '{no es json')
    start('portal-tributario')
    await listo()
    expect(within(lateral()).getByRole('button', { name: 'Predios' })).toHaveAttribute('aria-expanded', 'true')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    await userEvent.click(within(lateral()).getByRole('button', { name: 'Predios' }))
    expect(within(lateral()).getByRole('button', { name: 'Predios' })).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(within(lateral()).getByRole('button', { name: 'Ocultar el menú' }))
    sinLateral()
  })

  it('starts folded on a screen of 1080px or less, and folds on a pick', async () => {
    pantalla(1000)
    // what was open on a wide screen: a narrow one starts folded all the same
    sessionStorage.setItem('srtm.nav', JSON.stringify({ abierto: true }))
    start('portal-tributario')
    await listo()
    sinLateral()

    await userEvent.click(hamburguesa())
    await userEvent.click(within(lateral()).getByRole('link', { name: 'Buscar predios' }))
    expect(await screen.findByRole('heading', { name: 'Predios' })).toBeInTheDocument()
    sinLateral()
    expect(hamburguesa()).toHaveFocus()
  })

  it('stays open on a wide screen', async () => {
    pantalla(1440)
    start('portal-tributario')
    await listo()
    await userEvent.click(within(lateral()).getByRole('link', { name: 'Buscar predios' }))
    expect(await screen.findByRole('heading', { name: 'Predios' })).toBeInTheDocument()
    expect(lateral()).toBeVisible()
  })

  it.each(['light', 'dark'])('keeps the classic sidebar and its menu button with %s', async (theme) => {
    pantalla(1000)
    start(theme)
    await listo()
    const nav = lateral()
    expect(nav).toHaveClass('bg-shell')
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Inicio', 'Contribuyentes', 'Predios', 'Emisión masiva'])
    expect(within(nav).queryByText('Mis trámites')).not.toBeInTheDocument()
    const menu = within(screen.getByRole('banner')).getByRole('button', { name: 'Menú' })
    expect(menu).toHaveClass('md:hidden')
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    expect(sessionStorage.getItem('srtm.nav')).toBeNull()
  })
})
