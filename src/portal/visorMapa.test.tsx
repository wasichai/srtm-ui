import { act, render } from '@testing-library/react'
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
    queryRenderedFeatures = vi.fn(() => [] as unknown[])
    constructor(options: Record<string, unknown>) {
      this.options = options
      FakeMap.all.push(this)
    }
    on(event: string, ...rest: unknown[]) {
      if (event === 'load') this.onLoad = rest[0] as () => void
      else if (rest.length === 2) (this.handlers[`${event} ${rest[0] as string}`] ??= []).push(rest[1] as (e: unknown) => void)
    }
    addControl() {}
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
    fire(event: string, capa: string, e: unknown) {
      for (const h of this.handlers[`${event} ${capa}`] ?? []) h(e)
    }
  }
  class FakePopup {
    static html: string[] = []
    setLngLat() {
      return this
    }
    setHTML(html: string) {
      FakePopup.html.push(html)
      return this
    }
    addTo() {
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
  lotes: LOTES,
  colorear: 'categoria',
  vias: undefined,
  mostrarVias: false,
  clasesVias: clasesPorValor([]),
  wms: [],
  ...cambios
})

function montar(inicial: Partial<VisorMapaProps> = {}) {
  const vista = render(<VisorMapa {...props(inicial)} />)
  const mapa = fake.FakeMap.all.at(-1)!
  act(() => mapa.onLoad?.())
  return { ...vista, mapa, cambiar: (cambios: Partial<VisorMapaProps>) => vista.rerender(<VisorMapa {...props({ ...inicial, ...cambios })} />) }
}

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
  client.setToken(null)
  fake.FakeMap.all = []
  fake.FakePopup.html = []
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

  it('opens a read-only popup on a lote', () => {
    const { mapa } = montar()
    mapa.fire('click', 'visor-lotes-relleno', { point: [0, 0], lngLat: [0, 0], features: [{ properties: LOTES.features[1].properties }] })
    expect(fake.FakePopup.html).toHaveLength(1)
    const html = fake.FakePopup.html[0]
    expect(html).toContain('01-01-0002')
    expect(html).toContain('Omiso')
    expect(html).toContain('+S/ 120.00')
    expect(html).toContain('A fiscalizar')
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
