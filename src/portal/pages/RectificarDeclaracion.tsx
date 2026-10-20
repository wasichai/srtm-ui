import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { FilePen } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { RecordForm } from '../../kit/forms/RecordForm'
import type { SectionSpec } from '../../kit/forms/spec'
import { rentas } from '../api'
import { formatDate, today } from '../components/format'
import { useCatalogos, useDeclaracionesDePredio, useRefresh } from '../queries'
import type { Declaracion, Rectificacion } from '../types'

// the srtm's rectificatoria (srtm-backend#151): a new declaración, with its own number and motivo RECTIFICACION,
// that carries what this one declares and its lists to be corrected; this one stays SUSTITUIDA, read-only, and counts
// nowhere. no way back: the dialog is the confirmation, and asks how it is presented

const PRESENTACION: SectionSpec[] = [
  {
    id: 'presentacion',
    title: 'Presentación de la rectificatoria',
    fields: [
      { name: 'medio_presentacion', label: 'Medio de presentación', kind: 'enum', span: 3 },
      { name: 'fecha_presentacion', label: 'Fecha de presentación', kind: 'date', span: 3 }
    ]
  }
]

// one brought by the padrón has no number: it is named by its year
const numero = (d: Declaracion) => (d.numero_declaracion != null ? `DJ n° ${d.numero_declaracion}` : `DJ del padrón${d.anio != null ? ` (${d.anio})` : ''}`)

export function RectificarDeclaracion({ declaracion }: { declaracion: Declaracion }) {
  const [open, setOpen] = useState(false)
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  const navigate = useNavigate()
  const rectificar = async (values: Rectificacion) => {
    const nueva = await rentas.rectificarDeclaracion(declaracion.id!, {
      medio_presentacion: values.medio_presentacion ?? null,
      fecha_presentacion: values.fecha_presentacion ?? null
    })
    await refresh()
    setOpen(false)
    // the new one, in the wizard, to correct it tab by tab
    navigate(`/declaraciones/${nueva.declaracion.id}?tab=datos&asistente=1`)
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <FilePen className="size-4" />
        Rectificar
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-w-lg">
            <DialogTitle className="text-lg font-semibold">{`Rectificar la declaración jurada ${declaracion.numero_declaracion ?? ''}`.trim()}</DialogTitle>
            <DialogDescription className="mb-4 text-sm text-ink-muted">
              Se abre una declaración nueva, con su propio número y motivo RECTIFICACION, con lo que declara esta y sus listas, para corregirla. Esta queda
              SUSTITUIDA: se conserva en el historial, pero deja de contar en los totales, el impuesto y los arbitrios, y ya no se puede modificar. No se puede
              deshacer.
            </DialogDescription>
            <RecordForm
              sections={PRESENTACION}
              options={{ medio_presentacion: catalogos.data?.declaracion_predial?.medio_presentacion ?? ['FISICO'] }}
              initial={{ medio_presentacion: 'FISICO', fecha_presentacion: today() } as Rectificacion}
              submitLabel="Rectificar"
              onSubmit={rectificar}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

const enlace = 'font-medium text-link hover:underline'

// the predio's declaraciones of the year: where the rectificatoria and the one it replaces are (same predio and año)
function useDelAnio(declaracion: Declaracion) {
  return useDeclaracionesDePredio(declaracion.predio, declaracion.anio).data ?? []
}

// over the tabs of a sustituida: when, by which rectificatoria, and that it is only read
export function AvisoSustituida({ declaracion }: { declaracion: Declaracion }) {
  const rectificatoria = useDelAnio(declaracion).find((f) => f.declaracion.sustituye === declaracion.id)?.declaracion
  return (
    <div role="note" className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-ink">
      <p className="font-semibold">Declaración sustituida el {formatDate(declaracion.fecha_sustitucion)}</p>
      {rectificatoria && (
        <p className="mt-1">
          <Link to={`/declaraciones/${rectificatoria.id}`} className={enlace}>
            Sustituida por la {numero(rectificatoria)}
          </Link>
        </p>
      )}
      <p className="mt-1 text-xs text-ink-muted">No cuenta en los totales, el impuesto ni el condominio del predio; sus datos solo se consultan.</p>
    </div>
  )
}

// in the header of a rectificatoria: the declaración it replaces
export function EnlaceSustituye({ declaracion }: { declaracion: Declaracion }) {
  const anterior = useDelAnio(declaracion).find((f) => f.declaracion.id === declaracion.sustituye)?.declaracion
  if (!declaracion.sustituye) return null
  return (
    <Link to={`/declaraciones/${declaracion.sustituye}`} className={enlace}>
      Sustituye a la {anterior ? numero(anterior) : 'declaración anterior'}
    </Link>
  )
}
