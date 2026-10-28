import type { StyleClasses } from '@wasichai/gis'
import { Popup, type ExpressionSpecification, type Map } from 'maplibre-gl'
import { GRIS, colorPorValor } from './colores'
import { popupTramo } from './popup'
import type { TramoProps } from './tipos'

// the vías with their arancel, as catastro-ui's «Aranceles por vía» and «Brechas» draw them (src/aranceles/capasVias.ts)

const VACIO = { type: 'FeatureCollection' as const, features: [] }

// the frentes are drawn beside the eje: izquierdo to the left of the line's direction, derecho to the right
const DESPLAZAMIENTO_PX = 4
const DESPLAZAMIENTO: ExpressionSpecification = ['match', ['get', 'lado'], 'IZQUIERDO', -DESPLAZAMIENTO_PX, 'DERECHO', DESPLAZAMIENTO_PX, 0]

const SIN_ASIGNAR: ExpressionSpecification = ['==', ['get', 'asignacion'], 'SIN_ARANCEL']
const CON_VALOR: ExpressionSpecification = ['==', ['typeof', ['get', 'valor_m2']], 'number']
const FILTRO_CON_VALOR: ExpressionSpecification = ['all', ['!', SIN_ASIGNAR], CON_VALOR]
const FILTRO_SIN_ARANCEL_ANIO: ExpressionSpecification = ['all', ['!', SIN_ASIGNAR], ['!', CON_VALOR]]

// the ids of the three line layers of a vías source
export const capasDeVias = (fuente: string) => ['con-valor', 'sin-arancel-anio', 'sin-asignar'].map((id) => `${fuente}-${id}`)

// the tramos as lines, coloured by valor_m2 in classes; grey solid where the year has no arancel, grey dashed where
// the tramo was never assigned one. a click opens the tramo's popup
export function agregarCapasVias(m: Map, fuente: string, clases?: StyleClasses) {
  m.addSource(fuente, { type: 'geojson', data: VACIO })
  const base = { type: 'line' as const, source: fuente, layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const } }
  const paint = { 'line-width': 3, 'line-offset': DESPLAZAMIENTO }
  const [conValor, sinArancelAnio, sinAsignar] = capasDeVias(fuente)
  m.addLayer({ ...base, id: conValor, filter: FILTRO_CON_VALOR, paint: { ...paint, 'line-color': colorPorValor(clases) } })
  m.addLayer({ ...base, id: sinArancelAnio, filter: FILTRO_SIN_ARANCEL_ANIO, paint: { ...paint, 'line-color': GRIS } })
  m.addLayer({ ...base, id: sinAsignar, filter: SIN_ASIGNAR, paint: { ...paint, 'line-color': GRIS, 'line-dasharray': [2, 2] } })
  for (const capa of capasDeVias(fuente)) {
    m.on('click', capa, (e) => {
      const propiedades = e.features?.[0]?.properties as TramoProps | undefined
      if (propiedades) new Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(popupTramo(propiedades)).addTo(m)
    })
    m.on('mouseenter', capa, () => (m.getCanvas().style.cursor = 'pointer'))
    m.on('mouseleave', capa, () => (m.getCanvas().style.cursor = ''))
  }
}

export function pintarVias(m: Map, fuente: string, clases: StyleClasses | undefined) {
  m.setPaintProperty(`${fuente}-con-valor`, 'line-color', colorPorValor(clases))
}

export function verVias(m: Map, fuente: string, visibles: boolean) {
  for (const capa of capasDeVias(fuente)) m.setLayoutProperty(capa, 'visibility', visibles ? 'visible' : 'none')
}
