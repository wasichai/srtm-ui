import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, EmptyState, LoadingState, QueryState, useAuth } from '@wasichai/core'
import { Alert, Badge, Button, Card, CardBody, CardHeader, CardTitle, cn, Pagination, Table, Td, Th } from '@wasichai/ui'
import {
  Calculator,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  Coins,
  FileQuestion,
  History,
  Landmark,
  Loader2,
  Map as MapIcon,
  MapPinned,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  X
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../kit/ui/errorMessage'
import { rentas } from '../api'
import type { ColorPor } from '../components/colorDeLotes'
import { currentYear, formatMoney, formatText } from '../components/format'
import { LotesMap } from '../components/LotesMap'
import { usePuede } from '../components/permisos'
import { StatCard } from '../components/StatCard'
import { NUMERICA } from '../components/tabla'
import type { Tono } from '../components/tono'
import { YearSelect } from '../components/YearSelect'
import { clavesBrecha, corridaActiva, useCorridasBrecha, useLotesBrecha, usePanelBrecha, usePrediosBrecha } from '../queries'
import type { CategoriaBrecha, Confianza, CorridaBrecha, EstadoCorridaBrecha, FiltrosBrecha, OrigenCorrida, PanelBrecha } from '../types'
import { formatInstante, PILDORA } from './EmisionesPage'

// the brecha de recaudación of a year: what the padrón declares against what catastro values for the same predios.
// a corrida is launched here and run by srtm-backend in the background (its list is asked again every 2 s while one
// runs); the panel, the predios and the map read the year's latest TERMINADA one, all of the same corrida. every
// figure is the backend's, never computed here

// the categorías in the order the panel lists them, with the theme's status colours: the legend and the map's lotes
// use the same var(), so both follow the active theme (light, dark, portal-tributario). the two that are not compared
// (no catastro, no value) are greys, the ink darker than the muted one. no token of the themes is left that differs
// from those six in all three (notice is warning's hue, shell is the ink, shell-muted the muted ink in dark,
// map-selected the map's selection), so the fichas sin levantar take a mix of two of them: brand and danger, halfway
// in oklch, a violet in every theme
export const CATEGORIAS: Record<CategoriaBrecha, { plural: string; singular: string; color: string }> = {
  OMISO: { plural: 'Omisos', singular: 'Omiso', color: 'var(--danger)' },
  SIN_CATASTRO: { plural: 'Sin catastro', singular: 'Sin catastro', color: 'var(--ink-muted)' },
  SIN_VALOR: { plural: 'Sin valor', singular: 'Sin valor', color: 'var(--ink)' },
  SUBVALUADO: { plural: 'Subvaluados', singular: 'Subvaluado', color: 'var(--warning)' },
  SOBREVALUADO: { plural: 'Sobrevaluados', singular: 'Sobrevaluado', color: 'var(--brand)' },
  COINCIDE: { plural: 'Coinciden', singular: 'Coincide', color: 'var(--success)' },
  SIN_LEVANTAR: { plural: 'Sin levantar', singular: 'Sin levantar', color: 'color-mix(in oklch, var(--brand), var(--danger))' }
}

// the confianzas in the backend's order, with what each means and its tone. the confiable one is the brecha that can
// be defended: the panel puts it first and highlights it
export const CONFIANZAS: Record<Confianza, { nombre: string; descripcion: string; tono: Tono }> = {
  CONFIABLE: { nombre: 'Confiable', descripcion: 'Vínculo por código de rentas, manual revisado o titular coincidente', tono: 'verde' },
  DUDOSO: { nombre: 'Dudoso', descripcion: 'Sin vínculo confirmado', tono: 'ambar' },
  SIN_LEVANTAR: { nombre: 'Sin levantar', descripcion: 'Ficha del catastro sin levantamiento', tono: '' }
}

// a corrida started on its own says so; a manual one (or one from before the field) says nothing
const ORIGENES: Partial<Record<OrigenCorrida, string>> = { CAMBIOS: 'Automática (cambios del catastro)', SEMANAL: 'Automática (semanal)' }

const COLOR_POR: ColorPor = {
  propiedad: 'categoria',
  colores: Object.fromEntries(Object.entries(CATEGORIAS).map(([categoria, { color }]) => [categoria, color]))
}

const ESTADOS: Record<EstadoCorridaBrecha, string> = { PENDIENTE: 'Pendiente', EN_CURSO: 'En curso', TERMINADA: 'Terminada', FALLIDA: 'Fallida' }
const TONOS: Record<EstadoCorridaBrecha, Tono> = { PENDIENTE: 'ambar', EN_CURSO: 'ambar', TERMINADA: 'verde', FALLIDA: 'rojo' }

// sector-manzana-lote, as far as the row has them
const ubicacion = ({ sector, manzana, lote }: { sector: string | null; manzana: string | null; lote: string | null }) =>
  [sector, manzana, lote].filter(Boolean).join('-') || '—'
const cifra = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('es-PE'))
const conEstado = (error: unknown, status: number) => error instanceof ApiError && error.status === status

