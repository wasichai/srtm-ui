import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { client } from './api'
import type { VisorMapaProps } from './pages/visor/VisorMapa'
import VisorMapa from './pages/visor/VisorMapa'
import { clasesPorValor } from './pages/visor/colores'
import type { LoteVisorProps, LotesVisor, TramosCollection } from './pages/visor/tipos'
import { conTokenVisor, teselasWms } from './pages/visor/wms'

// el mapa del visor de brechas (wasichai/srtm-ui#154): los lotes de la corrida coloreados como en catastro-ui, las
// vías con arancel y las capas WMS de catastro a través de srtm, con el Bearer de srtm solo en esas teselas.
// jsdom has no webgl: the map is a double that keeps its sources, its layers and the calls that matter here
const fake = vi.hoisted(() => {
  type Capa = { id: string; type: string; source?: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> }
  class FakeMap {
    static all: FakeMap[] = []
    options: Record<string, unknown>
    layers: Capa[] = []
    sources = new Map<string, Record<string, unknown>>()
    handlers: Record<string, ((e: unknown) => void)[]> = {}
    onLoad: (() => void) | null = null
    setData = vi.fn()
    fitBounds = vi.fn()
    remove = vi.fn()
    getCenter = vi.fn(() => ({ lng: -75.73, lat: -14.07 }))
    getZoom = vi.fn(() => 15)
    queryRenderedFeatures = vi.fn(() => [] as unknown[])
    constructor(options: Record<string, unknown>) {
      this.options = options
      // the basemap's layers, from the style
      this.layers = [...((options.style as { layers?: Capa[] } | undefined)?.layers ?? [])].map((l) => ({ ...l }))
      FakeMap.all.push(this)
    }
    on(event: string, ...rest: unknown[]) {
      if (event === 'load') this.onLoad = rest[0] as () => void
      else if (rest.length === 2) (this.handlers[`${event} ${rest[0] as string}`] ??= []).push(rest[1] as (e: unknown) => void)
      else (this.handlers[event] ??= []).push(rest[0] as (e: unknown) => void)
    }
    addControl() {}
    once() {}
    isMoving() {
      return false
    }
    addSource(id: string, source: Record<string, unknown>) {
      this.sources.set(id, { ...source, setData: this.setData })
    }
    getSource(id: string) {
      return this.sources.get(id)
    }
    removeSource(id: string) {
      this.sources.delete(id)
    }
    addLayer(layer: Capa, antes?: string) {
      const i = antes ? this.layers.findIndex((l) => l.id === antes) : -1
      if (i >= 0) this.layers.splice(i, 0, layer)
      else this.layers.push(layer)
    }
    getLayer(id: string) {
      return this.layers.find((l) => l.id === id)
    }
    removeLayer(id: string) {
      this.layers = this.layers.filter((l) => l.id !== id)
    }
    getStyle() {
      return { layers: this.layers }
    }
    setPaintProperty(id: string, prop: string, value: unknown) {
      const capa = this.getLayer(id)
      if (capa) capa.paint = { ...capa.paint, [prop]: value }
    }
    setLayoutProperty(id: string, prop: string, value: unknown) {
      const capa = this.getLayer(id)
      if (capa) capa.layout = { ...capa.layout, [prop]: value }
    }
    getCanvas() {
      return document.createElement('canvas')
    }
    resize() {}
    fire(event: string, capa: string | null, e: unknown) {
      for (const h of this.handlers[capa ? `${event} ${capa}` : event] ?? []) h(e)
    }
  }
  // a lote's popup is a node React draws in (setDOMContent), a vía's is markup (setHTML); both go in the document
  class FakePopup {
    static html: string[] = []
    static nodos: HTMLElement[] = []
    static lngLat: unknown[] = []
    cerrar: (() => void)[] = []
    nodo: HTMLElement | null = null
    setLngLat(lngLat: unknown) {
      FakePopup.lngLat.push(lngLat)
      return this
    }
    setHTML(html: string) {
      FakePopup.html.push(html)
      return this
    }
    setDOMContent(nodo: HTMLElement) {
      this.nodo = nodo
      FakePopup.nodos.push(nodo)
      return this
    }
    on(event: string, h: () => void) {
      if (event === 'close') this.cerrar.push(h)
      return this
    }
    addTo() {
      if (this.nodo) document.body.append(this.nodo)
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

const lote = (id: string, x: number, properties: Partial<LoteVisorProps>): LotesVisor['features'][number] => ({
  type: 'Feature' as const,
  id,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, -14.07],
        [x + 0.001, -14.07],
        [x + 0.001, -14.069],
        [x, -14.07]
      ]
    ]
  },
  properties: { categoria: 'OMISO', confianza: 'CONFIABLE', delta_impuesto: 120, estado: 'PENDIENTE', supera_5_uit: false, ...properties }
})

