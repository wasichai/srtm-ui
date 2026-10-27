import { Card, CardBody, CardHeader, CardTitle } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { formatMoney } from '../../components/format'
import type { TramoHistograma } from '../../types'

// m² with two decimals, as catastro writes them
const M2 = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatM2 = (n: number | null | undefined) => (n === null || n === undefined ? '—' : M2.format(n))

export interface Barra {
  clave: string
  etiqueta: string
  // what sets the length of the bar: its absolute value against the longest one's
  valor: number
  texto: string
  color: string
}

// a bar per entry, as long as its share of the longest: plain css, no chart library (catastro-ui's Barras). the list is
// named by the title, each bar's label and figure read as its text
export function Barras({ titulo, barras, testid, vacio = 'Sin datos.' }: { titulo: string; barras: Barra[]; testid: string; vacio?: ReactNode }) {
  const maximo = Math.max(0, ...barras.map((b) => Math.abs(b.valor)))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardBody>
        {barras.length === 0 ? (
          <p className="text-sm text-ink-muted">{vacio}</p>
        ) : (
          // one grid for every bar, each row a subgrid of it: the tracks start and end at the same x. on a phone the
          // bar goes under its label and figure, the whole width
          <ul aria-label={titulo} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] sm:gap-y-2">
            {barras.map((b) => (
              <li key={b.clave} className="col-span-2 grid grid-cols-subgrid items-center gap-y-1 text-xs sm:col-span-3">
                <span className="col-start-1 row-start-1 truncate text-ink" title={b.etiqueta}>
                  {b.etiqueta}
                </span>
                <span aria-hidden className="col-span-2 row-start-2 h-2.5 rounded-sm bg-surface-muted sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  <span
                    data-testid={`barra-${testid}-${b.clave}`}
                    className="block h-full rounded-sm"
                    style={{ width: `${maximo ? (Math.abs(b.valor) / maximo) * 100 : 0}%`, background: b.color }}
                  />
                </span>
                <span className="col-start-2 row-start-1 text-right text-ink-muted tabular-nums sm:col-start-3">{b.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

// the side of a Δ: red where catastro would charge more, the brand's colour where less (catastro-ui's diverging sides,
// in the theme's tokens), the muted ink for none
export const colorDeSigno = (n: number | null | undefined) => (!n ? 'var(--ink-muted)' : n > 0 ? 'var(--danger)' : 'var(--brand)')

const tramo = ({ desde, hasta }: TramoHistograma) =>
  desde === null ? `Menos de ${formatMoney(hasta)}` : hasta === null ? `${formatMoney(desde)} o más` : `${formatMoney(desde)} a ${formatMoney(hasta)}`

// the predios by their Δ autoavalúo, in the backend's tramos: a column per tramo, as tall as its share of the tallest,
// coloured by its side of 0. svg-free: flex columns, each named for a screen reader
export function Histograma({ titulo, tramos }: { titulo: string; tramos: TramoHistograma[] }) {
  const maximo = Math.max(0, ...tramos.map((t) => t.predios))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardBody>
        {tramos.length === 0 ? (
          <p className="text-sm text-ink-muted">Sin datos.</p>
        ) : (
          <ul aria-label={titulo} className="flex h-48 items-end gap-1 border-b border-border">
            {tramos.map((t) => {
              const etiqueta = tramo(t)
              // a tramo that holds 0 (or is open below it) takes the side its middle is on
              const medio = t.desde === null ? (t.hasta ?? 0) - 1 : t.hasta === null ? t.desde + 1 : (t.desde + t.hasta) / 2
              return (
                <li
                  key={`${t.desde}-${t.hasta}`}
                  aria-label={`${etiqueta}: ${t.predios.toLocaleString('es-PE')} ${t.predios === 1 ? 'predio' : 'predios'}`}
                  title={`${etiqueta}: ${t.predios.toLocaleString('es-PE')}`}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                >
                  <span aria-hidden className="mb-1 text-center text-[10px] text-ink-muted tabular-nums">
                    {t.predios.toLocaleString('es-PE')}
                  </span>
                  <span
                    aria-hidden
                    className="block rounded-t-sm"
                    style={{ height: `${maximo ? (t.predios / maximo) * 85 : 0}%`, background: colorDeSigno(medio) }}
                  />
                </li>
              )
            })}
          </ul>
        )}
        {tramos.length > 0 && (
          <div aria-hidden className="mt-1 flex justify-between gap-2 text-[10px] text-ink-muted tabular-nums">
            <span>{tramo(tramos[0])}</span>
            <span className="text-right">{tramo(tramos[tramos.length - 1])}</span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
