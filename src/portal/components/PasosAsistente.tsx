import { Card } from '@wasichai/ui'
import { useVarianteTema } from '../../themes'
import { BarraInstruccion } from './BarraInstruccion'
import { PasosGalon, type Paso } from './PasosGalon'

// a wizard's tabs as steps, with the portal-tributario variant: the chevrons, and under them what the current step
// asks for. the tabs stay and both follow the page's own state: the current step is the open tab, and a step goes
// where its tab goes, when its tab can be opened. on a card: the prototype draws them on its white column, and the
// page here is surface-muted, the bar's own grey. the classic variant draws nothing
export function PasosAsistente<T extends string>({
  pasos,
  actual,
  onIr,
  puedeIr,
  instruccion
}: {
  pasos: readonly Paso<T>[]
  actual: T
  onIr?: (id: T) => void
  puedeIr?: (id: T) => boolean
  instruccion: string
}) {
  const variante = useVarianteTema()
  if (variante !== 'portal') return null
  const numero = pasos.findIndex((p) => p.id === actual) + 1
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-4.5 py-2.5">
        <PasosGalon pasos={pasos} actual={actual} onIr={onIr} puedeIr={puedeIr} />
      </div>
      {/* the card's edge is the bar's line */}
      <BarraInstruccion paso={`Paso ${numero}:`} className="border-b-0">
        {instruccion}
      </BarraInstruccion>
    </Card>
  )
}
