import 'maplibre-gl/dist/maplibre-gl.css'
import type { StyleClasses } from '@wasichai/gis'
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLatLike,
  type RasterTileSource
} from 'maplibre-gl'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { boundsOf, type Geometry, type VistaMapa } from '../../components/geo'
import { ESTILO_BASE } from '../../components/mapaBase'
import { mapWorkerUrl } from '../../components/mapWorker'
import { agregarCapasVias, capasDeVias, opacarVias, pintarVias, verVias } from './capasVias'
import { GRIS, colorDeLote, type Colorear } from './colores'
import { OPACIDAD_LOTES, OPACIDAD_VIAS, type Camara, type MapaBase } from './estado'
import { PopupLote } from './PopupLote'
import type { CapaWmsActiva, LoteVisorProps, LotesVisor, TramosCollection } from './tipos'
import { conTokenVisor, teselasWms } from './wms'

const LOTES = 'visor-lotes'
export const RELLENO = `${LOTES}-relleno`
export const BORDE = `${LOTES}-borde`
const VIAS = 'visor-vias'
const CAPAS_VIAS = capasDeVias(VIAS)
export const WMS = 'visor-wms-'
// the basemap's layer (ESTILO_BASE)
const BASE = 'osm'

const VACIO = { type: 'FeatureCollection' as const, features: [] }

// what the full page asks of the map: go to a lote by its code and open its popup
export interface ControlMapa {
  irA: (codigo: string) => boolean
}

