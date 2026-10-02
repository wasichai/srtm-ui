import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { EmptyState, QueryState } from '@wasichai/core'
import { Table, Td, Th } from '@wasichai/ui'
import { Link } from 'react-router'
import { rentas } from '../api'
import { Alerta } from '../components/Alerta'
import { formatDate, formatMoney, MESES } from '../components/format'
import { NUMERICA } from '../components/tabla'
import type { MatrizArbitrios, PersonaArbitrio } from '../types'

// the arbitrios of a year as they were determined (wasichai/srtm-backend#62): servicio by month, the titular the rule
// charges each month, and the totals. every total is the backend's, never summed here; a figure carries the date it was
// determined on, and a month without a cuota says so instead of showing 0

const MES_CORTO = MESES.map((m) => m.slice(0, 3))

export function ArbitriosDelPredio({ id, anio }: { id: string; anio: number }) {
  const query = useQuery({ queryKey: ['arbitrios', 'predio', id, anio], queryFn: () => rentas.arbitriosDePredio(id, anio), placeholderData: keepPreviousData })
  return <QueryState query={query}>{(matriz) => <Matriz matriz={matriz} />}</QueryState>
}

// only the cuotas charged to the contribuyente, by predio
export function ArbitriosDelContribuyente({ id, anio }: { id: string; anio: number }) {
  const query = useQuery({
    queryKey: ['arbitrios', 'contribuyente', id, anio],
    queryFn: () => rentas.arbitriosDeContribuyente(id, anio),
    placeholderData: keepPreviousData
  })
  return (
    <QueryState query={query}>
      {(a) =>
        a.predios.length === 0 ? (
          <EmptyState title={`Sin arbitrios en ${anio}`}>
            <p>El contribuyente no declara predios en {anio}.</p>
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {a.predios.map((m) => (
              <section key={m.predio.id ?? m.predio.codigo} className="space-y-2" aria-label={`Predio ${m.predio.codigo ?? ''}`}>
                <h3 className="text-sm font-semibold">
                  {m.predio.id ? (
                    <Link to={`/predios/${m.predio.id}?tab=arbitrios`} className="text-link hover:underline">
                      {m.predio.codigo}
                    </Link>
                  ) : (
                    m.predio.codigo
                  )}
                  {m.predio.direccion && <span className="font-normal text-ink-muted"> · {m.predio.direccion}</span>}
                </h3>
                <Matriz matriz={m} titulares={false} />
              </section>
            ))}
            <p className="text-sm font-semibold" data-testid="total-arbitrios">
              Arbitrios de {anio} a su nombre: {formatMoney(a.total)}
              {a.fecha_calculo && <span className="font-normal text-ink-muted"> · determinados al {formatDate(a.fecha_calculo)}</span>}
            </p>
          </div>
        )
      }
    </QueryState>
  )
}

function Matriz({ matriz: m, titulares = true }: { matriz: MatrizArbitrios; titulares?: boolean }) {
  const determinadas = m.filas.some((f) => f.meses.some((c) => c !== null))
  return (
    <div className="space-y-3">
      <Situacion matriz={m} determinadas={determinadas} />
      {m.filas.length === 0 ? (
        <EmptyState title={`Sin servicios de arbitrio en ${m.anio}`}>
          <p>La ordenanza del año no tiene servicios cargados.</p>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label={`Arbitrios ${m.anio} del predio ${m.predio.codigo ?? ''}`}>
            <thead>
              <tr>
                <Th>Servicio</Th>
                {MES_CORTO.map((mes) => (
                  <Th key={mes} {...NUMERICA}>
                    {mes}
                  </Th>
                ))}
                <Th {...NUMERICA}>Total</Th>
              </tr>
            </thead>
            <tbody>
              {m.filas.map((f) => (
                <tr key={f.servicio.id}>
                  <Td>{f.servicio.nombre ?? f.servicio.codigo}</Td>
                  {f.meses.map((c, i) => (
                    <Td key={MES_CORTO[i]} {...NUMERICA}>
                      {c ? <span title={c.parametro_aplicado ?? undefined}>{formatMoney(c.monto)}</span> : <SinCuota />}
                    </Td>
                  ))}
                  <Td {...NUMERICA}>{determinadas ? formatMoney(f.total) : <SinCuota />}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <Td>Total {m.anio}</Td>
                {m.totales_por_mes.map((t, i) => (
                  <Td key={MES_CORTO[i]} {...NUMERICA}>
                    {determinadas ? formatMoney(t) : <SinCuota />}
                  </Td>
                ))}
                <Td {...NUMERICA}>{determinadas ? formatMoney(m.total) : <SinCuota />}</Td>
              </tr>
            </tfoot>
          </Table>
        </div>
      )}
      {titulares && <Titulares matriz={m} />}
    </div>
  )
}

const SinCuota = () => (
  <span className="text-ink-muted" title="Sin cuota determinada">
    —
  </span>
)

// when the figures were determined, what is still to determine, and what keeps it from being determined
function Situacion({ matriz: m, determinadas }: { matriz: MatrizArbitrios; determinadas: boolean }) {
  return (
    <div className="space-y-1 text-sm">
      {m.fecha_calculo && <p className="text-ink-muted">Determinados al {formatDate(m.fecha_calculo)}.</p>}
      {m.faltan.length > 0 ? (
        <Alerta tono="atencion" titulo="No se pueden determinar:">
          {m.faltan.join('; ')}.
        </Alerta>
      ) : m.pendientes > 0 ? (
        <Alerta tono="aviso">
          {determinadas
            ? `Faltan determinar ${m.pendientes} ${m.pendientes === 1 ? 'cuota' : 'cuotas'} de ${m.anio}.`
            : `Aún no se determinan los arbitrios de ${m.anio}: ${m.pendientes} ${m.pendientes === 1 ? 'cuota' : 'cuotas'} por determinar.`}
        </Alerta>
      ) : null}
    </div>
  )
}

// who the rule charges, month by month: the consecutive months of one titular together
function Titulares({ matriz: m }: { matriz: MatrizArbitrios }) {
  const tramos: { desde: number; hasta: number; titular: PersonaArbitrio | null }[] = []
  for (const { periodo, titular } of m.titulares) {
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && ultimo.titular?.id === titular?.id) ultimo.hasta = periodo
    else tramos.push({ desde: periodo, hasta: periodo, titular })
  }
  return (
    <ul className="space-y-0.5 text-sm" aria-label="Titular de cada mes">
      {tramos.map((t) => (
        <li key={t.desde}>
          <span className="text-ink-muted">
            {MES_CORTO[t.desde - 1]}
            {t.hasta !== t.desde && `–${MES_CORTO[t.hasta - 1]}`}:
          </span>{' '}
          {t.titular?.id ? (
            <Link to={`/contribuyentes/${t.titular.id}`} className="text-link hover:underline">
              {[t.titular.codigo, t.titular.nombre].filter(Boolean).join(' · ')}
            </Link>
          ) : (
            <span className="text-ink-muted">sin titular: ninguna declaración jurada cubre el mes</span>
          )}
        </li>
      ))}
    </ul>
  )
}
