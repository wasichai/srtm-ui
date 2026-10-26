import { ApiError, EmptyState, LoadingState, QueryState } from '@wasichai/core'
import { Alert, Badge, Button, Card, CardBody, CardHeader, CardTitle, cn, Input, PageSizePagination, Table, Td, Th } from '@wasichai/ui'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, FileSpreadsheet, FileText, Loader2, Map as MapIcon, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { errorMessage } from '../../../kit/ui/errorMessage'
import { rentas } from '../../api'
import type { ColorPor } from '../../components/colorDeLotes'
import { guardarArchivo } from '../../components/descarga'
import { formatMoney, formatText } from '../../components/format'
import { LotesMap } from '../../components/LotesMap'
import { NUMERICA } from '../../components/tabla'
import { useCatalogoReportes, useLotesBrecha, useReporte, useResumenReportes } from '../../queries'
import type { Confianza, FilaReporteContribuyente, FilaReportePredio, FiltrosReporte, OrdenReporte } from '../../types'
import { Campo } from '../AnunciosPages'
import { CATEGORIAS, CONFIANZAS, Muestra } from '../BrechaPage'
import { PILDORA } from '../EmisionesPage'
import { formatM2 } from './Barras'
import { DECISIONES, SelectorCorrida, useAnioYCorrida, usePermisoReportes } from './comun'

// a report of the corrida: its rows filtered, sorted and paged by the backend (srtm-backend#248), exported with the
// same filters to xlsx or csv, and the lotes of the page on the map when asked. everything lives in the url: a link
// handed over opens the same list

// the titles while the catalog loads (or when it fails): the backend's win
const TITULOS: Record<string, string> = {
  subvaluados: 'Predios subvaluados',
  sobrevaluados: 'Predios sobrevaluados',
  omisos: 'Omisos',
  'sin-catastro': 'Sin catastro',
  'sin-levantar': 'Sin levantar',
  'sin-valor': 'Sin valor',
  terreno: 'Diferencia de terreno',
  construccion: 'Diferencia de construcción',
  contribuyentes: 'Contribuyentes',
  'mayores-5-uit': 'Mayores a 5 UIT'
}

const TAMANOS = [20, 50, 100] as const
const SELECT = 'h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink'
const ORDENES: OrdenReporte[] = ['deltaImpuesto', 'deltaAutoavaluo', 'areaTerreno', 'areaConstruida', 'codigo']

const COLOR_POR: ColorPor = {
  propiedad: 'categoria',
  colores: Object.fromEntries(Object.entries(CATEGORIAS).map(([categoria, { color }]) => [categoria, color]))
}

// sector-manzana-lote, as far as the row has them
const ubicacion = ({ sector, manzana, lote }: { sector: string | null; manzana: string | null; lote: string | null }) =>
  [sector, manzana, lote].filter(Boolean).join('-') || '—'

// the url's filters, in the order the backend is asked with
function filtrosDe(params: URLSearchParams): FiltrosReporte {
  const orden = params.get('orden') as OrdenReporte | null
  const dir = params.get('dir')
  return {
    sector: params.get('sector'),
    manzana: params.get('manzana'),
    uso: params.get('uso'),
    confianza: params.get('confianza') as Confianza | null,
    q: params.get('q'),
    orden: orden && ORDENES.includes(orden) ? orden : null,
    dir: dir === 'asc' || dir === 'desc' ? dir : null
  }
}

