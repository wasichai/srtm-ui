import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { useState } from 'react'
import { rentas } from '../api'
import { currentYear } from '../components/format'
import { useCatalogos, useRefresh } from '../queries'
import type { Contribuyente, Declaracion, Predio } from '../types'
import { RecordForm } from './RecordForm'
import { RecordPicker, type Picked } from './RecordPicker'
import { DECLARACION_SECTIONS, emptyOf } from './specs'

export type Side = 'contribuyente' | 'predio'

interface DeclaracionDialogProps {
  // the ficha the dialog opens from: that side is fixed, the other one is picked
  side: Side
  sideId: string
  // null: a new declaration
  declaracion: Declaracion | null
  // the other side's label when editing
  otherLabel?: string
  onClose: () => void
}

export const describeContribuyente = (c: Contribuyente): Picked => ({ id: c.id!, label: `${c.numero_documento ?? 's/d'} · ${c.nombre_completo ?? ''}` })
export const describePredio = (p: Predio): Picked => ({ id: p.id!, label: `${p.codigo ?? ''} · ${p.direccion ?? ''}` })

export function DeclaracionDialog({ side, sideId, declaracion, otherLabel, onClose }: DeclaracionDialogProps) {
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  const other: Side = side === 'contribuyente' ? 'predio' : 'contribuyente'
  const initial = declaracion ?? emptyOf<Declaracion>(DECLARACION_SECTIONS, { [side]: sideId, anio: currentYear(), secuencia_uso: '1' })
  const [picked, setPicked] = useState<Picked | null>(initial[other] ? { id: initial[other]!, label: otherLabel ?? '' } : null)
  const [pickError, setPickError] = useState<string | undefined>()

  const save = async (values: Declaracion) => {
    if (!picked) {
      setPickError('Elige un registro')
      throw new Error(other === 'predio' ? 'Falta elegir el predio' : 'Falta elegir el contribuyente')
    }
    const body = { ...values, [side]: sideId, [other]: picked.id }
    if (declaracion?.id) await rentas.actualizarDeclaracion(declaracion.id, body)
    else await rentas.crearDeclaracion(body)
    await refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold">{declaracion ? 'Editar declaración' : 'Nueva declaración'}</DialogTitle>
        <DialogDescription className="mb-5 text-sm text-ink-muted">Declaración jurada del impuesto predial.</DialogDescription>
        <RecordForm
          sections={DECLARACION_SECTIONS}
          options={catalogos.data?.declaracion_predial}
          initial={initial}
          submitLabel={declaracion ? 'Guardar cambios' : 'Registrar declaración'}
          onSubmit={save}
          onCancel={onClose}
        >
          {other === 'predio' ? (
            <RecordPicker
              label="Predio"
              placeholder="Código o dirección del predio"
              value={picked}
              onChange={(p) => {
                setPicked(p)
                setPickError(undefined)
              }}
              search={(q) => rentas.predios(q, 0, 8)}
              describe={describePredio}
              error={pickError}
            />
          ) : (
            <RecordPicker
              label="Contribuyente"
              placeholder="DNI, RUC o nombre"
              value={picked}
              onChange={(p) => {
                setPicked(p)
                setPickError(undefined)
              }}
              search={(q) => rentas.contribuyentes(q, 0, 8)}
              describe={describeContribuyente}
              error={pickError}
            />
          )}
        </RecordForm>
      </DialogContent>
    </Dialog>
  )
}
