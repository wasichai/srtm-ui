import 'maplibre-gl/dist/maplibre-gl.css'
import type { StyleClasses } from '@wasichai/gis'
import { Map as MapLibreMap, NavigationControl, Popup, ScaleControl, setWorkerUrl, type GeoJSONSource, type RasterTileSource } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { boundsOf, type Geometry, type VistaMapa } from '../../components/geo'
import { ESTILO_BASE } from '../../components/mapaBase'
import { mapWorkerUrl } from '../../components/mapWorker'
import { agregarCapasVias, capasDeVias, pintarVias, verVias } from './capasVias'
import { GRIS, colorDeLote, type Colorear } from './colores'
import { popupLote } from './popup'
import type { CapaWmsActiva, LoteVisorProps, LotesVisor, TramosCollection } from './tipos'
import { conTokenVisor, teselasWms } from './wms'

const LOTES = 'visor-lotes'
export const RELLENO = `${LOTES}-relleno`
export const BORDE = `${LOTES}-borde`
const VIAS = 'visor-vias'
const CAPAS_VIAS = capasDeVias(VIAS)
export const WMS = 'visor-wms-'

const VACIO = { type: 'FeatureCollection' as const, features: [] }

export interface VisorMapaProps {
  // where it opens: the organization's lotes (MapaVisor gives vistaInicial)
  vista: VistaMapa
  // a new year or corrida frames the map again on its lotes
  clave: string
  lotes: LotesVisor | undefined
  colorear: Colorear
  vias: TramosCollection | undefined
  mostrarVias: boolean
  clasesVias: StyleClasses
  wms: CapaWmsActiva[]
}

// catastro's GeoServer layers through srtm, as raster tiles in EPSG:3857 under the lotes
function sincronizarWms(m: MapLibreMap, capas: CapaWmsActiva[]) {
  const quedan = new Set(capas.map((c) => WMS + c.layerName))
  for (const id of (m.getStyle().layers ?? []).map((l) => l.id).filter((id) => id.startsWith(WMS) && !quedan.has(id))) {
    m.removeLayer(id)
    m.removeSource(id)
  }
  for (const capa of capas) {
    const id = WMS + capa.layerName
    if (m.getSource(id) as RasterTileSource | undefined) {
      m.setPaintProperty(id, 'raster-opacity', capa.opacity)
      continue
    }
    m.addSource(id, { type: 'raster', tiles: [teselasWms(capa.layerName)], tileSize: 256 })
    m.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': capa.opacity } }, RELLENO)
  }
}

// the lotes of the corrida coloured by the chosen key, the vías with their arancel and catastro's WMS layers, read
// only: a click opens the lote's popup. each prop has its own effect, so an opacity does not send the lotes to the
// worker again: the GeoJSON goes only when it changes, the colours by paint
export default function VisorMapa(props: VisorMapaProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapLibreMap | null>(null)
  const listo = useRef(false)
  const encuadrado = useRef(false)
  const ultimo = useRef(props)
  ultimo.current = props

  const conMapa = (f: (m: MapLibreMap, p: VisorMapaProps) => void) => () => {
    if (mapa.current && listo.current) f(mapa.current, ultimo.current)
  }

  const aplicarLotes = conMapa((m, p) => {
    ;(m.getSource(LOTES) as GeoJSONSource | undefined)?.setData((p.lotes ?? VACIO) as never)
    if (p.lotes?.features.length && !encuadrado.current) {
      const caja = boundsOf(p.lotes.features.map((f) => f.geometry as Geometry))
      if (caja) m.fitBounds(caja, { padding: 40, maxZoom: 17, animate: false })
      encuadrado.current = true
    }
  })
  const aplicarColor = conMapa((m, p) => m.setPaintProperty(RELLENO, 'fill-color', colorDeLote(p.colorear)))
  const aplicarVias = conMapa((m, p) => {
    ;(m.getSource(VIAS) as GeoJSONSource | undefined)?.setData((p.mostrarVias && p.vias ? p.vias : VACIO) as never)
    verVias(m, VIAS, p.mostrarVias)
  })
  const aplicarClasesVias = conMapa((m, p) => pintarVias(m, VIAS, p.clasesVias))
  const aplicarWms = conMapa((m, p) => sincronizarWms(m, p.wms))

  useEffect(() => {
    if (!contenedor.current) return
    const url = mapWorkerUrl()
    if (url) setWorkerUrl(url)
    const { vista } = ultimo.current
    const m = new MapLibreMap({
      container: contenedor.current,
      style: ESTILO_BASE,
      center: vista.center,
      zoom: vista.zoom,
      ...(vista.bounds ? { bounds: vista.bounds, fitBoundsOptions: { padding: 40, maxZoom: 16 } } : {}),
      attributionControl: { compact: true },
      // srtm's Bearer on the WMS tiles of srtm's forwarding, and on nothing else
      transformRequest: (u) => conTokenVisor(u)
    })
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    m.on('load', () => {
      m.addSource(LOTES, { type: 'geojson', data: VACIO })
      m.addLayer({ id: RELLENO, type: 'fill', source: LOTES, paint: { 'fill-color': GRIS, 'fill-opacity': 0.6 } })
      m.addLayer({ id: BORDE, type: 'line', source: LOTES, paint: { 'line-color': '#374151', 'line-width': 0.5, 'line-opacity': 0.5 } })
      agregarCapasVias(m, VIAS)
      m.on('click', RELLENO, (e) => {
        // a vía over the lote opens its own popup
        if (ultimo.current.mostrarVias && m.queryRenderedFeatures(e.point, { layers: CAPAS_VIAS }).length) return
        const propiedades = e.features?.[0]?.properties as LoteVisorProps | undefined
        if (propiedades) new Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(popupLote(propiedades)).addTo(m)
      })
      m.on('mouseenter', RELLENO, () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', RELLENO, () => (m.getCanvas().style.cursor = ''))
      listo.current = true
      for (const aplicar of [aplicarColor, aplicarLotes, aplicarVias, aplicarClasesVias, aplicarWms]) aplicar()
    })
    const observador = new ResizeObserver(() => m.resize())
    observador.observe(contenedor.current)
    mapa.current = m
    return () => {
      observador.disconnect()
      listo.current = false
      encuadrado.current = false
      m.remove()
      mapa.current = null
    }
    // one map per mount: the props are read through `ultimo`
  }, [])

  // declared before the lotes' effect: the new corrida's lotes, when they come, frame the map
  useEffect(() => {
    encuadrado.current = false
  }, [props.clave])
  useEffect(aplicarLotes, [props.lotes])
  useEffect(aplicarColor, [props.colorear])
  useEffect(aplicarVias, [props.vias, props.mostrarVias])
  useEffect(aplicarClasesVias, [props.clasesVias])
  useEffect(aplicarWms, [props.wms])

  return <div ref={contenedor} role="region" aria-label="Mapa de lotes de la brecha" className="h-full w-full" data-testid="visor-mapa" />
}
