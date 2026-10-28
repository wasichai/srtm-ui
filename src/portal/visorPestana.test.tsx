import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApp } from './PortalApp'

// el visor de brechas en su pestaña de trabajo y a pantalla completa (wasichai/srtm-ui#157): el popup de un lote con
// sus predios y los enlaces a sus fichas, el estado del visor en la url (la pestaña vuelve a él) y los controles
// flotantes de la pantalla completa. the real map component over a maplibre double: jsdom has no webgl
const fake = vi.hoisted(() => {
  class FakeMap {
    static all: FakeMap[] = []
    options: Record<string, unknown>
    handlers: Record<string, ((e: unknown) => void)[]> = {}
    onLoad: (() => void) | null = null
    centro = { lng: -75.7312345678, lat: -14.0687654321 }
    fitBounds = vi.fn()
    remove = vi.fn()
    setPaintProperty = vi.fn()
    setLayoutProperty = vi.fn()
    constructor(options: Record<string, unknown>) {
      this.options = options
      FakeMap.all.push(this)
    }
    on(event: string, ...rest: unknown[]) {
      if (event === 'load') this.onLoad = rest[0] as () => void
      else (this.handlers[rest.length === 2 ? `${event} ${rest[0] as string}` : event] ??= []).push(rest.at(-1) as (e: unknown) => void)
    }
    addControl() {}
    once() {}
    isMoving() {
      return false
    }
    addSource() {}
    addLayer() {}
    getSource() {
      return { setData: () => {} }
    }
    getStyle() {
      return { layers: [] }
    }
    queryRenderedFeatures() {
      return []
    }
    getCanvas() {
      return document.createElement('canvas')
    }
    getCenter() {
      return this.centro
    }
    getZoom() {
      return 17.25
    }
    resize() {}
    fire(event: string, e: unknown, capa?: string) {
      for (const h of this.handlers[capa ? `${event} ${capa}` : event] ?? []) h(e)
    }
  }
  class FakePopup {
    static abiertos: FakePopup[] = []
    nodo: HTMLElement | null = null
    lngLat: unknown
    cerrar: (() => void)[] = []
    setLngLat(lngLat: unknown) {
      this.lngLat = lngLat
      return this
    }
    setHTML() {
      return this
    }
    setDOMContent(nodo: HTMLElement) {
      this.nodo = nodo
      return this
    }
    on(event: string, h: () => void) {
      if (event === 'close') this.cerrar.push(h)
      return this
    }
    addTo() {
      if (this.nodo) document.body.append(this.nodo)
      FakePopup.abiertos.push(this)
      return this
    }
    remove() {
      this.nodo?.remove()
      for (const h of this.cerrar) h()
      return this
    }
  }
  return { FakeMap, FakePopup }
})
vi.mock('maplibre-gl', () => {
  class Control {}
  return { Map: fake.FakeMap, Popup: fake.FakePopup, NavigationControl: Control, ScaleControl: Control, setWorkerUrl: () => {} }
})

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()

const panel = {
  corrida: { id: 'c2', anio: year, terminado: `${year}-10-20T15:00:00Z`, version_catastro: 'valuacion-v2' },
  kpis: { fichas: 2, delta_impuesto: 300, delta_impuesto_confiable: 300, omisos_estimado: 0, supera_5_uit: 0, pendientes: 2, con_geometria: 2 },
  por_categoria: [],
  por_confianza: [],
  por_estado: [],
  top_sectores: []
}

const cuadrado = (x: number) => ({
  type: 'Polygon',
  coordinates: [
    [
      [x, -14.07],
      [x + 0.001, -14.07],
      [x + 0.001, -14.069],
      [x, -14.069],
      [x, -14.07]
    ]
  ]
})
const lotes = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'b1', geometry: cuadrado(-75.73), properties: { codigo: '01-01-0001', codigo_catastro: 'PC-1', categoria: 'SUBVALUADO' } },
    { type: 'Feature', id: 'b2', geometry: cuadrado(-75.72), properties: { codigo: '01-01-0002', codigo_catastro: 'PC-2', categoria: 'OMISO' } }
  ]
}

const prediosDelLote = [
  {
    id: 'b1',
    predio: 'p1',
    codigo_predio: '01-01-0001',
    declaracion: 'd1',
    contribuyente: 'c1',
    contribuyente_nombre: 'QUISPE MAMANI JUAN',
    categoria: 'SUBVALUADO',
    confianza: 'CONFIABLE',
    delta_impuesto: 300,
    estado: 'PENDIENTE'
  }
]

