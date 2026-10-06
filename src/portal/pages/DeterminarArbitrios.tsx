import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button } from '@wasichai/ui'
import { Calculator } from 'lucide-react'
import { useState } from 'react'
import { rentas } from '../api'
import { DialogoDeActo } from '../components/DialogoDeActo'
import { usePuede } from '../components/permisos'

// determining a year's arbitrios from a ficha (wasichai/srtm-backend#62): the cuotas still to determine are computed
// and written, the ones already there stay as they are, and none can be edited or deleted afterwards. the observación
// says why (5 to 500 characters, as the backend asks). without CREATE on cuota_arbitrio the action is disabled and says
// why. `avisos`: what the clerk should know first (cuotas that go to another titular)

export function DeterminarArbitrios({ alcance, id, anio, avisos = [] }: { alcance: 'predio' | 'contribuyente'; id: string; anio: number; avisos?: string[] }) {
  const puede = usePuede('cuota_arbitrio')
  const [abierto, setAbierto] = useState(false)
  const queryClient = useQueryClient()

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="secondary" disabled={!puede} onClick={() => setAbierto(true)}>
        <Calculator className="size-4" />
        Determinar arbitrios {anio}
      </Button>
      {!puede && <p className="text-xs text-ink-muted">Sin permiso: determinar pide creación sobre las cuotas de arbitrio.</p>}
      {abierto && (
        <DialogoDeActo
          titulo={`Determinar los arbitrios de ${anio}`}
          descripcion={
            <>
              {alcance === 'predio'
                ? 'Se calculan las cuotas que falten del predio, mes a mes.'
                : 'Se calculan las cuotas que falten de cada predio que declara en el año: todos o ninguno.'}{' '}
              Las ya determinadas no cambian, y ninguna se puede editar ni borrar después.
            </>
          }
          avisos={avisos}
          porQue="Por qué se determina"
          accion="Determinar"
          siFalla="No se pudo determinar"
          enviar={(observacion) =>
            alcance === 'predio' ? rentas.determinarArbitriosDePredio(id, anio, observacion) : rentas.determinarArbitriosDeContribuyente(id, anio, observacion)
          }
          // every ficha and list of arbitrios reads the same cuotas
          onExito={() => queryClient.invalidateQueries({ queryKey: ['arbitrios'] })}
          exito={(cuotas) => (
            <Alert tone="success">
              {cuotas.length === 0
                ? 'No había cuotas pendientes: nada que determinar.'
                : `Se determinaron ${cuotas.length} ${cuotas.length === 1 ? 'cuota' : 'cuotas'}.`}
            </Alert>
          )}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </div>
  )
}
