import { ApiError, EmptyState, LoadingState, QueryState } from '@wasichai/core'
import { Alert, Card, CardBody, CardHeader, CardTitle } from '@wasichai/ui'
import { ChevronRight, CircleCheck, CircleDashed, Coins, FileQuestion, Landmark, MapPinned, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router'
import { errorMessage } from '../../../kit/ui/errorMessage'
import { formatMoney } from '../../components/format'
import { StatCard } from '../../components/StatCard'
import { useCatalogoReportes, useResumenReportes } from '../../queries'
import type { DecisionBrecha, ReporteBrecha, ResumenReportes } from '../../types'
import { CATEGORIAS, CONFIANZAS } from '../BrechaPage'
import { formatInstante } from '../EmisionesPage'
import { Barras, colorDeSigno, formatM2, Histograma } from './Barras'
import { colorConfianza, DECISIONES, SelectorCorrida, useAnioYCorrida, usePermisoReportes } from './comun'

// the tablero of the reportes de brechas: the aggregates of a TERMINADA corrida as rentas reads them, and a card per
// report that opens its list. every figure is the backend's (srtm-backend#248), never computed here

const cifra = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('es-PE'))
const cuentaYDelta = (predios: number, delta: number | null) => `${cifra(predios)} · ${formatMoney(delta)}`
const noHay = (error: unknown) => error instanceof ApiError && error.status === 404

export function ReportesPage() {
  const { anio, corrida } = useAnioYCorrida()
  const { conPermisos, puedeLeer } = usePermisoReportes()
  const resumen = useResumenReportes(anio, corrida, puedeLeer)
  const catalogo = useCatalogoReportes(anio, corrida, puedeLeer)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Reportes de brechas</h1>
        <p className="text-sm text-ink-muted">
          Los predios subvaluados, sobrevaluados, omisos y demás de una corrida de la brecha, con sus listas exportables.
        </p>
      </div>

      <Card>
        <CardBody>
          <SelectorCorrida puedeLeer={puedeLeer} />
        </CardBody>
      </Card>

      {!conPermisos ? (
        <LoadingState />
      ) : !puedeLeer ? (
        <Alert tone="notice">Sin permiso para ver los reportes: pide lectura sobre las corridas de brecha.</Alert>
      ) : noHay(resumen.error) ? (
        <Card>
          <EmptyState title={`Aún no se ha calculado la brecha de ${anio}`}>
            <p>
              Calcúlala en la{' '}
              <Link to="/brecha" className="text-link hover:underline">
                brecha de recaudación
              </Link>
              : los reportes leen su último resultado.
            </p>
          </EmptyState>
        </Card>
      ) : resumen.isError ? (
        <Alert tone="danger">{errorMessage(resumen.error, 'No se pudo leer el resumen de los reportes')}</Alert>
      ) : (
        <QueryState query={resumen}>
          {(r) => (
            <div className="space-y-5">
              {r.avisos.length > 0 && (
                <section aria-label="Avisos">
                  <Alert tone="notice">
                    <ul className="space-y-1">
                      {r.avisos.map((aviso) => (
                        <li key={aviso}>{aviso}</li>
                      ))}
                    </ul>
                  </Alert>
                </section>
              )}
              <Corrida resumen={r} />
              <Kpis resumen={r} />
              <Reportes catalogo={catalogo.data} error={catalogo.error} />
              <Graficos resumen={r} />
              <div className="grid gap-5 xl:grid-cols-2">
                <Areas resumen={r} />
                <Decisiones decisiones={r.decisiones} />
              </div>
            </div>
          )}
        </QueryState>
      )}
    </div>
  )
}

function Corrida({ resumen }: { resumen: ResumenReportes }) {
  const { corrida } = resumen
  return (
    <section aria-label="Corrida" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
      <span className="font-medium text-ink">{`Corrida del ${formatInstante(corrida.terminado)}`}</span>
      {corrida.versionCatastro && <span>{`Catastro ${corrida.versionCatastro}`}</span>}
    </section>
  )
}