const predio = {
  id: 'p1',
  codigo: '01-01-0001',
  sector_catastral: '01',
  manzana_catastral: '01',
  tipo_predio: 'PREDIO URBANO',
  direccion: 'JR. LIMA 123',
  via: null,
  numero: '123',
  manzana: null,
  lote: null,
  habilitacion_urbana: null,
  ubicacion_area_verde: null
}
const totales = { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 }
const contribuyente = {
  id: 'c1',
  tipo_persona: 'NATURAL',
  tipo_contribuyente: 'PERSONA NATURAL',
  tipo_documento: 'DNI',
  numero_documento: '43554564',
  nombre_completo: 'QUISPE MAMANI JUAN',
  apellido_paterno: 'QUISPE',
  apellido_materno: 'MAMANI',
  nombres: 'JUAN',
  codigo: '000013',
  domicilio_fiscal: null
}

// a row of the table under the map (GET /predios), with its contribuyente (srtm-backend#270)
const filaDeTabla = {
  id: 'b1',
  predio: 'p1',
  declaracion: 'd1',
  codigo_predio: '01-01-0001',
  contribuyente: 'c1',
  contribuyente_nombre: 'QUISPE MAMANI JUAN',
  codigo_catastro: 'PC-1',
  sector: '01',
  manzana: '01',
  lote: '1',
  uso: null,
  categoria: 'SUBVALUADO',
  confianza: 'CONFIABLE',
  impuesto_declarado: 330,
  impuesto_catastro: 630,
  delta_impuesto: 300,
  delta_arbitrios: null,
  supera_5_uit: false,
  estado: 'PENDIENTE',
  con_geometria: true
}
const conFilas: MockRoute[] = [{ path: '/srtm/visor/predios', body: { content: [filaDeTabla], page: 0, size: 50, totalElements: 1, totalPages: 1 } }]

const rutas: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  { path: '/srtm/catalogos', body: {} },
  { path: '/srtm/resumen', body: { anio: year, contribuyentes: 0, predios: 0, declaraciones: 0 } },
  {
    path: '/srtm/municipalidad',
    body: { nombre: 'Prueba', oficina: null, escudo: null, extension: [-75.74, -14.08, -75.71, -14.06], centro: null, lugar: null }
  },
  { path: '/srtm/brecha/corridas', body: [] },
  { path: '/srtm/visor/panel', body: panel },
  { path: '/srtm/visor/predios', body: { content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 } },
  { path: '/srtm/visor/lotes', body: lotes },
  { path: '/srtm/visor/lotes/01-01-0001/predios', body: prediosDelLote },
  { path: '/srtm/visor/capas', body: [{ layerName: 'predio_catastral__0a1b2c3d__geom', label: 'Predios' }] },
  { path: '/srtm/visor/vias', body: { type: 'FeatureCollection', features: [] } },
  { path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 1, totales } },
  { path: '/srtm/predios/p1/declaraciones', body: [] },
  { path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 1, totales } },
  { path: '/srtm/contribuyentes/c1/domicilios', body: [] },
  { path: '/srtm/contribuyentes/c1/relacionados', body: [] },
  { path: '/srtm/contribuyentes/c1/medios-contacto', body: [] },
  { path: '/srtm/contribuyentes/c1/sustentos', body: [] },
  { path: '/srtm/contribuyentes/c1/declaraciones', body: [] }
]

let fetch: FetchMock | null = null
let portapapeles: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  portapapeles = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: portapapeles }, configurable: true })
})
afterEach(() => {
  fetch?.restore()
  for (const p of fake.FakePopup.abiertos) p.nodo?.remove()
  fake.FakePopup.abiertos = []
  fake.FakeMap.all = []
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function start(path: string, extra: MockRoute[] = []) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...rutas])
  render(<PortalApp />)
}

// the map of the screen, once it loaded and drew the lotes
async function mapaListo(cuantos = 1) {
  await waitFor(() => expect(fake.FakeMap.all).toHaveLength(cuantos))
  const mapa = fake.FakeMap.all.at(-1)!
  act(() => mapa.onLoad?.())
  await waitFor(() => expect(fetch!.calls.some((c) => c.path.startsWith('/srtm/visor/lotes?'))).toBe(true))
  return mapa
}

const clicEnLote = (mapa: InstanceType<typeof fake.FakeMap>, i = 0) =>
  act(() => mapa.fire('click', { point: [0, 0], lngLat: [-75.73, -14.07], features: [{ properties: lotes.features[i].properties }] }, 'visor-lotes-relleno'))

