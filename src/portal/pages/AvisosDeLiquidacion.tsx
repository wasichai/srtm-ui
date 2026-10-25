import { useQuery } from '@tanstack/react-query'
import { Alert } from '@wasichai/ui'
import { Link } from 'react-router'
import { rentas } from '../api'
import { motivoLegible } from './AutoavaluoSugerido'

// the DJ of the year's liquidación whose autoavalúo is por revisar (srtm-backend#242): the impuesto, the HR and the
// emisión take the autoavalúo stored, maybe an old one, and the HR does not print it. the ficha del contribuyente says
// so, each with its predio and why, linking to the DJ where Recalcular is. nothing while there is none, nor when the
// liquidación cannot be read (the HR says what it lacks)
export function AvisosDeLiquidacion({ contribuyente, anio }: { contribuyente: string; anio: number }) {
  const liquidacion = useQuery({
    queryKey: ['contribuyente', contribuyente, 'liquidacion', anio],
    queryFn: () => rentas.liquidacion(contribuyente, anio),
    retry: false
  })
  const avisos = liquidacion.data?.avisos ?? []
  if (avisos.length === 0) return null
  const titulo = 'DJ por revisar en la liquidación'
  return (
    <section aria-label={titulo}>
      <Alert tone="warning" title={titulo}>
        <p>
          {avisos.length === 1
            ? `La liquidación de ${anio} usa el autoavalúo guardado de 1 DJ por revisar. Recalcúlala desde su declaración.`
            : `La liquidación de ${anio} usa el autoavalúo guardado de ${avisos.length} DJ por revisar. Recalcula cada una desde su declaración.`}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {avisos.map((a) => (
            <li key={a.declaracion}>
              <Link to={`/declaraciones/${a.declaracion}`} className="font-medium text-link hover:underline">
                {a.predioCodigo ? `Predio ${a.predioCodigo}` : 'Declaración'}
              </Link>
              : {motivoLegible(a.motivo) ?? a.motivo}
            </li>
          ))}
        </ul>
      </Alert>
    </section>
  )
}
