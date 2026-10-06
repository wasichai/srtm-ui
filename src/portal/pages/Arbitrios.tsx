import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { EmptyState, QueryState } from '@wasichai/core'
import { Alert, Table, Td, Th } from '@wasichai/ui'
import { Link } from 'react-router'
import { rentas } from '../api'
import { formatDate, formatMoney, MESES } from '../components/format'
import { Popover } from '../components/Popover'
import { NUMERICA } from '../components/tabla'
import type { ArbitriosContribuyente, CuotaMes, MatrizArbitrios, PersonaArbitrio } from '../types'
import { DeterminarArbitrios } from './DeterminarArbitrios'

// the arbitrios of a year as they were determined (wasichai/srtm-backend#62): servicio by month, the titular the rule
// charges each month, and the totals. every total is the backend's, never summed here; a figure carries the date it was
// determined on, and a month without a cuota says so instead of showing 0

const MES_CORTO = MESES.map((m) => m.slice(0, 3))

export function ArbitriosDelPredio({ id, anio }: { id: string; anio: number }) {
  const query = useQuery({ queryKey: ['arbitrios', 'predio', id, anio], queryFn: () => rentas.arbitriosDePredio(id, anio), placeholderData: keepPreviousData })
  return (
    <QueryState query={query}>
      {(matriz) => (
        <div className="space-y-4">
          <DeterminarArbitrios alcance="predio" id={id} anio={anio} />
          <Matriz matriz={matriz} />
        </div>
      )}
    </QueryState>
  )
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
            <DeterminarArbitrios alcance="contribuyente" id={id} anio={anio} avisos={avisosDeOtrosTitulares(a)} />
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
                      {c ? <Monto cuota={c} /> : <SinCuota />}
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

// a cuota's monto: with its desglose (one secuencia de uso per item), a popover with each one's formula; without it
// (a cuota from before the épica de arbitrios), the plain monto with its parámetro, as before
function Monto({ cuota }: { cuota: CuotaMes }) {
  if (!cuota.desglose || cuota.desglose.length === 0) {
    return <span title={cuota.parametro_aplicado ?? undefined}>{formatMoney(cuota.monto)}</span>
  }
  return (
    <Popover trigger={formatMoney(cuota.monto)}>
      <ul className="space-y-1">
        {cuota.desglose.map((d, i) => (
          <li key={d.id ?? `${d.secuencia_uso ?? ''}-${i}`}>{d.formula}</li>
        ))}
      </ul>
    </Popover>
  )
}

// when the figures were determined, what is still to determine, and what keeps it from being determined
function Situacion({ matriz: m, determinadas }: { matriz: MatrizArbitrios; determinadas: boolean }) {
  return (
    <div className="space-y-1 text-sm">
      {m.fecha_calculo && <p className="text-ink-muted">Determinados al {formatDate(m.fecha_calculo)}.</p>}
      {m.faltan.length > 0 ? (
        <Alert tone="warning" title="No se pueden determinar:">
          {m.faltan.join('; ')}.
        </Alert>
      ) : m.pendientes > 0 ? (
        <Alert tone="notice">
          {determinadas
            ? `Faltan determinar ${m.pendientes} ${m.pendientes === 1 ? 'cuota' : 'cuotas'} de ${m.anio}.`
            : `Aún no se determinan los arbitrios de ${m.anio}: ${m.pendientes} ${m.pendientes === 1 ? 'cuota' : 'cuotas'} por determinar.`}
        </Alert>
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

// the months of each predio the rule charges to someone else: determining from this ficha writes them too, in their name
export function avisosDeOtrosTitulares(a: ArbitriosContribuyente): string[] {
  return a.predios.flatMap((m) => {
    const ajenos = new Map<string, { titular: PersonaArbitrio; meses: number[] }>()
    for (const { periodo, titular } of m.titulares) {
      if (!titular?.id || titular.id === a.contribuyente.id) continue
      const grupo = ajenos.get(titular.id) ?? { titular, meses: [] }
      grupo.meses.push(periodo)
      ajenos.set(titular.id, grupo)
    }
    return [...ajenos.values()].map(
      ({ titular, meses }) =>
        `Las cuotas del predio ${m.predio.codigo ?? ''} de ${rango(meses)} quedarán a nombre de ${[titular.codigo, titular.nombre].filter(Boolean).join(' · ')}: es su titular principal.`
    )
  })
}

// consecutive months as ENE–MAY, the rest one by one
function rango(meses: number[]): string {
  const tramos: [number, number][] = []
  for (const m of meses) {
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && ultimo[1] === m - 1) ultimo[1] = m
    else tramos.push([m, m])
  }
  return tramos.map(([desde, hasta]) => (desde === hasta ? MES_CORTO[desde - 1] : `${MES_CORTO[desde - 1]}–${MES_CORTO[hasta - 1]}`)).join(', ')
}