const pestanas = () => within(screen.getByRole('navigation', { name: 'Fichas abiertas' }))
const params = () => new URLSearchParams(window.location.search)

// a screen of `ancho` px for the css media queries (jsdom has no matchMedia)
function pantalla(ancho: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const min = /min-width:\s*([\d.]+)(px|rem)/.exec(query)
    const px = min ? Number(min[1]) * (min[2] === 'rem' ? 16 : 1) : null
    return { matches: px !== null && ancho >= px, media: query, addEventListener: () => {}, removeEventListener: () => {} }
  })
}

describe('el popup de un lote', () => {
  it('lists its predios and opens the predio’s ficha in a tab, with the visor’s tab beside it', async () => {
    start('/brecha/visor')
    const mapa = await mapaListo()
    expect(pestanas().getByRole('link', { name: 'Visor de brechas' })).toHaveAttribute('aria-current', 'page')
    clicEnLote(mapa)
    const popup = screen.getByTestId('popup-lote')
    const lista = await within(popup).findByRole('list', { name: 'Predios del lote' })
    expect(within(lista).getByRole('listitem')).toHaveTextContent('QUISPE MAMANI JUAN')
    expect(within(lista).getByRole('link', { name: 'Ver contribuyente de 01-01-0001' })).toHaveAttribute('href', '/contribuyentes/c1')

    await userEvent.click(within(lista).getByRole('link', { name: 'Ver predio 01-01-0001' }))
    await waitFor(() => expect(window.location.pathname).toBe('/predios/p1'))
    // the predio's tab, open, and the visor's beside it: no reload, the same session of tabs
    expect(await pestanas().findByRole('link', { name: '01-01-0001' })).toHaveAttribute('aria-current', 'page')
    expect(pestanas().getByRole('link', { name: 'Visor de brechas' })).not.toHaveAttribute('aria-current')
    expect(fake.FakeMap.all[0].remove).toHaveBeenCalled()
  })
})