function Kpis({ resumen }: { resumen: ResumenReportes }) {
  const { kpis } = resumen
  const fecha = resumen.corrida.terminado ?? undefined
  return (
    <section aria-label="Indicadores de la brecha" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={MapPinned} label="Predios en catastro" value={cifra(kpis.prediosCatastro)} fecha={fecha} />
      <StatCard icon={Users} label="Predios en el padrón" value={cifra(kpis.prediosPadron)} fecha={fecha} />
      <StatCard icon={Coins} label="Δ impuesto predial" value={formatMoney(kpis.deltaImpuesto)} nota="Neto (subvaluados − sobrevaluados) + omisos estimados" />
      <StatCard icon={Landmark} label="Δ autoavalúo" value={formatMoney(kpis.deltaAutoavaluo)} nota="Predios comparados y omisos" />
      <StatCard icon={FileQuestion} label="Omisos" value={cifra(kpis.omisos)} nota="En catastro, sin declaración" />
      <StatCard icon={TrendingDown} label="Subvaluados" value={cifra(kpis.subvaluados)} nota="Declaran menos que el catastro" />
      <StatCard icon={TrendingUp} label="Sobrevaluados" value={cifra(kpis.sobrevaluados)} nota="Declaran más que el catastro" />
      {kpis.sinLevantar !== undefined ? (
        <StatCard icon={CircleDashed} label="Sin levantar" value={cifra(kpis.sinLevantar)} nota={CONFIANZAS.SIN_LEVANTAR.descripcion} />
      ) : (
        <StatCard icon={CircleCheck} label="Coinciden" value={cifra(kpis.coinciden)} nota="Diferencia de hasta 5 %" />
      )}
    </section>
  )
}

