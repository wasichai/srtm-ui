import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Label, Textarea } from '@wasichai/ui'
import { Calculator, Loader2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { errorMessage } from '../../kit/ui/errorMessage'
import { rentas } from '../api'
import { Alerta } from '../components/Alerta'

// determining a year's arbitrios from a ficha (wasichai/srtm-backend#62): the cuotas still to determine are computed
// and written, the ones already there stay as they are, and none can be edited or deleted afterwards. the observación
// says why (5 to 500 characters, as the backend asks). without CREATE on cuota_arbitrio the action is disabled and says
// why. `avisos`: what the clerk should know first (cuotas that go to another titular)

const MINIMO = 5
const MAXIMO = 500

export function DeterminarArbitrios({ alcance, id, anio, avisos = [] }: { alcance: 'predio' | 'contribuyente'; id: string; anio: number; avisos?: string[] }) {
  const { permissions } = useAuth()
  const puede = Boolean(permissions?.admin || permissions?.objects?.cuota_arbitrio?.includes('CREATE'))
  const [abierto, setAbierto] = useState(false)
  const [observacion, setObservacion] = useState('')
  const campo = useId()
  const queryClient = useQueryClient()
  const determinar = useMutation({
    mutationFn: () =>
      alcance === 'predio'
        ? rentas.determinarArbitriosDePredio(id, anio, observacion.trim())
        : rentas.determinarArbitriosDeContribuyente(id, anio, observacion.trim()),
    // every ficha and list of arbitrios reads the same cuotas
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arbitrios'] })
  })
  const largo = observacion.trim().length
  const valida = largo >= MINIMO && largo <= MAXIMO
  const cerrar = () => {
    setAbierto(false)
    setObservacion('')
    determinar.reset()
  }
  const enviar = (event: FormEvent) => {
    event.preventDefault()
    if (valida) determinar.mutate()
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="secondary" disabled={!puede} onClick={() => setAbierto(true)}>
        <Calculator className="size-4" />
        Determinar arbitrios {anio}
      </Button>
      {!puede && <p className="text-xs text-ink-muted">Sin permiso: determinar pide creación sobre las cuotas de arbitrio.</p>}
      {abierto && (
        <Dialog open onOpenChange={(o) => !o && cerrar()}>
          <DialogContent className="max-w-lg">
            <DialogTitle className="text-lg font-semibold">Determinar los arbitrios de {anio}</DialogTitle>
            <DialogDescription className="mb-3 text-sm text-ink-muted">
              {alcance === 'predio'
                ? 'Se calculan las cuotas que falten del predio, mes a mes.'
                : 'Se calculan las cuotas que falten de cada predio que declara en el año: todos o ninguno.'}{' '}
              Las ya determinadas no cambian, y ninguna se puede editar ni borrar después.
            </DialogDescription>
            {avisos.map((aviso) => (
              <Alerta key={aviso} tono="aviso" className="mb-2">
                {aviso}
              </Alerta>
            ))}
            {determinar.isSuccess ? (
              <div className="space-y-3">
                <Alerta tono="exito">
                  {determinar.data.length === 0
                    ? 'No había cuotas pendientes: nada que determinar.'
                    : `Se determinaron ${determinar.data.length} ${determinar.data.length === 1 ? 'cuota' : 'cuotas'}.`}
                </Alerta>
                <div className="flex justify-end">
                  <Button onClick={cerrar}>Cerrar</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={enviar} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor={campo}>Observación</Label>
                  <Textarea id={campo} value={observacion} rows={3} maxLength={MAXIMO + 50} onChange={(e) => setObservacion(e.target.value)} />
                  <p className="text-xs text-ink-muted">
                    Por qué se determina: de {MINIMO} a {MAXIMO} caracteres ({largo}).
                  </p>
                </div>
                {determinar.isError && <Alerta tono="error">{errorMessage(determinar.error, 'No se pudo determinar')}</Alerta>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={cerrar}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={!valida || determinar.isPending}>
                    {determinar.isPending && <Loader2 className="size-4 animate-spin" />}
                    Determinar
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