export interface VisorMapaProps {
  // where it opens: the organization's lotes (MapaVisor gives vistaInicial), unless `camara` says where it was left
  vista: VistaMapa
  // a new year or corrida frames the map again on its lotes
  clave: string
  // the corrida read, for the predios of a lote's popup
  anio: number
  corrida: string
  lotes: LotesVisor | undefined
  colorear: Colorear
  vias: TramosCollection | undefined
  mostrarVias: boolean
  clasesVias: StyleClasses
  wms: CapaWmsActiva[]
  opacidadLotes?: number
  opacidadVias?: number
  base?: MapaBase
  // the view it was left on (the url's): it opens there and does not frame the lotes
  camara?: Camara | null
  // the view once the map stops moving, and the cursor over it (null when it leaves)
  onCamara?: (c: Camara) => void
  onCursor?: (punto: { lng: number; lat: number } | null) => void
  // the full page: zoom and north at the bottom right
  pantallaCompleta?: boolean
  ref?: Ref<ControlMapa>
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

const norm = (s: string) => s.trim().toUpperCase()

// the popup open on the map: the lote and the node maplibre shows, where React draws PopupLote
interface Abierto {
  lote: LoteVisorProps
  nodo: HTMLElement
}

// the lotes of the corrida coloured by the chosen key, the vías with their arancel and catastro's WMS layers, read
// only: a click opens the lote's popup, with its predios and the links to their fichas. each prop has its own
// effect, so an opacity does not send the lotes to the worker again: the GeoJSON goes only when it changes, the
// colours by paint
export default function VisorMapa(props: VisorMapaProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapLibreMap | null>(null)
  const listo = useRef(false)
  // a map that opens on a view it was left on does not frame the lotes
  const encuadrado = useRef(Boolean(props.camara))
  const ultimo = useRef(props)
  ultimo.current = props
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const popup = useRef<Popup | null>(null)

  const conMapa = (f: (m: MapLibreMap, p: VisorMapaProps) => void) => () => {
    if (mapa.current && listo.current) f(mapa.current, ultimo.current)
  }

  // the popup of a lote, drawn by React in maplibre's node (createPortal): it keeps the router and the queries
  const abrirPopup = (m: MapLibreMap, lngLat: LngLatLike, lote: LoteVisorProps) => {
    popup.current?.remove()
    const nodo = document.createElement('div')
    const p = new Popup({ closeButton: true, maxWidth: '20rem', focusAfterOpen: false }).setLngLat(lngLat).setDOMContent(nodo).addTo(m)
    p.on('close', () => setAbierto((a) => (a?.nodo === nodo ? null : a)))
    popup.current = p
    setAbierto({ lote, nodo })
  }

  useImperativeHandle(
    props.ref,
    () => ({
      irA: (codigo) => {
        const m = mapa.current
        const buscado = norm(codigo)
        const lote = buscado
          ? ultimo.current.lotes?.features.find((f) => norm(f.properties.codigo ?? '') === buscado || norm(f.properties.codigo_catastro ?? '') === buscado)
          : undefined
        const caja = lote ? boundsOf([lote.geometry as Geometry]) : null
        if (!m || !lote || !caja) return false
        m.fitBounds(caja, { padding: 80, maxZoom: 19 })
        m.once('moveend', () => ajustar.current())
        const [[w, s], [e, n]] = caja
        abrirPopup(m, [(w + e) / 2, (s + n) / 2], lote.properties)
        return true
      }
    }),
    []
  )

  const aplicarLotes = conMapa((m, p) => {
    ;(m.getSource(LOTES) as GeoJSONSource | undefined)?.setData((p.lotes ?? VACIO) as never)
    if (p.lotes?.features.length && !encuadrado.current) {
      const caja = boundsOf(p.lotes.features.map((f) => f.geometry as Geometry))
      if (caja) m.fitBounds(caja, { padding: 40, maxZoom: 17, animate: false })
      encuadrado.current = true
    }
  })
  const aplicarColor = conMapa((m, p) => m.setPaintProperty(RELLENO, 'fill-color', colorDeLote(p.colorear)))
  const aplicarOpacidad = conMapa((m, p) => m.setPaintProperty(RELLENO, 'fill-opacity', p.opacidadLotes ?? OPACIDAD_LOTES))
  const aplicarVias = conMapa((m, p) => {
    ;(m.getSource(VIAS) as GeoJSONSource | undefined)?.setData((p.mostrarVias && p.vias ? p.vias : VACIO) as never)
    verVias(m, VIAS, p.mostrarVias)
  })
  const aplicarClasesVias = conMapa((m, p) => pintarVias(m, VIAS, p.clasesVias))
  const aplicarOpacidadVias = conMapa((m, p) => opacarVias(m, VIAS, p.opacidadVias ?? OPACIDAD_VIAS))
  const aplicarWms = conMapa((m, p) => sincronizarWms(m, p.wms))
  const aplicarBase = conMapa((m, p) => m.setLayoutProperty(BASE, 'visibility', p.base === 'ninguno' ? 'none' : 'visible'))

  useEffect(() => {
    if (!contenedor.current) return
    const url = mapWorkerUrl()
    if (url) setWorkerUrl(url)
    const { vista, camara, pantallaCompleta } = ultimo.current
    const m = new MapLibreMap({
      container: contenedor.current,
      style: ESTILO_BASE,
      ...(camara
        ? { center: camara.center, zoom: camara.zoom }
        : {
            center: vista.center,
            zoom: vista.zoom,
            ...(vista.bounds ? { bounds: vista.bounds, fitBoundsOptions: { padding: 40, maxZoom: 16 } } : {})
          }),
      attributionControl: { compact: true },
      // srtm's Bearer on the WMS tiles of srtm's forwarding, and on nothing else
      transformRequest: (u) => conTokenVisor(u)
    })
    m.addControl(new NavigationControl({ showCompass: Boolean(pantallaCompleta) }), pantallaCompleta ? 'bottom-right' : 'top-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    m.on('load', () => {
      m.addSource(LOTES, { type: 'geojson', data: VACIO })
      m.addLayer({ id: RELLENO, type: 'fill', source: LOTES, paint: { 'fill-color': GRIS, 'fill-opacity': OPACIDAD_LOTES } })
      m.addLayer({ id: BORDE, type: 'line', source: LOTES, paint: { 'line-color': '#374151', 'line-width': 0.5, 'line-opacity': 0.5 } })
      agregarCapasVias(m, VIAS)
      m.on('click', RELLENO, (e) => {
        // a vía over the lote opens its own popup
        if (ultimo.current.mostrarVias && m.queryRenderedFeatures(e.point, { layers: CAPAS_VIAS }).length) return
        const propiedades = e.features?.[0]?.properties as LoteVisorProps | undefined
        if (propiedades) abrirPopup(m, e.lngLat, propiedades)
      })
      m.on('mouseenter', RELLENO, () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', RELLENO, () => (m.getCanvas().style.cursor = ''))
      listo.current = true
      for (const aplicar of [aplicarColor, aplicarOpacidad, aplicarLotes, aplicarVias, aplicarClasesVias, aplicarOpacidadVias, aplicarWms, aplicarBase])
        aplicar()
    })
    m.on('moveend', () => {
      const c = m.getCenter()
      ultimo.current.onCamara?.({ center: [c.lng, c.lat], zoom: m.getZoom() })
    })
    m.on('mousemove', (e) => ultimo.current.onCursor?.({ lng: e.lngLat.lng, lat: e.lngLat.lat }))
    m.on('mouseout', () => ultimo.current.onCursor?.(null))
    const observador = new ResizeObserver(() => m.resize())
    observador.observe(contenedor.current)
    mapa.current = m
    return () => {
      observador.disconnect()
      listo.current = false
      encuadrado.current = false
      popup.current = null
      m.remove()
      mapa.current = null
    }
    // one map per mount: the props are read through `ultimo`
  }, [])

  // the popup is drawn after maplibre placed it, and grows when its predios come: placed again with its real size,
  // and the map moved so it is seen whole (maplibre does not pan to a popup); on the full page, below its floating
  // search and toolbar (two rows on a phone)
  const ajustarPopup = () => {
    const p = popup.current
    const m = mapa.current
    const a = p?.getElement()?.getBoundingClientRect()
    if (!p || !m || !a) return
    p.setLngLat(p.getLngLat())
    const b = m.getContainer().getBoundingClientRect()
    const arriba = ultimo.current.pantallaCompleta ? (b.width < 768 ? 112 : 64) : 8
    const dx = Math.min(0, a.left - b.left - 8) || Math.max(0, a.right - b.right + 8)
    const dy = Math.min(0, a.top - b.top - arriba) || Math.max(0, a.bottom - b.bottom + 8)
    if (dx || dy) m.panBy([dx, dy], { duration: 200 })
  }
  const ajustar = useRef(ajustarPopup)
  ajustar.current = ajustarPopup
  useEffect(() => {
    if (!abierto) return
    const observador = new ResizeObserver(() => {
      // a map still moving (flying to the lote of the search, or panning to the popup) is moved once it stops
      const m = mapa.current
      if (m?.isMoving()) m.once('moveend', () => ajustar.current())
      else ajustar.current()
    })
    observador.observe(abierto.nodo)
    return () => observador.disconnect()
  }, [abierto])

  // the new corrida's lotes, when they come, frame the map (declared before the lotes' effect). not on the first
  // render: a map opened on a view it was left on keeps it
  const claveVista = useRef(props.clave)
  useEffect(() => {
    if (claveVista.current === props.clave) return
    claveVista.current = props.clave
    encuadrado.current = false
  }, [props.clave])
  useEffect(aplicarLotes, [props.lotes])
  useEffect(aplicarColor, [props.colorear])
  useEffect(aplicarOpacidad, [props.opacidadLotes])
  useEffect(aplicarVias, [props.vias, props.mostrarVias])
  useEffect(aplicarClasesVias, [props.clasesVias])
  useEffect(aplicarOpacidadVias, [props.opacidadVias])
  useEffect(aplicarWms, [props.wms])
  useEffect(aplicarBase, [props.base])

  return (
    <>
      {/* the map is no stacking context of its own: its popups rise over the legend and the floating cards beside
          it (z 5), under the full page's panel of layers (z 10) */}
      <div
        ref={contenedor}
        role="region"
        aria-label="Mapa de lotes de la brecha"
        className="h-full w-full [&_.maplibregl-popup]:z-[5]!"
        data-testid="visor-mapa"
      />
      {abierto && createPortal(<PopupLote lote={abierto.lote} anio={props.anio} corrida={props.corrida} />, abierto.nodo)}
    </>
  )
}
