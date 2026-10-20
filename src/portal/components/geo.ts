import type { Geometry } from '../../kit/forms/geometry'

// the geojson the portal handles: the backend sends and takes it in EPSG:4326

// the kit's, for the portal's importers
export { parseGeometry, type Geometry } from '../../kit/forms/geometry'

export interface Feature {
  type: 'Feature'
  id?: string
  geometry: Geometry | null
  properties: Record<string, unknown>
}

export interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

export type Bbox = [number, number, number, number]

// Perú, whole: where the map opens when the backend gives no place for the organization's lotes
export const PERU: [number, number] = [-75.0152, -9.19]

// how the map opens: on `bounds` when given (center and zoom then only until it fits them), else on center and zoom
export interface VistaMapa {
  center: [number, number]
  zoom: number
  bounds?: [[number, number], [number, number]]
}

// the organization's lotes (GET /srtm/municipalidad's extension and centro), not a fixed municipalidad: the whole
// extent, else its centre close up, else all of Perú
export function vistaInicial(municipalidad?: { extension: Bbox | null; centro: [number, number] | null } | null): VistaMapa {
  const extension = municipalidad?.extension
  const centro = municipalidad?.centro
  if (extension) {
    const [w, s, e, n] = extension
    return {
      center: centro ?? [(w + e) / 2, (s + n) / 2],
      zoom: 14,
      bounds: [
        [w, s],
        [e, n]
      ]
    }
  }
  if (centro) return { center: centro, zoom: 14 }
  return { center: PERU, zoom: 5 }
}

// the id of a record behind a wasichai-gis feature ("<record>:<geometry>", or properties.__id)
export function recordIdOf(feature: Feature): string {
  const fromProps = feature.properties.__id
  if (typeof fromProps === 'string') return fromProps
  return String(feature.id ?? '').split(':')[0]
}

// the extremes of any geojson nesting, as [[w, s], [e, n]]
export function boundsOf(geometries: (Geometry | null | undefined)[]): [[number, number], [number, number]] | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      minX = Math.min(minX, value[0])
      minY = Math.min(minY, value[1])
      maxX = Math.max(maxX, value[0])
      maxY = Math.max(maxY, value[1])
      return
    }
    for (const item of value) visit(item)
  }
  for (const geometry of geometries) if (geometry?.coordinates) visit(geometry.coordinates)
  return Number.isFinite(minX)
    ? [
        [minX, minY],
        [maxX, maxY]
      ]
    : null
}
