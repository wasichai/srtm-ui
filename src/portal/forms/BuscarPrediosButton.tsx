import { Button } from '@wasichai/ui'
import { Search } from 'lucide-react'
import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { BuscarPrediosDialog } from '../pages/BuscarPrediosDialog'
import type { FormValues } from './specs'
import { llenarUbicacion, type Elegido } from './ubicacion'

// "buscar predios" on the ubicación's heading (page 14). what is picked fills the form; a caller that treats a
// predio of the padrón differently (the declaración's wizard: it becomes the declaration's predio) passes onPredio
export function BuscarPrediosButton({ form, onPredio }: { form: UseFormReturn<FormValues>; onPredio?: (elegido: Elegido) => boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Search className="size-4 text-brand" />
        Buscar predios
      </Button>
      {open && (
        <BuscarPrediosDialog
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
