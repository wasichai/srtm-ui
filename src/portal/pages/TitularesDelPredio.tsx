import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router'
import { Alert } from '@wasichai/ui'
import { rentas } from '../api'
import { anulada } from '../components/EstadoBadge'
import { secuencia } from '../components/secuencia'
import type { DeclaracionDetalle } from '../types'

// the vigentes declaraciones of a predio in a year and secuencia de uso: its titulares, whom a new declaración would
// join as a condómino (srtm-backend#4). none while the predio is new, or while its list cannot be read: the backend
// checks again
export function useTitularesDelPredio(predio: string | undefined, anio: number | null | undefined, secuenciaUso: string | null | undefined) {
  const query = useQuery({
    queryKey: ['predio', predio, 'declaraciones', anio],
    queryFn: () => rentas.declaracionesDePredio(predio!, anio ?? undefined),
    enabled: Boolean(predio && anio)
  })
  return (query.data ?? []).filter(({ declaracion: d }) => !anulada(d) && d.secuencia_uso != null && secuencia(d.secuencia_uso) === secuencia(secuenciaUso))
}

const nombre = (row: DeclaracionDetalle) => row.contribuyente?.nombre_completo ?? 'otro contribuyente'

const enlace = 'font-medium underline hover:text-danger/80'

// why the wizard does not present it: the backend would refuse a second titular at 100 %. a condómino is added, with
// its %, from "datos de los condóminos" of the declaración that holds the predio; a new owner, once the former owner's
// declaración is annulled (a descargo). the same contribuyente edits its own
export function AvisoTitulares({ titulares, contribuyente, anio }: { titulares: DeclaracionDetalle[]; contribuyente?: string; anio?: number | null }) {
  const propia = titulares.find((t) => t.declaracion.contribuyente === contribuyente)
  const primera = titulares[0]
  return (
    <Alert tone="danger" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        {propia ? (
          <span className="block">
            {nombre(propia)} ya declara este predio en {anio}.{' '}
            <Link to={`/declaraciones/${propia.declaracion.id}`} className={enlace}>
              Abrir su declaración
            </Link>
          </span>
        ) : (
          <span className="block space-y-1">
            <span className="block font-semibold">
              El predio ya tiene titular en {anio}: {titulares.map(nombre).join(', ')}.
            </span>
            <span className="block">
              Otro titular se agrega como condómino, con su % de propiedad, desde{' '}
              <Link to={`/declaraciones/${primera.declaracion.id}?tab=condominos`} className={enlace}>
                Datos de los condóminos
              </Link>{' '}
              de esa declaración. Si el predio cambió de dueño, anula antes la declaración del anterior (descargo).
            </span>
          </span>
        )}
      </span>
    </Alert>
  )
}
