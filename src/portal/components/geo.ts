// the geojson the portal handles: the backend sends and takes it in EPSG:4326

export interface Geometry {
  type: string
  coordinates: unknown
}

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

// Perené (INEI 120302): where the padrón's lotes are
export const PERENE: [number, number] = [-75.2247, -10.9475]

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

// a geometry kept in a form's hidden field, as text
export const parseGeometry = (text: string | null | undefined): Geometry | null => {
  if (!text) return null
  try {
    const value = JSON.parse(text) as Geometry
    return value && typeof value.type === 'string' ? value : null
  } catch {
    return null
  }
}