// the POST's 409 has two meanings (catastro not configured, a corrida of the year running): the backend's detail says which
function errorAlCalcular(error: unknown) {
  if (conEstado(error, 409)) return errorMessage(error, 'Ya hay una corrida de la brecha en curso')
  if (conEstado(error, 403)) return 'No tiene permiso para calcular la brecha'
  return errorMessage(error, 'No se pudo calcular la brecha')
}

export function BrechaPage() {
  const queryClient = useQueryClient()
  const [anio, setAnio] = useState(currentYear)
  // the permissions come after the session: until then neither "sin permiso" nor a request (a failure to read them
  // counts as read: none)
  const auth = useAuth()
  const conPermisos = auth.permissions !== null || auth.permissionsError !== null
  const puedeLeer = usePuede('brecha_corrida', 'READ')
  // what the corrida writes: itself and its rows (the backend refuses the rest with a 403)
  const crear = usePuede('brecha_corrida', 'CREATE')
  const editar = usePuede('brecha_corrida', 'UPDATE')
  const crearFilas = usePuede('brecha_predio', 'CREATE')
  const puedeCalcular = crear && editar && crearFilas
  const corridas = useCorridasBrecha(anio, puedeLeer)
  const ultima = corridas.data?.[0]
  const terminada = corridas.data?.find((c) => c.estado === 'TERMINADA')
  const activa = corridaActiva(ultima)

  const calcular = useMutation({
    mutationFn: () => rentas.calcularBrecha(anio),
    onSuccess: async (corrida) => {
      // the new corrida at once, then the backend's list (which starts the polling)
      queryClient.setQueryData<CorridaBrecha[]>(clavesBrecha.corridas(anio), (actuales = []) => [corrida, ...actuales.filter((c) => c.id !== corrida.id)])
      await queryClient.invalidateQueries({ queryKey: clavesBrecha.corridas(anio) })
    }
  })
  const enviar = (event: FormEvent) => {
    event.preventDefault()
    calcular.mutate()
  }
  const elegirAnio = (valor: number) => {
    setAnio(valor)
    calcular.reset()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Brecha de recaudación</h1>
          <p className="text-sm text-ink-muted">
            El autoavalúo y el impuesto declarados en el padrón frente a la valorización del catastro de los mismos predios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* fiscalización's work list: the predios catastro changed, against this brecha */}
          <Button asChild variant="secondary">
            <Link to="/brecha/cambios">
              <History className="size-4" />
              Cambios en catastro
            </Link>
          </Button>
          {/* the corrida on the map, with catastro's decisions (read only): for who may read it, as its menu entry */}
          {puedeLeer && (
            <Button asChild variant="secondary">
              <Link to="/brecha/visor">
                <MapIcon className="size-4" />
                Visor de brechas
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={enviar} className="flex flex-wrap items-end gap-6">
            <YearSelect value={anio} onChange={elegirAnio} />
            <Button type="submit" disabled={!puedeCalcular || activa || calcular.isPending}>
              {calcular.isPending ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
              Calcular brecha
            </Button>
          </form>
          {conPermisos && !puedeCalcular && (
            <p className="mt-2 text-xs text-ink-muted">Sin permiso: pide creación y edición sobre las corridas de brecha, y creación sobre sus predios.</p>
          )}
          {calcular.isError && (
            <Alert tone="danger" className="mt-3">
              {errorAlCalcular(calcular.error)}
            </Alert>
          )}
          {ultima && <EstadoCorrida corrida={ultima} />}
        </CardBody>
      </Card>

      {!conPermisos ? (
        <LoadingState />
      ) : !puedeLeer ? (
        <Alert tone="notice">Sin permiso para ver la brecha: pide lectura sobre las corridas de brecha.</Alert>
      ) : (
        <QueryState query={corridas}>
          {() =>
            terminada ? (
              // a new corrida (or year) starts its results afresh: no filter or page of the previous one
              <Resultados key={`${anio}-${terminada.id}`} anio={anio} corrida={terminada} />
            ) : (
              <Card>
                <EmptyState title={`Aún no se ha calculado la brecha de ${anio}`}>
                  <p>Calcúlala con el botón de arriba: el resultado aparece aquí al terminar.</p>
                </EmptyState>
              </Card>
            )
          }
        </QueryState>
      )}
    </div>
  )
}

// the year's latest corrida: its estado and progress while it runs, why it failed, or what it could not compute
function EstadoCorrida({ corrida }: { corrida: CorridaBrecha }) {
  const { estado, anio } = corrida
  const total = corrida.totalPredios ?? 0
  const procesados = corrida.procesados ?? 0
  const tono = TONOS[estado] ?? ''
  // totalPredios is 0 until catastro and the padrón are crossed: until then no figure, a pulsing bar
  const midiendo = corridaActiva(corrida) && total === 0
  const porcentaje = total > 0 ? Math.min(100, Math.round((procesados / total) * 100)) : 0
  return (
    <section aria-label="Última corrida" className="mt-4 space-y-2 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        <span className="font-medium text-ink">Última corrida</span>
        <Badge data-tono={tono} className={PILDORA[tono]}>
          {ESTADOS[estado] ?? estado}
        </Badge>
        <span>Iniciada {formatInstante(corrida.iniciado)}</span>
        {corrida.terminado && <span>Terminada {formatInstante(corrida.terminado)}</span>}
        {corrida.versionCatastro && <span>Catastro {corrida.versionCatastro}</span>}
        {corrida.origen && ORIGENES[corrida.origen] && <span>{ORIGENES[corrida.origen]}</span>}
      </div>
      {estado !== 'TERMINADA' && (
        <div className="max-w-md space-y-1">
          <div
            role="progressbar"
            aria-label={`Progreso de la brecha ${anio}`}
            aria-valuemin={0}
            aria-valuemax={midiendo ? undefined : total}
            aria-valuenow={midiendo ? undefined : procesados}
            className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          >
            <div
              className={cn('h-full rounded-full transition-[width]', estado === 'FALLIDA' ? 'bg-danger' : 'bg-brand', midiendo && 'w-full animate-pulse')}
              style={midiendo ? undefined : { width: `${porcentaje}%` }}
            />
          </div>
          <p className="text-xs text-ink-muted tabular-nums">{midiendo ? 'Cruzando el padrón con el catastro…' : `${procesados}/${total} predios`}</p>
        </div>
      )}
      {estado === 'FALLIDA' && <p className="text-sm text-danger">{formatText(corrida.mensaje)}</p>}
      {estado === 'TERMINADA' && corrida.mensaje && <Alert tone="notice">{corrida.mensaje}</Alert>}
    </section>
  )
}

function Resultados({ anio, corrida }: { anio: number; corrida: CorridaBrecha }) {
  const panel = usePanelBrecha(anio, corrida.id)
  const [filtros, setFiltros] = useState<FiltrosBrecha>({})
  const [page, setPage] = useState(0)
  const filtrar = (cambio: FiltrosBrecha) => {
    setFiltros((actuales) => ({ ...actuales, ...cambio }))
    setPage(0)
  }
  return (
    <QueryState query={panel}>
      {(p) => (
        <div className="space-y-5">
          <Kpis panel={p} mensaje={corrida.mensaje} />
          {p.porConfianza && <PorConfianza porConfianza={p.porConfianza} activa={filtros.confianza ?? null} onElegir={(confianza) => filtrar({ confianza })} />}
          <div className="grid gap-5 xl:grid-cols-2">
            <PorCategoria panel={p} activa={filtros.categoria ?? null} onElegir={(categoria) => filtrar({ categoria })} />
            <PorSector panel={p} activo={filtros.sector ?? null} onElegir={(sector) => filtrar({ sector })} />
          </div>
          <Mapa anio={anio} corrida={corrida.id} />
          <Predios anio={anio} corrida={corrida.id} filtros={filtros} page={page} onPage={setPage} onFiltrar={filtrar} />
        </div>
      )}
    </QueryState>
  )
}

// the figures of the corrida, at the day it ended. Δ arbitrios is null when no predio has one: the corrida's mensaje
// says why (no ordinance for the year), never a 0
function Kpis({ panel, mensaje }: { panel: PanelBrecha; mensaje: string | null }) {
  const { kpis } = panel
  const fecha = panel.corrida.terminado ?? undefined
  return (
    <section aria-label="Indicadores de la brecha" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={MapPinned} label="Predios en catastro" value={cifra(kpis.prediosCatastro)} fecha={fecha} />
      <StatCard icon={Users} label="Predios en el padrón" value={cifra(kpis.prediosPadron)} fecha={fecha} />
      <StatCard icon={FileQuestion} label="Omisos" value={cifra(kpis.omisos)} nota="En catastro, sin declaración" />
      <StatCard icon={TrendingDown} label="Subvaluados" value={cifra(kpis.subvaluados)} nota="Declaran menos que el catastro" />
      <StatCard icon={TrendingUp} label="Sobrevaluados" value={cifra(kpis.sobrevaluados)} nota="Declaran más que el catastro" />
      <StatCard icon={CircleCheck} label="Coinciden" value={cifra(kpis.coinciden)} nota="Diferencia de hasta 5 %" />
      <StatCard icon={CircleMinus} label="Sin catastro" value={cifra(kpis.sinCatastro)} nota="En el padrón, no en el catastro" />
      <StatCard icon={CircleMinus} label="Sin valor" value={cifra(kpis.sinValor)} nota="El catastro no pudo valorizarlos" />
      {kpis.sinLevantar !== undefined && (
        <StatCard icon={CircleDashed} label="Sin levantar" value={cifra(kpis.sinLevantar)} nota={CONFIANZAS.SIN_LEVANTAR.descripcion} />
      )}
      <StatCard
        icon={Landmark}
        label="Δ autoavalúo"
        value={formatMoney(kpis.deltaAutoavaluo)}
        nota={`Declarado ${formatMoney(kpis.autoavaluoDeclarado)} · catastro ${formatMoney(kpis.autoavaluoCatastro)} (predios comparados y omisos)`}
      />
      <StatCard
        icon={Coins}
        label="Δ impuesto predial"
        value={formatMoney(kpis.deltaImpuesto)}
        fecha={fecha}
        nota={
          kpis.deltaImpuestoOmisosEstimado === null || kpis.deltaImpuestoOmisosEstimado === undefined
            ? 'Neto (subvaluados − sobrevaluados) + omisos estimados'
            : `Neto (subvaluados − sobrevaluados) + omisos estimados (${formatMoney(kpis.deltaImpuestoOmisosEstimado)})`
        }
      />
      <StatCard
        icon={Receipt}
        label="Δ arbitrios"
        value={kpis.deltaArbitrios === null ? 'No calculado' : formatMoney(kpis.deltaArbitrios)}
        nota={kpis.deltaArbitrios === null ? (mensaje ?? undefined) : undefined}
      />
    </section>
  )
}

// a swatch of a categoría's colour: the map's, in the legend and the tables
export function Muestra({ categoria }: { categoria: CategoriaBrecha }) {
  return <span aria-hidden className="inline-block size-3 shrink-0 rounded-sm" style={{ backgroundColor: CATEGORIAS[categoria]?.color }} />
}

// a row's name that filters the predios below by it; pressed again, it clears the filter
function Filtro({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn('flex items-center gap-2 text-left text-link hover:underline', activo && 'font-semibold')}
    >
      {children}
    </button>
  )
}

// the brecha of each confianza, each filtering the predios below. the confiable one first and wider, on the brand's
// soft tint: it is the figure that can be defended
function PorConfianza({
  porConfianza,
  activa,
  onElegir
}: {
  porConfianza: NonNullable<PanelBrecha['porConfianza']>
  activa: Confianza | null
  onElegir: (confianza: Confianza | null) => void
}) {
  return (
    <section aria-label="Brecha por confianza">
      <Card>
        <CardHeader>
          <CardTitle>Por confianza</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(CONFIANZAS) as Confianza[]).map((confianza) => {
            const cifras = porConfianza[confianza]
            if (!cifras) return null
            const destacada = confianza === 'CONFIABLE'
            const { nombre, descripcion } = CONFIANZAS[confianza]
            return (
              <article
                key={confianza}
                data-destacada={destacada || undefined}
                className={cn('space-y-1 rounded-card border p-4', destacada ? 'border-brand bg-brand-soft sm:col-span-2' : 'border-border bg-surface')}
              >
                <Filtro activo={activa === confianza} onClick={() => onElegir(activa === confianza ? null : confianza)}>
                  {nombre}
                </Filtro>
                <p className="text-xs text-ink-muted">{descripcion}</p>
                <p className={cn('font-semibold break-words text-ink tabular-nums', destacada ? 'text-2xl' : 'text-lg')}>{formatMoney(cifras.deltaImpuesto)}</p>
                <p className="text-xs text-ink-muted tabular-nums">
                  {`Δ impuesto de ${cifra(cifras.predios)} ${cifras.predios === 1 ? 'predio' : 'predios'} · Δ autoavalúo ${formatMoney(cifras.deltaAutoavaluo)}`}
                </p>
              </article>
            )
          })}
        </CardBody>
      </Card>
    </section>
  )
}

