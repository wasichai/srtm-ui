import { cn } from '@wasichai/ui'
import { lazy, Suspense } from 'react'
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
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-ink-muted">Cargando mapa…</div>}>
        <LotesMapImpl {...props} />
      </Suspense>
    </div>
  )
}