export function ReportePage() {
  const { clave = '' } = useParams()
  const { anio, corrida, conservar, params, setParams } = useAnioYCorrida()
  const { conPermisos, puedeLeer } = usePermisoReportes()
  const catalogo = useCatalogoReportes(anio, corrida, puedeLeer)
  const resumen = useResumenReportes(anio, corrida, puedeLeer)
  const reporte = catalogo.data?.find((r) => r.clave === clave)
  const titulo = reporte?.titulo ?? TITULOS[clave] ?? clave
  const esContribuyentes = clave === 'contribuyentes'

  const filtros = useMemo(() => filtrosDe(params), [params])
  const page = Math.max(0, Number(params.get('page')) || 0)
  const size = Number(params.get('size')) || TAMANOS[0]
  const filas = useReporte<FilaReportePredio | FilaReporteContribuyente>(clave, anio, corrida, filtros, page, size, puedeLeer)

  // a change of the url's params: a filter (or the order, or the size) goes back to the first page
  const cambiar = (cambio: Record<string, string | number | null>, primera = true) => {
    const siguiente = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambio)) {
      if (v === null || v === '') siguiente.delete(k)
      else siguiente.set(k, String(v))
    }
    if (primera) siguiente.delete('page')
    setParams(siguiente)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/reportes?${conservar}`}>
            <ArrowLeft className="size-4" />
            Volver a los reportes
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-ink">{titulo}</h1>
        {reporte?.descripcion && <p className="text-sm text-ink-muted">{reporte.descripcion}</p>}
      </div>

      <Card>
        <CardBody className="space-y-4">
          <SelectorCorrida puedeLeer={puedeLeer} />
          <Filtros
            key={params.toString()}
            filtros={filtros}
            sectores={resumen.data?.porSector.map((s) => s.sector).filter((s): s is string => s !== null) ?? []}
            usos={resumen.data?.porUso.filter((u) => u.uso !== null).map((u) => ({ uso: u.uso!, nombre: u.descripcion ?? u.uso! })) ?? []}
            onFiltrar={(f) =>
              cambiar({ sector: f.sector ?? null, manzana: f.manzana ?? null, uso: f.uso ?? null, confianza: f.confianza ?? null, q: f.q ?? null })
            }
          />
        </CardBody>
      </Card>

      {!conPermisos ? (
        <LoadingState />
      ) : !puedeLeer ? (
        <Alert tone="notice">Sin permiso para ver los reportes: pide lectura sobre las corridas de brecha.</Alert>
      ) : filas.error instanceof ApiError && filas.error.status === 404 ? (
        <Card>
          <EmptyState title={`Aún no se ha calculado la brecha de ${anio}`}>
            <p>
              Calcúlala en la{' '}
              <Link to="/brecha" className="text-link hover:underline">
                brecha de recaudación
              </Link>
              .
            </p>
          </EmptyState>
        </Card>
      ) : filas.isError ? (
        <Alert tone="danger">{errorMessage(filas.error, 'No se pudo leer el reporte')}</Alert>
      ) : (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{esContribuyentes ? 'Contribuyentes' : 'Predios'}</CardTitle>
            <Exportar clave={clave} anio={anio} corrida={corrida} filtros={filtros} />
          </CardHeader>
          <QueryState query={filas}>
            {(resultado) =>
              resultado.items.length === 0 ? (
                <EmptyState title="Sin filas con ese filtro" />
              ) : (
                <>
                  {esContribuyentes ? (
                    <TablaContribuyentes titulo={titulo} filas={resultado.items as FilaReporteContribuyente[]} filtros={filtros} onOrden={cambiar} />
                  ) : (
                    <TablaPredios titulo={titulo} filas={resultado.items as FilaReportePredio[]} filtros={filtros} onOrden={cambiar} />
                  )}
                  <PageSizePagination
                    page={resultado.page}
                    size={resultado.size}
                    total={resultado.total}
                    sizes={TAMANOS}
                    onPage={(p) => cambiar({ page: p }, false)}
                    onSize={(s) => cambiar({ size: s })}
                  />
                </>
              )
            }
          </QueryState>
        </Card>
      )}

      {puedeLeer && !esContribuyentes && filas.data && filas.data.items.length > 0 && (
        <Mapa anio={anio} corrida={corrida || resumen.data?.corrida.id} ids={(filas.data.items as FilaReportePredio[]).map((f) => f.id)} />
      )}
    </div>
  )
}

// the filters as typed, sent together with Filtrar (a text is not asked for at every key)
function Filtros({
  filtros,
  sectores,
  usos,
  onFiltrar
}: {
  filtros: FiltrosReporte
  sectores: string[]
  usos: { uso: string; nombre: string }[]
  onFiltrar: (filtros: FiltrosReporte) => void
}) {
  const [borrador, setBorrador] = useState({
    sector: filtros.sector ?? '',
    manzana: filtros.manzana ?? '',
    uso: filtros.uso ?? '',
    confianza: filtros.confianza ?? '',
    q: filtros.q ?? ''
  })
  const enviar = (event: FormEvent) => {
    event.preventDefault()
    onFiltrar({
      sector: borrador.sector || null,
      manzana: borrador.manzana.trim() || null,
      uso: borrador.uso || null,
      confianza: (borrador.confianza || null) as Confianza | null,
      q: borrador.q.trim() || null
    })
  }
  return (
    <form role="search" aria-label="Filtros del reporte" onSubmit={enviar} className="flex flex-wrap items-end gap-4">
      <Campo etiqueta="Sector">
        {(id) => (
          <select id={id} className={SELECT} value={borrador.sector} onChange={(e) => setBorrador({ ...borrador, sector: e.target.value })}>
            <option value="">Todos</option>
            {sectores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <Campo etiqueta="Manzana">
        {(id) => <Input id={id} className="w-24" value={borrador.manzana} onChange={(e) => setBorrador({ ...borrador, manzana: e.target.value })} />}
      </Campo>
      <Campo etiqueta="Uso">
        {(id) => (
          <select id={id} className={cn(SELECT, 'max-w-56')} value={borrador.uso} onChange={(e) => setBorrador({ ...borrador, uso: e.target.value })}>
            <option value="">Todos</option>
            {usos.map((u) => (
              <option key={u.uso} value={u.uso}>
                {u.nombre}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <Campo etiqueta="Confianza">
        {(id) => (
          <select id={id} className={SELECT} value={borrador.confianza} onChange={(e) => setBorrador({ ...borrador, confianza: e.target.value })}>
            <option value="">Todas</option>
            {(Object.keys(CONFIANZAS) as Confianza[]).map((c) => (
              <option key={c} value={c}>
                {CONFIANZAS[c].nombre}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <Campo etiqueta="Código o nombre">
        {(id) => (
          <Input id={id} type="search" className="w-56 max-w-full" value={borrador.q} onChange={(e) => setBorrador({ ...borrador, q: e.target.value })} />
        )}
      </Campo>
      <Button type="submit" variant="secondary">
        <Search className="size-4" />
        Filtrar
      </Button>
    </form>
  )
}

// the export of every row of the filter (no page), under the backend's file name
function Exportar({ clave, anio, corrida, filtros }: { clave: string; anio: number; corrida: string; filtros: FiltrosReporte }) {
  const [pendiente, setPendiente] = useState<'xlsx' | 'csv' | null>(null)
  const [error, setError] = useState<unknown>(null)
  const exportar = async (formato: 'xlsx' | 'csv') => {
    setPendiente(formato)
    setError(null)
    try {
      const { blob, filename } = await rentas.blob(rentas.exportacionReporte(clave, formato, anio, corrida, filtros))
      guardarArchivo(blob, filename)
    } catch (e) {
      setError(e)
    } finally {
      setPendiente(null)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" disabled={pendiente !== null} onClick={() => exportar('xlsx')}>
        {pendiente === 'xlsx' ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
        Exportar XLSX
      </Button>
      <Button variant="secondary" size="sm" disabled={pendiente !== null} onClick={() => exportar('csv')}>
        {pendiente === 'csv' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
        Exportar CSV
      </Button>
      {error !== null && (
        <Alert tone="danger" className="basis-full">
          {errorMessage(error, 'No se pudo exportar el reporte')}
        </Alert>
      )}
    </div>
  )
}

// a column the backend sorts by: a press sorts by it (the figures down first, the code up), a second flips it
function Ordenable({
  orden,
  filtros,
  onOrden,
  children,
  numerica = true
}: {
  orden: OrdenReporte
  filtros: FiltrosReporte
  onOrden: (cambio: Record<string, string | null>) => void
  children: ReactNode
  numerica?: boolean
}) {
  const activo = filtros.orden === orden
  const inicial = orden === 'codigo' ? 'asc' : 'desc'
  const dir = activo ? (filtros.dir ?? inicial) : null
  const Icono = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <Th {...(numerica ? NUMERICA : {})} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button
        type="button"
        onClick={() => onOrden({ orden, dir: activo ? (dir === 'asc' ? 'desc' : 'asc') : inicial })}
        className={cn(
          'inline-flex items-center gap-1 [font:inherit] [letter-spacing:inherit] [text-transform:inherit] hover:text-link',
          numerica && 'flex-row-reverse',
          activo && 'text-link'
        )}
      >
        {children}
        <Icono aria-hidden className="size-3.5 shrink-0" />
      </button>
    </Th>
  )
}

function TablaPredios({
  titulo,
  filas,
  filtros,
  onOrden
}: {
  titulo: string
  filas: FilaReportePredio[]
  filtros: FiltrosReporte
  onOrden: (cambio: Record<string, string | null>) => void
}) {
  const orden = { filtros, onOrden }
  return (
    <Table aria-label={titulo}>
      <thead>
        <tr>
          <Ordenable orden="codigo" numerica={false} {...orden}>
            Código
          </Ordenable>
          <Th>Contribuyente</Th>
          <Th>Ubicación</Th>
          <Th>Uso</Th>
          <Th>Categoría</Th>
          <Th>Confianza</Th>
          <Th {...NUMERICA}>Autoavalúo declarado</Th>
          <Th {...NUMERICA}>Autoavalúo catastro</Th>
          <Ordenable orden="deltaAutoavaluo" {...orden}>
            Δ autoavalúo
          </Ordenable>
          <Th {...NUMERICA}>Impuesto declarado</Th>
          <Th {...NUMERICA}>Impuesto catastro</Th>
          <Ordenable orden="deltaImpuesto" {...orden}>
            Δ impuesto
          </Ordenable>
          <Ordenable orden="areaTerreno" {...orden}>
            Terreno m² (decl. / cat.)
          </Ordenable>
          <Ordenable orden="areaConstruida" {...orden}>
            Construido m² (decl. / cat.)
          </Ordenable>
          <Th>Decisión de catastro</Th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => {
          const codigo = fila.codigoPredio ?? fila.codigoCatastro
          const decision = fila.decision ? DECISIONES[fila.decision] : null
          const confianza = fila.confianza ? CONFIANZAS[fila.confianza] : null
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
                {fila.codigoCatastro && fila.codigoCatastro !== codigo && <p className="text-xs font-normal text-ink-muted">Catastro {fila.codigoCatastro}</p>}
              </Td>
              <Td className="min-w-44">
                {fila.contribuyente ? (
                  <Link to={`/contribuyentes/${fila.contribuyente}`} className="text-link hover:underline">
                    {formatText(fila.nombreContribuyente ?? fila.codigoContribuyente)}
                  </Link>
                ) : (
                  formatText(fila.nombreContribuyente)
                )}
                <p className="flex gap-2 text-xs text-ink-muted">
                  {fila.codigoContribuyente && <span>{fila.codigoContribuyente}</span>}
                  {fila.declaracion && (
                    <Link to={`/declaraciones/${fila.declaracion}`} className="text-link hover:underline">
                      DJ
                    </Link>
                  )}
                </p>
              </Td>
              <Td className="whitespace-nowrap">{ubicacion(fila)}</Td>
              <Td className="min-w-28">{formatText(fila.usoDescripcion ?? fila.uso)}</Td>
              <Td>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Muestra categoria={fila.categoria} />
                  {CATEGORIAS[fila.categoria]?.singular ?? fila.categoria}
                </span>
              </Td>
              <Td>
                {confianza ? (
                  <Badge data-tono={confianza.tono} className={cn('whitespace-nowrap', PILDORA[confianza.tono])}>
                    {confianza.nombre}
                  </Badge>
                ) : (
                  <span className="text-ink-muted">—</span>
                )}
              </Td>
              <Td {...NUMERICA}>{formatMoney(fila.autoavaluoDeclarado)}</Td>
              <Td {...NUMERICA}>{formatMoney(fila.autoavaluoCatastro)}</Td>
              <Td {...NUMERICA}>{formatMoney(fila.deltaAutoavaluo)}</Td>
              <Td {...NUMERICA}>{formatMoney(fila.impuestoDeclarado)}</Td>
              <Td {...NUMERICA}>{formatMoney(fila.impuestoCatastro)}</Td>
              <Td {...NUMERICA}>{formatMoney(fila.deltaImpuesto)}</Td>
              <Td {...NUMERICA} className={cn(NUMERICA.className, 'whitespace-nowrap')}>
                {`${formatM2(fila.areaTerrenoDeclarada)} / ${formatM2(fila.areaTerrenoCatastro)}`}
              </Td>
              <Td {...NUMERICA} className={cn(NUMERICA.className, 'whitespace-nowrap')}>
                {`${formatM2(fila.areaConstruidaDeclarada)} / ${formatM2(fila.areaConstruidaCatastro)}`}
              </Td>
              <Td>
                {decision ? (
                  <Badge data-tono={decision.tono} className={cn('whitespace-nowrap', PILDORA[decision.tono])}>
                    {decision.nombre}
                  </Badge>
                ) : (
                  <span className="text-ink-muted">—</span>
                )}
              </Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}

function TablaContribuyentes({
  titulo,
  filas,
  filtros,
  onOrden
}: {
  titulo: string
  filas: FilaReporteContribuyente[]
  filtros: FiltrosReporte
  onOrden: (cambio: Record<string, string | null>) => void
}) {
  const orden = { filtros, onOrden }
  return (
    <Table aria-label={titulo}>
      <thead>
        <tr>
          <Ordenable orden="codigo" numerica={false} {...orden}>
            Código
          </Ordenable>
          <Th>Contribuyente</Th>
          <Th {...NUMERICA}>Predios</Th>
          <Ordenable orden="deltaAutoavaluo" {...orden}>
            Δ autoavalúo
          </Ordenable>
          <Ordenable orden="deltaImpuesto" {...orden}>
            Δ impuesto
          </Ordenable>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={fila.contribuyente ?? `sin-${i}`}>
            <Td className="whitespace-nowrap">{formatText(fila.codigoContribuyente)}</Td>
            <Td className="min-w-44">
              {fila.contribuyente ? (
                <Link to={`/contribuyentes/${fila.contribuyente}`} className="text-link hover:underline">
                  {formatText(fila.nombreContribuyente)}
                </Link>
              ) : (
                formatText(fila.nombreContribuyente)
              )}
            </Td>
            <Td {...NUMERICA}>{fila.predios.toLocaleString('es-PE')}</Td>
            <Td {...NUMERICA}>{formatMoney(fila.deltaAutoavaluo)}</Td>
            <Td {...NUMERICA}>{formatMoney(fila.deltaImpuesto)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

// the lotes of the page's rows, each in its categoría's colour, asked only once shown (the corrida's lotes, kept to
// those rows: a row without a lote is in the table only)
function Mapa({ anio, corrida, ids }: { anio: number; corrida: string | undefined; ids: string[] }) {
  const [visible, setVisible] = useState(false)
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Mapa</CardTitle>
        <Button variant="secondary" size="sm" aria-expanded={visible} onClick={() => setVisible((v) => !v)}>
          <MapIcon className="size-4" />
          {visible ? 'Ocultar el mapa' : 'Ver en el mapa'}
        </Button>
      </CardHeader>
      {visible && corrida && (
        <CardBody>
          <LotesDeLaPagina anio={anio} corrida={corrida} ids={ids} />
        </CardBody>
      )}
    </Card>
  )
}

function LotesDeLaPagina({ anio, corrida, ids }: { anio: number; corrida: string; ids: string[] }) {
  const lotes = useLotesBrecha(anio, corrida)
  const features = useMemo(() => {
    if (!lotes.data) return lotes.data
    const deLaPagina = new Set(ids)
    return { ...lotes.data, features: lotes.data.features.filter((f) => f.id !== undefined && deLaPagina.has(String(f.id))) }
  }, [lotes.data, ids])
  return (
    <div className="space-y-3">
      {lotes.isError && <Alert tone="danger">{errorMessage(lotes.error, 'No se pudieron leer los lotes')}</Alert>}
      <LotesMap features={features} colorPor={COLOR_POR} label="Mapa de los predios del reporte" className="h-96" />
    </div>
  )
}
