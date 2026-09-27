import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { MapPin, MapPinCheck } from 'lucide-react'
import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { parseGeometry, type Geometry } from '../components/geo'
import { LotesMap } from '../components/LotesMap'
import type { FormValues } from './specs'

// the srtm's "buscar dirección" (pages 5-6): the domicilio's point, marked with a click on the map. it writes the
// form's hidden `ubicacion` (geojson)
export function UbicarDireccion({ form, descripcion }: { form: UseFormReturn<FormValues>; descripcion: string }) {
  const actual = parseGeometry(form.watch('ubicacion'))
  const [open, setOpen] = useState(false)
  const [punto, setPunto] = useState<Geometry | null>(actual)
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={actual ? 'secondary' : 'primary'}
        onClick={() => {
          setPunto(actual)
          setOpen(true)
        }}
      >
        {actual ? <MapPinCheck className="size-4" /> : <MapPin className="size-4" />}
        {actual ? 'Ubicado en el mapa' : 'Buscar dirección'}
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-w-4xl">
            <DialogTitle className="text-lg font-semibold uppercase">Ubicar el domicilio</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-ink-muted">{descripcion || 'Haz clic en el mapa donde está el domicilio.'}</DialogDescription>
            <div className="mt-4 space-y-4">
              <LotesMap className="h-96" label="Mapa del domicilio" point={{ value: punto, onChange: setPunto }} />
              <p className="text-xs text-ink-muted">Haz clic en el mapa donde está el domicilio; otro clic lo mueve.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!punto}
                  onClick={() => {
                    form.setValue('ubicacion', JSON.stringify(punto), { shouldDirty: true })
                    setOpen(false)
                  }}
                >
                  Aceptar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
