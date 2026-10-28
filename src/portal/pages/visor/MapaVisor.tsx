import { lazy, Suspense } from 'react'
import { vistaInicial } from '../../components/geo'
import { SinMapa } from '../../components/LotesMap'
import { useMunicipalidad } from '../../queries'
import type { VisorMapaProps } from './VisorMapa'

// maplibre weighs more than the rest of the portal: the visor's map loads with its page, not with the portal
const VisorMapa = lazy(() => import('./VisorMapa'))

// the visor's map, where the organization's lotes are (GET /srtm/municipalidad), so it waits for them. a machine
// that cannot draw it (no webgl) says so in its place; the indicators and the table stay
export function MapaVisor(props: Omit<VisorMapaProps, 'vista'>) {
  const municipalidad = useMunicipalidad()
  const cargando = <div className="flex h-full items-center justify-center text-sm text-ink-muted">Cargando mapa…</div>
  return (
    <SinMapa aviso="Los indicadores y la tabla de predios siguen disponibles.">
      {municipalidad.isPending ? (
        cargando
      ) : (
        <Suspense fallback={cargando}>
          <VisorMapa vista={vistaInicial(municipalidad.data)} {...props} />
        </Suspense>
      )}
    </SinMapa>
  )
}