const LOTES: LotesVisor = {
  type: 'FeatureCollection',
  features: [lote('b1', -75.73, { codigo: '01-01-0001', codigo_catastro: 'PM-1' }), lote('b2', -75.72, { codigo: '01-01-0002', estado: 'A_FISCALIZAR' })]
}

const VIAS: TramosCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [] },
      properties: {
        cod_via_eje: 'E1',
        tip_via: 'AV',
        nom_via: 'Grau',
        cuadra: '3',
        lado: 'AMBOS',
        id_aranc: 'A-1',
        asignacion: 'NOMBRE_UNICO',
        anio: 2026,
        valor_m2: 120
      }
    }
  ]
}

const props = (cambios: Partial<VisorMapaProps> = {}): VisorMapaProps => ({
  vista: { center: [-75.73, -14.07], zoom: 14 },
  clave: '2026|',
  anio: 2026,
  corrida: '',
  lotes: LOTES,
  colorear: 'categoria',
  vias: undefined,
  mostrarVias: false,
  clasesVias: clasesPorValor([]),
  wms: [],
  ...cambios
})

// the popup asks the predios of its lote: the map lives under the router and the queries
function montar(inicial: Partial<VisorMapaProps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const con = (hijo: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{hijo}</MemoryRouter>
    </QueryClientProvider>
  )
  const vista = render(con(<VisorMapa {...props(inicial)} />))
  const mapa = fake.FakeMap.all.at(-1)!
  act(() => mapa.onLoad?.())
  return { ...vista, mapa, cambiar: (cambios: Partial<VisorMapaProps>) => vista.rerender(con(<VisorMapa {...props({ ...inicial, ...cambios })} />)) }
}

let fetch: FetchMock | null = null

const pintura = (mapa: InstanceType<typeof fake.FakeMap>, id: string) => mapa.getLayer(id)?.paint

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  client.setToken('tok')
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  for (const nodo of fake.FakePopup.nodos) nodo.remove()
  client.setToken(null)
  fake.FakeMap.all = []
  fake.FakePopup.html = []
  fake.FakePopup.nodos = []
  fake.FakePopup.lngLat = []
  vi.unstubAllGlobals()
})

describe('las teselas WMS del visor', () => {
  it('ask srtm’s forwarding for a GetMap of the layer, in EPSG:3857', () => {
    const url = new URL(teselasWms('predio_catastral__0a1b2c3d__geom', 'http://srtm.test').replace('{bbox-epsg-3857}', 'BBOX'))
    expect(url.origin + url.pathname).toBe('http://srtm.test/api/srtm/visor/wms')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      service: 'WMS',
      request: 'GetMap',
      layers: 'predio_catastral__0a1b2c3d__geom',
      bbox: 'BBOX',
      width: '256',
      height: '256',
      srs: 'EPSG:3857',
      format: 'image/png',
      transparent: 'true'
    })
  })

  it('carry srtm’s Bearer, and nothing else does', () => {
    const origen = 'http://srtm.test'
    expect(conTokenVisor(`${origen}/api/srtm/visor/wms?request=GetMap`, 'tok', origen)).toEqual({
      url: `${origen}/api/srtm/visor/wms?request=GetMap`,
      headers: { Authorization: 'Bearer tok' }
    })
    // the basemap, another origin, another path of srtm, no session
    expect(conTokenVisor('https://tile.openstreetmap.org/1/2/3.png', 'tok', origen).headers).toBeUndefined()
    expect(conTokenVisor('http://otro.test/api/srtm/visor/wms?x', 'tok', origen).headers).toBeUndefined()
    expect(conTokenVisor(`${origen}/api/srtm/visor/lotes`, 'tok', origen).headers).toBeUndefined()
    expect(conTokenVisor(`${origen}/geoserver/catastro/wms`, 'tok', origen).headers).toBeUndefined()
    expect(conTokenVisor(`${origen}/api/srtm/visor/wms?x`, null, origen).headers).toBeUndefined()
  })
})

