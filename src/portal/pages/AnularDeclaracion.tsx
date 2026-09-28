import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { Ban } from 'lucide-react'
import { useState } from 'react'
import { rentas } from '../api'
import { formatDate } from '../components/format'
import { RecordForm } from '../forms/RecordForm'
import type { SectionSpec } from '../forms/specs'
import { useRefresh } from '../queries'
import type { Declaracion } from '../types'

// the srtm's descargo of a declaración jurada (srtm-backend#7): it stays in the history, read-only, and counts in no
// totals and no condominio. no way back: the dialog asks why and is the confirmation

const MOTIVO: SectionSpec[] = [
  { title: 'Anulación', fields: [{ name: 'motivo_anulacion', label: 'Motivo de la anulación', kind: 'longtext', required: true, span: 6 }] }
]

export function AnularDeclaracion({ declaracion }: { declaracion: Declaracion }) {
  const [open, setOpen] = useState(false)
  const refresh = useRefresh()
  const anular = async (values: Declaracion) => {
    await rentas.anularDeclaracion(declaracion.id!, values.motivo_anulacion ?? null)
    await refresh()
    setOpen(false)
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Ban className="size-4 text-danger" />
        Anular declaración
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-w-lg">
            <DialogTitle className="text-lg font-semibold">{`Anular la declaración jurada ${declaracion.numero_declaracion ?? ''}`.trim()}</DialogTitle>
            <DialogDescription className="mb-4 text-sm text-ink-muted">
              Queda ANULADA, con motivo DESCARGO: se conserva en el historial, pero deja de contar en los totales y en el condominio, y ya no se puede
              modificar. No se puede deshacer.
            </DialogDescription>
            <RecordForm
              sections={MOTIVO}
              initial={{ motivo_anulacion: null } as Declaracion}
              submitLabel="Anular"
              onSubmit={anular}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// over the tabs of an annulled declaración: when, why, and that it is only read
export function AvisoAnulada({ declaracion }: { declaracion: Declaracion }) {
  return (
    <div role="note" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      <p className="font-semibold">Declaración anulada el {formatDate(declaracion.fecha_anulacion)}</p>
      {declaracion.motivo_anulacion && <p className="mt-1 whitespace-pre-line">{declaracion.motivo_anulacion}</p>}
      <p className="mt-1 text-xs">No cuenta en los totales ni en el condominio del predio; sus datos solo se consultan.</p>
    </div>
  )
}
