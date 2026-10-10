import { cn } from '@wasichai/ui'
import { MapPinOff } from 'lucide-react'
import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { Bbox, FeatureCollection, Geometry } from './geo'

export interface LotesMapProps {
  // the lotes shown; each feature's record id is its selection id (recordIdOf)
  features?: FeatureCollection | null
  selectedId?: string | null
  onSelect?: (id: string) => void
  // the visible area, after every move: fetch the lotes around
  onBounds?: (bbox: Bbox) => void
  // draw or edit one polygon (the lote of a predio)
  draw?: { value: Geometry | null; onChange: (geometry: Geometry | null) => void } | null
  // place one point (a domicilio)
  point?: { value: Geometry | null; onChange: (geometry: Geometry) => void } | null
  // "descargar imagen": the caller gets a function that returns the map as a png data url
  onCapture?: (capture: () => string | null) => void
  label?: string
  className?: string
}

// maplibre and terra-draw are heavy: they load with the first map, not with the portal
const LotesMapImpl = lazy(() => import('./LotesMapImpl'))

export function LotesMap({ className, ...props }: LotesMapProps) {
  return (
    <div className={cn('relative h-72 w-full overflow-hidden rounded-md border border-border bg-surface-muted', className)}>
      <SinMapa>
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-ink-muted">Cargando mapa…</div>}>
          <LotesMapImpl {...props} />
        </Suspense>
      </SinMapa>
    </div>
  )
}

// a map that cannot be drawn (a machine without webgl, a remote desktop; its chunk gone after a deploy) says so in its
// place, and only there: the form or the dialog around it, and whatever the clerk typed, stay and can be saved. trying
// again would fail the same way, so it offers nothing to click
class SinMapa extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }

  static getDerivedStateFromError() {
    return { fallo: true }
  }

  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-ink-muted">
        <MapPinOff className="size-6" />
        <p className="font-medium text-ink">No se pudo mostrar el mapa en este equipo.</p>
        <p>El resto del formulario sigue disponible: puede continuar y guardar sin él.</p>
      </div>
    )
  }
}
