import { LockOpen, Search } from 'lucide-react'
import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@wasichai/ui'
import { lockedIn, unlock } from '../../kit/forms/locked'
import type { FormValues } from '../../kit/forms/spec'
import { BuscarPrediosDialog } from '../pages/BuscarPrediosDialog'
import { llenarUbicacion, type Elegido } from './ubicacion'

// "buscar predios" on the ubicación's heading (page 14). what is picked fills the form; a caller that treats a
// predio of the padrón differently (the declaración's wizard: it becomes the declaration's predio) passes onPredio.
// what a lote filled stays greyed until "desbloquear"
export function BuscarPrediosButton({ form, onPredio }: { form: UseFormReturn<FormValues>; onPredio?: (elegido: Elegido) => boolean }) {
  const [open, setOpen] = useState(false)
  const bloqueados = lockedIn(form)
  return (
    <>
      {bloqueados.length > 0 && (
        <Button type="button" variant="secondary" size="sm" className="mr-2" onClick={() => unlock(form)}>
          <LockOpen className="size-4 text-brand" />
          Desbloquear
        </Button>
      )}
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Search className="size-4 text-brand" />
        Buscar predios
      </Button>
      {open && (
        <BuscarPrediosDialog
          lotesAparte
          onClose={() => setOpen(false)}
          onPick={async (elegido) => {
            if (onPredio?.(elegido)) return
            await llenarUbicacion(form, elegido)
          }}
        />
      )}
    </>
  )
}