// a card per report: its count and Δ, its title opening its list of the same corrida
function Reportes({ catalogo, error }: { catalogo: ReporteBrecha[] | undefined; error: unknown }) {
  const { conservar } = useAnioYCorrida()
  return (
    <section aria-label="Reportes" className="space-y-3">
      <h2 className="text-base font-semibold text-ink">Reportes</h2>
      {error ? (
        <Alert tone="danger">{errorMessage(error, 'No se pudo leer la lista de reportes')}</Alert>
      ) : !catalogo ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {catalogo.map((reporte) => (
            <article key={reporte.clave} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
              <Link to={`/reportes/${reporte.clave}?${conservar}`} className="flex items-center justify-between gap-2 font-semibold text-link hover:underline">
                {reporte.titulo}
                <ChevronRight aria-hidden className="size-4 shrink-0" />
              </Link>
              <p className="text-xs text-ink-muted">{reporte.descripcion}</p>
              <p className="mt-auto pt-2 text-lg font-semibold text-ink tabular-nums">
                {`${cifra(reporte.predios)} ${reporte.clave === 'contribuyentes' ? 'contribuyentes' : reporte.predios === 1 ? 'predio' : 'predios'}`}
              </p>
              <p className="text-xs text-ink-muted tabular-nums">{`Δ impuesto ${formatMoney(reporte.deltaImpuesto)} · Δ autoavalúo ${formatMoney(reporte.deltaAutoavaluo)}`}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function Graficos({ resumen: r }: { resumen: ResumenReportes }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Barras
        titulo="Por categoría"
        testid="categoria"
        barras={r.porCategoria.map((c) => ({
          clave: c.categoria,
          etiqueta: CATEGORIAS[c.categoria]?.plural ?? c.categoria,
          valor: c.predios,
          texto: cuentaYDelta(c.predios, c.deltaImpuesto),
          color: CATEGORIAS[c.categoria]?.color ?? 'var(--ink-muted)'
        }))}
      />
      <Barras
        titulo="Por confianza"
        testid="confianza"
        barras={r.porConfianza.map((c) => ({
          clave: c.confianza,
          etiqueta: CONFIANZAS[c.confianza]?.nombre ?? c.confianza,
          valor: c.predios,
          texto: cuentaYDelta(c.predios, c.deltaImpuesto),
          color: colorConfianza(c.confianza)
        }))}
      />
      <Barras
        titulo="Por sector"
        testid="sector"
        barras={r.porSector.map((s, i) => ({
          clave: s.sector ?? `sin-${i}`,
          etiqueta: s.sector === null ? 'Sin sector' : `Sector ${s.sector}`,
          valor: s.deltaImpuesto ?? 0,
          texto: cuentaYDelta(s.predios, s.deltaImpuesto),
          color: colorDeSigno(s.deltaImpuesto)
        }))}
      />
      <Barras
        titulo="Por uso"
        testid="uso"
        barras={r.porUso.map((u, i) => ({
          clave: u.uso ?? `sin-${i}`,
          etiqueta: u.descripcion ?? u.uso ?? 'Sin uso',
          valor: u.deltaImpuesto ?? 0,
          texto: cuentaYDelta(u.predios, u.deltaImpuesto),
          color: colorDeSigno(u.deltaImpuesto)
        }))}
      />
      <Histograma titulo="Histograma de Δ autoavalúo" tramos={r.histogramaDeltaAutoavaluo} />
      <Barras
        titulo="Manzanas con más Δ impuesto"
        testid="manzana"
        barras={r.porManzana.map((m, i) => ({
          clave: `${m.sector ?? ''}-${m.manzana ?? ''}-${i}`,
          etiqueta: [m.sector, m.manzana].filter(Boolean).join('-') || 'Sin manzana',
          valor: m.deltaImpuesto ?? 0,
          texto: cuentaYDelta(m.predios, m.deltaImpuesto),
          color: colorDeSigno(m.deltaImpuesto)
        }))}
      />
    </div>
  )
}

// what the areas say: how many predios differ in terreno or niveles, and by how many m² (catastro − declarado)
function Areas({ resumen }: { resumen: ResumenReportes }) {
  const { areas } = resumen
  const filas: [string, string][] = [
    ['Terreno con diferencia', cifra(areas.terrenoConDiferencia)],
    ['Terreno catastral mayor', cifra(areas.terrenoCatastralMayor)],
    ['Niveles comparados', cifra(areas.nivelesComparados)],
    ['Predios con nivel mayor', cifra(areas.prediosConNivelMayor)],
    ['Δ m² de terreno', formatM2(areas.deltaM2Terreno)],
    ['Δ m² de niveles', formatM2(areas.deltaM2Niveles)]
  ]
  return (
    <section aria-label="Áreas">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Áreas</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {filas.map(([nombre, valor]) => (
              <div key={nombre} className="min-w-0">
                <dt className="text-xs text-ink-muted">{nombre}</dt>
                <dd className="text-lg font-semibold break-words text-ink tabular-nums">{valor}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </section>
  )
}

// catastro's decisions on the corrida's predios (it keeps them: srtm only reads); null when catastro could not be read
function Decisiones({ decisiones }: { decisiones: ResumenReportes['decisiones'] }) {
  return (
    <section aria-label="Decisiones de catastro">
      <Barras
        titulo="Decisiones de catastro"
        testid="decision"
        vacio={decisiones === null ? 'Sin datos de catastro.' : 'Ningún predio tiene decisión.'}
        barras={(Object.keys(DECISIONES) as DecisionBrecha[])
          .filter((estado) => decisiones?.[estado] !== undefined)
          .map((estado) => ({
            clave: estado,
            etiqueta: DECISIONES[estado].nombre,
            valor: decisiones![estado]!,
            texto: cifra(decisiones![estado]),
            color: DECISIONES[estado].color
          }))}
      />
    </section>
  )
}
