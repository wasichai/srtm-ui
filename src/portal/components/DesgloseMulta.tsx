import { Table, Td, Th } from '@wasichai/ui'
import type { Desglose, GradoReincidencia } from '../types'
import { formatDate, formatMoney, formatNumber } from './format'
import { NUMERICA } from './tabla'

// the grade of reincidencia the inspector declares, in the acta's words
export const REINCIDENCIAS: Record<GradoReincidencia, string> = {
  PRIMERA: 'Primera vez',
  SEGUNDA: 'Segunda vez',
  TERCERA_O_MAS: 'Tercera o más'
}

export const porcentaje = (valor: number | null | undefined) => (valor === null || valor === undefined ? '—' : `${formatNumber(valor)} %`)

// an acta's multa as the backend computed and froze it on fecha_calculo: the UIT and the CUIS's % copied into the
// acta. every figure is the backend's, shown as it came: nothing here multiplies a base by a %. the importe con
// beneficio is empty until a rule gives one ("—", never a 0)
export function DesgloseMulta({ desglose, fecha, referencia }: { desglose: Desglose; fecha: string; referencia?: string }) {
  const al = formatDate(fecha)
  const filas: [string, string][] = [
    ['Base imponible (UIT)', formatMoney(desglose.base_imponible)],
    ['% de la infracción', porcentaje(desglose.porcentaje_infraccion)],
    ['Importe de la infracción', formatMoney(desglose.importe_infraccion)],
    ['% a cobrar', porcentaje(desglose.porcentaje_a_cobrar)],
    ['Importe a pagar', formatMoney(desglose.importe_a_pagar)],
    ['Con beneficio', formatMoney(desglose.importe_con_beneficio)],
    ['Fecha de cálculo', al]
  ]
  if (referencia) filas.push(['Referencia', referencia])
  return (
    <div className="space-y-2">
      <Table aria-label={`Desglose de la multa al ${al}`}>
        <thead>
          <tr>
            <Th>Concepto</Th>
            <Th {...NUMERICA}>Valor</Th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([concepto, valor]) => (
            <tr key={concepto}>
              <Td>{concepto}</Td>
              <Td {...NUMERICA}>{valor}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="text-xs text-ink-muted">Cifrada por el sistema al {al} y congelada en el acta: no se recalcula.</p>
    </div>
  )
}