function PorCategoria({
  panel,
  activa,
  onElegir
}: {
  panel: PanelBrecha
  activa: CategoriaBrecha | null
  onElegir: (categoria: CategoriaBrecha | null) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por categoría</CardTitle>
      </CardHeader>
      <Table aria-label="Brecha por categoría">
        <thead>
          <tr>
            <Th>Categoría</Th>
            <Th {...NUMERICA}>Predios</Th>
            <Th {...NUMERICA}>Δ autoavalúo</Th>
            <Th {...NUMERICA}>Δ impuesto</Th>
            <Th {...NUMERICA}>Δ arbitrios</Th>
          </tr>
        </thead>
        <tbody>
          {panel.porCategoria.map((fila) => (
            <tr key={fila.categoria}>
              <Td>
                <Filtro activo={activa === fila.categoria} onClick={() => onElegir(activa === fila.categoria ? null : fila.categoria)}>
                  <Muestra categoria={fila.categoria} />
                  {CATEGORIAS[fila.categoria]?.plural ?? fila.categoria}
                </Filtro>
              </Td>
              <Td {...NUMERICA}>{cifra(fila.predios)}</Td>
              <Td {...NUMERICA}>{formatMoney(fila.deltaAutoavaluo)}</Td>
              <Td {...NUMERICA}>{formatMoney(fila.deltaImpuesto)}</Td>
              <Td {...NUMERICA}>{formatMoney(fila.deltaArbitrios)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

// the predios without a sector cannot be asked for by it (the backend filters by an exact sector): their row does not filter
function PorSector({ panel, activo, onElegir }: { panel: PanelBrecha; activo: string | null; onElegir: (sector: string | null) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por sector</CardTitle>
      </CardHeader>
      {panel.porSector.length === 0 ? (
        <EmptyState title="Sin predios" />
      ) : (
        <Table aria-label="Brecha por sector">
          <thead>
            <tr>
              <Th>Sector</Th>
              <Th {...NUMERICA}>Predios</Th>
              <Th {...NUMERICA}>Omisos</Th>
              <Th {...NUMERICA}>Subvaluados</Th>
              <Th {...NUMERICA}>Δ impuesto</Th>
              <Th {...NUMERICA}>Δ arbitrios</Th>
            </tr>
          </thead>
          <tbody>
            {panel.porSector.map((fila) => (
              <tr key={fila.sector ?? ''}>
                <Td>
                  {fila.sector === null ? (
                    <span className="text-ink-muted">Sin sector</span>
                  ) : (
                    <Filtro activo={activo === fila.sector} onClick={() => onElegir(activo === fila.sector ? null : fila.sector)}>
                      {`Sector ${fila.sector}`}
                    </Filtro>
                  )}
                </Td>
                <Td {...NUMERICA}>{cifra(fila.predios)}</Td>
                <Td {...NUMERICA}>{cifra(fila.omisos)}</Td>
                <Td {...NUMERICA}>{cifra(fila.subvaluados)}</Td>
                <Td {...NUMERICA}>{formatMoney(fila.deltaImpuesto)}</Td>
                <Td {...NUMERICA}>{formatMoney(fila.deltaArbitrios)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

// the lotes of the corrida, each in its categoría's colour; a predio without a lote is in the tables only
function Mapa({ anio, corrida }: { anio: number; corrida: string }) {
  const lotes = useLotesBrecha(anio, corrida)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapa de la brecha</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <ul aria-label="Leyenda" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink">
          {(Object.keys(CATEGORIAS) as CategoriaBrecha[]).map((categoria) => (
            <li key={categoria} className="flex items-center gap-2">
              <Muestra categoria={categoria} />
              {CATEGORIAS[categoria].plural}
            </li>
          ))}
        </ul>
        {lotes.isError && <Alert tone="danger">{errorMessage(lotes.error, 'No se pudieron leer los lotes')}</Alert>}
        <LotesMap features={lotes.data} colorPor={COLOR_POR} label="Mapa de la brecha por categoría" className="h-96" />
      </CardBody>
    </Card>
  )
}

function Predios({
  anio,
  corrida,
  filtros,
  page,
  onPage,
  onFiltrar
}: {
  anio: number
  corrida: string
  filtros: FiltrosBrecha
  page: number
  onPage: (page: number) => void
  onFiltrar: (cambio: FiltrosBrecha) => void
}) {
  const predios = usePrediosBrecha(anio, corrida, filtros, page)
  const { categoria, sector, confianza } = filtros
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center gap-3">
        <CardTitle>Predios</CardTitle>
        {categoria && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onFiltrar({ categoria: null })}
            aria-label={`Quitar el filtro de categoría ${CATEGORIAS[categoria]?.plural ?? categoria}`}
          >
            {CATEGORIAS[categoria]?.plural ?? categoria}
            <X className="size-4" />
          </Button>
        )}
        {sector && (
          <Button variant="secondary" size="sm" onClick={() => onFiltrar({ sector: null })} aria-label={`Quitar el filtro del sector ${sector}`}>
            {`Sector ${sector}`}
            <X className="size-4" />
          </Button>
        )}
        {confianza && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onFiltrar({ confianza: null })}
            aria-label={`Quitar el filtro de confianza ${CONFIANZAS[confianza]?.nombre ?? confianza}`}
          >
            {CONFIANZAS[confianza]?.nombre ?? confianza}
            <X className="size-4" />
          </Button>
        )}
      </CardHeader>
      <QueryState query={predios}>
        {(resultado) =>
          resultado.content.length === 0 ? (
            <EmptyState title="Sin predios con ese filtro" />
          ) : (
            <>
              <Table aria-label="Predios de la brecha">
                <thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Categoría</Th>
                    <Th>Confianza</Th>
                    <Th>Sector</Th>
                    <Th {...NUMERICA}>Autoavalúo declarado</Th>
                    <Th {...NUMERICA}>Autoavalúo catastro</Th>
                    <Th {...NUMERICA}>Δ impuesto</Th>
                    <Th>Motivo</Th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.content.map((fila) => {
                    const codigo = fila.codigoPredio ?? fila.codigoCatastro
                    return (
                      <tr key={fila.id} className="align-top">
                        <Td className="font-medium whitespace-nowrap">
                          {fila.predio ? (
                            <Link to={`/predios/${fila.predio}`} className="text-link hover:underline">
                              {formatText(codigo)}
                            </Link>
                          ) : (
                            formatText(codigo)
                          )}
                          {fila.codigoCatastro && fila.codigoCatastro !== codigo && (
                            <p className="text-xs font-normal text-ink-muted">Catastro {fila.codigoCatastro}</p>
                          )}
                        </Td>
                        <Td>
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <Muestra categoria={fila.categoria} />
                            {CATEGORIAS[fila.categoria]?.singular ?? fila.categoria}
                          </span>
                        </Td>
                        <Td>
                          <ConfianzaDe confianza={fila.confianza} motivo={fila.confianzaMotivo} />
                        </Td>
                        <Td className="whitespace-nowrap">{ubicacion(fila)}</Td>
                        <Td {...NUMERICA}>{formatMoney(fila.autoavaluoDeclarado)}</Td>
                        <Td {...NUMERICA}>{formatMoney(fila.autoavaluoCatastro)}</Td>
                        <Td {...NUMERICA}>
                          {formatMoney(fila.deltaImpuesto)}
                          {fila.estimado && <p className="text-xs text-ink-muted">estimado</p>}
                        </Td>
                        <Td>{formatText(fila.motivo)}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
              <Pagination page={resultado.page} totalPages={resultado.totalPages} totalElements={resultado.totalElements} onPage={onPage} />
            </>
          )
        }
      </QueryState>
    </Card>
  )
}

// a row's confianza as a pill in its tone, and why under it; a row from before #204 has none
function ConfianzaDe({ confianza, motivo }: { confianza: Confianza | null | undefined; motivo: string | null | undefined }) {
  if (!confianza) return <span className="text-ink-muted">—</span>
  const tono = CONFIANZAS[confianza]?.tono ?? ''
  return (
    <>
      <Badge data-tono={tono} className={cn('whitespace-nowrap', PILDORA[tono])}>
        {CONFIANZAS[confianza]?.nombre ?? confianza}
      </Badge>
      {motivo && <p className="mt-1 min-w-40 text-xs text-ink-muted">{motivo}</p>}
    </>
  )
}