describe('la tabla del visor', () => {
  // the contribuyente's tab: its document and its name
  const PESTANA_QUISPE = '43554564 QUISPE MAMANI JUAN'
  const tabla = () => within(screen.getByRole('table', { name: 'Predios de la brecha' }))

  it('opens the contribuyente of a row in its tab, and focuses it when it is open', async () => {
    start('/brecha/visor', conFilas)
    await mapaListo()
    await userEvent.click(await tabla().findByRole('link', { name: 'QUISPE MAMANI JUAN' }))
    await waitFor(() => expect(window.location.pathname).toBe('/contribuyentes/c1'))
    expect(await pestanas().findByRole('link', { name: PESTANA_QUISPE })).toHaveAttribute('aria-current', 'page')
    expect(pestanas().getByRole('link', { name: 'Visor de brechas' })).not.toHaveAttribute('aria-current')

    // back to the visor and the same link again: the same tab, focused, not a second one
    await userEvent.click(pestanas().getByRole('link', { name: 'Visor de brechas' }))
    await waitFor(() => expect(window.location.pathname).toBe('/brecha/visor'))
    await userEvent.click(await tabla().findByRole('link', { name: 'QUISPE MAMANI JUAN' }))
    await waitFor(() => expect(window.location.pathname).toBe('/contribuyentes/c1'))
    expect(pestanas().getAllByRole('link', { name: PESTANA_QUISPE })).toHaveLength(1)
    expect(pestanas().getByRole('link', { name: PESTANA_QUISPE })).toHaveAttribute('aria-current', 'page')
  })

  it('opens the predio of a row in its tab, and focuses it when it is open', async () => {
    start('/brecha/visor', conFilas)
    await mapaListo()
    await userEvent.click(await tabla().findByRole('link', { name: '01-01-0001' }))
    await waitFor(() => expect(window.location.pathname).toBe('/predios/p1'))
    expect(await pestanas().findByRole('link', { name: '01-01-0001' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(pestanas().getByRole('link', { name: 'Visor de brechas' }))
    await waitFor(() => expect(window.location.pathname).toBe('/brecha/visor'))
    await userEvent.click(await tabla().findByRole('link', { name: '01-01-0001' }))
    await waitFor(() => expect(window.location.pathname).toBe('/predios/p1'))
    expect(pestanas().getAllByRole('link', { name: '01-01-0001' })).toHaveLength(1)
    expect(pestanas().getByRole('link', { name: '01-01-0001' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('la pestaña del visor', () => {
  it('comes back to its filters, colouring, layers and view', async () => {
    start(`/brecha/visor?anio=${year}`)
    const mapa = await mapaListo()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Colorear lotes por' }), 'delta')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Predios' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Categoría' })).getByRole('button', { name: 'Omiso' }))
    act(() => mapa.fire('moveend', {}))
    await waitFor(() => expect(params().get('c')).toBe('-75.731235,-14.068765'))
    expect(Object.fromEntries(params())).toEqual({
      anio: String(year),
      categoria: 'OMISO',
      colorear: 'delta',
      wms: 'predio_catastral__0a1b2c3d__geom@70',
      c: '-75.731235,-14.068765',
      z: '17.25'
    })
    const enVisor = window.location.search
    // the url changed in place: no history entry per change
    expect(pestanas().getByRole('link', { name: 'Visor de brechas' })).toHaveAttribute('href', `/brecha/visor${enVisor}`)

    clicEnLote(mapa)
    await userEvent.click(await screen.findByRole('link', { name: 'Ver predio 01-01-0001' }))
    await waitFor(() => expect(window.location.pathname).toBe('/predios/p1'))

    await userEvent.click(pestanas().getByRole('link', { name: 'Visor de brechas' }))
    await waitFor(() => expect(window.location.pathname).toBe('/brecha/visor'))
    expect(window.location.search).toBe(enVisor)
    const otro = await mapaListo(2)
    expect(screen.getByRole('combobox', { name: 'Colorear lotes por' })).toHaveValue('delta')
    expect(await screen.findByRole('checkbox', { name: 'Predios' })).toBeChecked()
    expect(within(screen.getByRole('group', { name: 'Categoría' })).getByRole('button', { name: 'Omiso' })).toHaveAttribute('aria-pressed', 'true')
    // where it was left, not framed again on the lotes
    expect(otro.options).toMatchObject({ center: [-75.731235, -14.068765], zoom: 17.25 })
    expect(otro.fitBounds).not.toHaveBeenCalled()
    expect(fetch!.calls.filter((c) => c.path.startsWith('/srtm/visor/lotes?')).at(-1)?.path).toBe(`/srtm/visor/lotes?anio=${year}&categoria=OMISO`)
  })

  it('keeps the view when the year changes', async () => {
    start(`/brecha/visor?anio=${year}&colorear=estado&vias=1`)
    await mapaListo()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Año' }), String(year - 1))
    await waitFor(() => expect(params().get('anio')).toBe(String(year - 1)))
    expect(params().get('colorear')).toBe('estado')
    expect(params().get('vias')).toBe('1')
  })
})

describe('el visor a pantalla completa', () => {
  it('is opened from the visor on the same view, without the shell, and goes back to it', async () => {
    start(`/brecha/visor?anio=${year}&colorear=delta`)
    await mapaListo()
    await userEvent.click(screen.getByRole('link', { name: 'Mapa a pantalla completa' }))
    await waitFor(() => expect(window.location.pathname).toBe('/brecha/visor/mapa'))
    expect(params().get('colorear')).toBe('delta')
    await mapaListo(2)
    expect(screen.queryByRole('navigation', { name: 'Fichas abiertas' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Visor de brechas' })).toBeInTheDocument()
    const volver = screen.getByRole('link', { name: 'Volver al visor' })
    expect(volver).toHaveAttribute('href', `/brecha/visor${window.location.search}`)
    await userEvent.click(volver)
    await waitFor(() => expect(window.location.pathname).toBe('/brecha/visor'))
    expect(params().get('colorear')).toBe('delta')
  })

  it('flies to a lote by its code and opens its popup, and says when there is none', async () => {
    start('/brecha/visor/mapa')
    const mapa = await mapaListo()
    const buscar = screen.getByRole('searchbox', { name: 'Buscar código de predio' })
    await userEvent.type(buscar, '01-01-0009{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('No hay un lote con ese código en el mapa.')
    expect(mapa.fitBounds).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ maxZoom: 19 }))

    await userEvent.clear(buscar)
    await userEvent.type(buscar, ' 01-01-0001 {Enter}')
    expect(screen.queryByText('No hay un lote con ese código en el mapa.')).not.toBeInTheDocument()
    expect(mapa.fitBounds).toHaveBeenLastCalledWith(
      [
        [-75.73, -14.07],
        [-75.729, -14.069]
      ],
      { padding: 80, maxZoom: 19 }
    )
    const [lng, lat] = fake.FakePopup.abiertos.at(-1)?.lngLat as [number, number]
    expect(lng).toBeCloseTo(-75.7295, 9)
    expect(lat).toBeCloseTo(-14.0695, 9)
    expect(await screen.findByRole('link', { name: 'Ver predio 01-01-0001' })).toHaveAttribute('href', '/predios/p1')
    // by the catastral code too
    await userEvent.clear(buscar)
    await userEvent.type(buscar, 'pc-2{Enter}')
    expect(screen.getAllByTestId('popup-lote')).toHaveLength(1)
    expect(screen.getByTestId('popup-lote')).toHaveTextContent('01-01-0002')
  })

  it('shares the view: a link with its centre, zoom, layers and colouring', async () => {
    start(`/brecha/visor/mapa?anio=${year}`)
    const mapa = await mapaListo()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Colorear lotes por' }), 'confianza')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Predios' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Vías con arancel/ }))
    act(() => mapa.fire('moveend', {}))
    await userEvent.click(within(screen.getByRole('toolbar', { name: 'Herramientas del mapa' })).getByRole('button', { name: 'Compartir vista' }))
    expect(portapapeles).toHaveBeenCalledTimes(1)
    const enlace = new URL(portapapeles.mock.calls[0][0] as string)
    expect(enlace.pathname).toBe('/brecha/visor/mapa')
    expect(Object.fromEntries(enlace.searchParams)).toEqual({
      anio: String(year),
      colorear: 'confianza',
      vias: '1',
      wms: 'predio_catastral__0a1b2c3d__geom@70',
      c: '-75.731235,-14.068765',
      z: '17.25'
    })
    expect(await screen.findByText('Enlace copiado')).toBeInTheDocument()
  })

  it('changes the basemap and the opacity of each layer', async () => {
    start('/brecha/visor/mapa')
    await mapaListo()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mapa base' }), 'ninguno')
    expect(params().get('base')).toBe('ninguno')
    const capas = screen.getByRole('region', { name: 'Capas' })
    await userEvent.click(within(capas).getByRole('checkbox', { name: 'Predios' }))
    expect(within(capas).getByRole('slider', { name: 'Opacidad de Predios' })).toBeEnabled()
    expect(within(capas).getByRole('slider', { name: 'Opacidad de las vías' })).toBeDisabled()
    expect(within(capas).getByRole('slider', { name: 'Opacidad de los lotes' })).toHaveValue('60')
  })

  it('reads the cursor in lat/lon and UTM 18S, and copies it', async () => {
    start('/brecha/visor/mapa')
    const mapa = await mapaListo()
    act(() => mapa.fire('mousemove', { lngLat: { lng: -75.73578, lat: -14.06581 } }))
    const coordenadas = screen.getByRole('region', { name: 'Coordenadas' })
    expect(within(coordenadas).getByLabelText('Latitud y longitud')).toHaveTextContent('-14.065810, -75.735780')
    expect(within(coordenadas).getByLabelText('UTM')).toHaveTextContent('18S E 420563 N 8444871')
    await userEvent.click(within(coordenadas).getByRole('button', { name: 'Copiar coordenadas' }))
    expect(portapapeles).toHaveBeenCalledWith('-14.065810, -75.735780 · UTM 18S E 420563 N 8444871')
    // the cursor leaves: the centre's
    act(() => mapa.fire('mouseout', {}))
    act(() => mapa.fire('moveend', {}))
    await waitFor(() =>
      expect(within(screen.getByRole('region', { name: 'Coordenadas' })).getByLabelText('Latitud y longitud')).toHaveTextContent('-14.068765, -75.731235')
    )
    expect(screen.getByRole('region', { name: 'Coordenadas' })).toHaveTextContent('Centro')
  })

  it('folds the layers panel, closed at first on a phone', async () => {
    pantalla(390)
    start('/brecha/visor/mapa')
    await mapaListo()
    const boton = screen.getByRole('button', { name: 'Capas' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Capas' })).not.toBeInTheDocument()
    // the legend folds as in the visor
    expect(screen.getByRole('button', { name: 'Leyenda' })).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(boton)
    expect(screen.getByRole('region', { name: 'Capas' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar capas' }))
    expect(boton).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the panel on a wide screen, and puts the browser in full screen', async () => {
    pantalla(1280)
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
    const pedir = vi.fn(() => Promise.resolve())
    document.documentElement.requestFullscreen = pedir
    start('/brecha/visor/mapa')
    await mapaListo()
    expect(screen.getByRole('button', { name: 'Capas' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Capas' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Leyenda' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Pantalla completa del navegador' }))
    expect(pedir).toHaveBeenCalled()
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true })
  })
})