describe('el mapa del visor', () => {
  it('opens on the view it is given, with the session’s token on the WMS tiles', () => {
    const { mapa } = montar()
    expect(mapa.options).toMatchObject({ center: [-75.73, -14.07], zoom: 14 })
    const transformar = mapa.options.transformRequest as (url: string) => { headers?: Record<string, string> }
    expect(transformar(`${window.location.origin}/api/srtm/visor/wms?request=GetMap`).headers).toEqual({ Authorization: 'Bearer tok' })
    expect(transformar('https://tile.openstreetmap.org/1/2/3.png').headers).toBeUndefined()
  })

  it('draws the lotes once and frames them, then only when the corrida changes', () => {
    const { mapa, cambiar } = montar()
    expect(mapa.setData).toHaveBeenCalledWith(LOTES)
    expect(mapa.fitBounds).toHaveBeenCalledTimes(1)
    cambiar({ lotes: { ...LOTES, features: LOTES.features.slice(0, 1) } })
    expect(mapa.fitBounds).toHaveBeenCalledTimes(1)
    cambiar({ clave: '2026|c1', lotes: { ...LOTES } })
    expect(mapa.fitBounds).toHaveBeenCalledTimes(2)
  })

  it('paints the lotes by categoría with catastro-ui’s colours, and by Δ on its diverging scale', () => {
    const { mapa, cambiar } = montar()
    const categoria = JSON.stringify(pintura(mapa, 'visor-lotes-relleno')?.['fill-color'])
    expect(categoria).toContain('"OMISO","#e15759"')
    expect(categoria).toContain('"COINCIDE","#76b7b2"')
    cambiar({ colorear: 'delta' })
    expect(pintura(mapa, 'visor-lotes-relleno')?.['fill-color']).toEqual([
      'case',
      ['==', ['typeof', ['get', 'delta_impuesto']], 'number'],
      ['step', ['get', 'delta_impuesto'], '#2166ac', -500, '#67a9cf', -50, '#d1e5f0', -1, '#e0e0e0', 1, '#fddbc7', 50, '#ef8a62', 500, '#b2182b'],
      '#9ca3af'
    ])
    cambiar({ colorear: 'estado' })
    expect(JSON.stringify(pintura(mapa, 'visor-lotes-relleno')?.['fill-color'])).toContain('"A_FISCALIZAR","#e15759"')
  })

  it('opens a read-only popup on a lote, and asks its predios only then', async () => {
    fetch = mockFetch([
      {
        path: '/srtm/visor/lotes/01-01-0002/predios',
        body: [
          {
            id: 'b2',
            predio: 'p2',
            codigo_predio: '01-01-0002',
            declaracion: 'd2',
            contribuyente: 'c2',
            contribuyente_nombre: 'QUISPE MAMANI JUAN',
            categoria: 'OMISO',
            confianza: 'CONFIABLE',
            delta_impuesto: 120,
            estado: 'A_FISCALIZAR'
          },
          {
            id: 'b3',
            predio: 'p3',
            codigo_predio: '01-01-0002-1',
            declaracion: null,
            contribuyente: 'c3',
            contribuyente_nombre: null,
            categoria: 'COINCIDE',
            confianza: null,
            delta_impuesto: '0.40',
            estado: null
          }
        ]
      }
    ])
    const { mapa } = montar()
    expect(fetch.calls).toHaveLength(0)
    act(() => mapa.fire('click', 'visor-lotes-relleno', { point: [0, 0], lngLat: [0, 0], features: [{ properties: LOTES.features[1].properties }] }))
    const popup = screen.getByTestId('popup-lote')
    expect(popup).toHaveTextContent('01-01-0002')
    expect(popup).toHaveTextContent('Omiso')
    expect(popup.textContent?.replace(/\u00a0/g, ' ')).toContain('+S/ 120.00')
    expect(popup).toHaveTextContent('A fiscalizar')
    expect(within(popup).getByRole('status')).toHaveTextContent('Cargando predios…')

    const predios = await within(popup).findByRole('list', { name: 'Predios del lote' })
    expect(fetch.calls.map((c) => c.path)).toEqual(['/srtm/visor/lotes/01-01-0002/predios?anio=2026'])
    const [uno, dos] = within(predios).getAllByRole('listitem')
    expect(uno.textContent?.replace(/\u00a0/g, ' ')).toContain('Omiso+S/ 120.00')
    expect(uno).toHaveTextContent('QUISPE MAMANI JUAN')
    expect(within(uno).getByRole('link', { name: 'Ver predio 01-01-0002' })).toHaveAttribute('href', '/predios/p2')
    expect(within(uno).getByRole('link', { name: 'Ver contribuyente de 01-01-0002' })).toHaveTextContent('Ver contribuyente')
    expect(within(uno).getByRole('link', { name: 'Ver contribuyente de 01-01-0002' })).toHaveAttribute('href', '/contribuyentes/c2')
    // no name (the user may not read contribuyentes): only «Contribuyente»
    expect(dos.textContent?.replace(/\u00a0/g, ' ')).toContain('01-01-0002-1Coincide+S/ 0.40')
    expect(within(dos).getByRole('link', { name: 'Ver contribuyente de 01-01-0002-1' })).toHaveTextContent(/^Contribuyente$/)
    expect(within(dos).getByRole('link', { name: 'Ver predio 01-01-0002-1' })).toHaveAttribute('href', '/predios/p3')
  })

  it('says when the lote is not in the corrida, or its predios cannot be read', async () => {
    fetch = mockFetch([
      { path: '/srtm/visor/lotes/01-01-0001/predios', status: 404, body: { title: 'Not Found', status: 404 } },
      { path: '/srtm/visor/lotes/01-01-0002/predios', status: 500, body: { title: 'Error', status: 500 } }
    ])
    const { mapa } = montar({ corrida: 'c1' })
    act(() => mapa.fire('click', 'visor-lotes-relleno', { point: [0, 0], lngLat: [0, 0], features: [{ properties: LOTES.features[0].properties }] }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El lote no está en esta corrida.')
    expect(fetch.calls[0].path).toBe('/srtm/visor/lotes/01-01-0001/predios?anio=2026&corrida=c1')
    // another lote closes the first popup
    act(() => mapa.fire('click', 'visor-lotes-relleno', { point: [0, 0], lngLat: [0, 0], features: [{ properties: LOTES.features[1].properties }] }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron leer los predios del lote.')
    expect(screen.getAllByTestId('popup-lote')).toHaveLength(1)
  })

  it('opens on the view it was left on, without framing the lotes, and tells where it stops and the cursor', () => {
    const onCamara = vi.fn()
    const onCursor = vi.fn()
    const { mapa } = montar({ camara: { center: [-75.7, -14.06], zoom: 17.5 }, onCamara, onCursor })
    expect(mapa.options).toMatchObject({ center: [-75.7, -14.06], zoom: 17.5 })
    expect(mapa.options.bounds).toBeUndefined()
    expect(mapa.fitBounds).not.toHaveBeenCalled()
    act(() => mapa.fire('moveend', null, {}))
    expect(onCamara).toHaveBeenCalledWith({ center: [-75.73, -14.07], zoom: 15 })
    act(() => mapa.fire('mousemove', null, { lngLat: { lng: -75.735, lat: -14.065 } }))
    expect(onCursor).toHaveBeenLastCalledWith({ lng: -75.735, lat: -14.065 })
    act(() => mapa.fire('mouseout', null, {}))
    expect(onCursor).toHaveBeenLastCalledWith(null)
  })

  it('follows the opacity of the lotes and of the vías, and hides the basemap', () => {
    const { mapa, cambiar } = montar()
    expect(pintura(mapa, 'visor-lotes-relleno')?.['fill-opacity']).toBe(0.6)
    cambiar({ opacidadLotes: 0.3, opacidadVias: 0.5, base: 'ninguno' })
    expect(pintura(mapa, 'visor-lotes-relleno')?.['fill-opacity']).toBe(0.3)
    expect(pintura(mapa, 'visor-vias-con-valor')?.['line-opacity']).toBe(0.5)
    expect(pintura(mapa, 'visor-vias-sin-asignar')?.['line-opacity']).toBe(0.5)
    expect(mapa.getLayer('osm')?.layout?.visibility).toBe('none')
    cambiar({ base: 'osm' })
    expect(mapa.getLayer('osm')?.layout?.visibility).toBe('visible')
  })

  it('puts the WMS layers under the lotes, follows their opacity and takes them off', () => {
    const capa = 'predio_catastral__0a1b2c3d__geom'
    const { mapa, cambiar } = montar()
    cambiar({ wms: [{ layerName: capa, opacity: 0.7 }] })
    const id = `visor-wms-${capa}`
    const fuente = mapa.getSource(id) as { type: string; tiles: string[]; tileSize: number }
    expect(fuente.type).toBe('raster')
    expect(fuente.tiles[0]).toBe(teselasWms(capa))
    expect(fuente.tiles[0]).toContain('/api/srtm/visor/wms?')
    const orden = mapa.layers.map((l) => l.id)
    expect(orden.indexOf(id)).toBeLessThan(orden.indexOf('visor-lotes-relleno'))
    expect(pintura(mapa, id)).toEqual({ 'raster-opacity': 0.7 })

    cambiar({ wms: [{ layerName: capa, opacity: 0.35 }] })
    expect(pintura(mapa, id)).toEqual({ 'raster-opacity': 0.35 })
    expect(mapa.layers.filter((l) => l.id === id)).toHaveLength(1)

    cambiar({ wms: [] })
    expect(mapa.getLayer(id)).toBeUndefined()
    expect(mapa.getSource(id)).toBeUndefined()
  })

  it('shows the vías only when asked, coloured by their valor_m2', () => {
    const { mapa, cambiar } = montar()
    const visibles = () => ['con-valor', 'sin-arancel-anio', 'sin-asignar'].map((c) => mapa.getLayer(`visor-vias-${c}`)?.layout?.visibility)
    expect(visibles()).toEqual(['none', 'none', 'none'])
    cambiar({ mostrarVias: true, vias: VIAS, clasesVias: clasesPorValor([120]) })
    expect(visibles()).toEqual(['visible', 'visible', 'visible'])
    expect(mapa.setData).toHaveBeenLastCalledWith(VIAS)
    expect(pintura(mapa, 'visor-vias-con-valor')?.['line-color']).not.toBe('#993404')
    // a click on a vía over a lote opens the vía's popup, not the lote's
    mapa.queryRenderedFeatures.mockReturnValueOnce([{}])
    mapa.fire('click', 'visor-lotes-relleno', { point: [0, 0], lngLat: [0, 0], features: [{ properties: LOTES.features[0].properties }] })
    mapa.fire('click', 'visor-vias-con-valor', { point: [0, 0], lngLat: [0, 0], features: [{ properties: VIAS.features[0].properties }] })
    expect(fake.FakePopup.html).toHaveLength(1)
    expect(fake.FakePopup.html[0]).toContain('AV Grau')
    expect(fake.FakePopup.html[0]).toContain('S/ 120 por m²')
  })

  it('takes the map down when it unmounts', () => {
    const { mapa, unmount } = montar()
    unmount()
    expect(mapa.remove).toHaveBeenCalled()
  })
})
