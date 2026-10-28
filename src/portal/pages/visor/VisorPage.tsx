import { ApiError, EmptyState, LoadingState } from '@wasichai/core'
import { Alert, Button, Card, CardBody } from '@wasichai/ui'
import { Download, Loader2, Maximize2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../../kit/ui/errorMessage'
import { rentas } from '../../api'
import { guardarArchivo } from '../../components/descarga'
import { useVisorPredios } from '../../queries'
import { formatInstante } from '../EmisionesPage'
import { SelectorCorrida } from '../reportes/comun'
import { CapasVisor, Leyenda, sinCatastro } from './CapasVisor'
import { DetalleNiveles } from './DetalleNiveles'
import { CLAVES_VISOR } from './estado'
import { Indicadores } from './Indicadores'
import { MapaVisor } from './MapaVisor'
import { FiltrosVisor, TablaVisor } from './TablaVisor'
import type { FilaVisor, Filtros, Orden } from './tipos'
import { RUTA_PANTALLA, useVisor } from './useVisor'

export const FILTROS_VACIOS: Filtros = { categoria: [], confianza: [], estado: [], sector: '', supera_5_uit: '', min_delta: '' }

const noHay = (error: unknown) => error instanceof ApiError && error.status === 404

// «Visor de brechas»: catastro-ui's panel of Brechas over srtm's own corrida, read only. the indicators, the lotes on a
// map coloured by categoría, Δ, confianza or catastro's decision, the vías and catastro's WMS layers, and the rows
// with their niveles. srtm decides nothing here: catastro keeps the decisions, srtm shows them
// its filters, colouring, layers and view are in the url (useEstadoVisor): its workspace tab and its full page come
// back to them
export function VisorPage() {
  const { anio, corrida, conPermisos, puedeLeer, estado, panel, hay, lotes, vias, clases, clasesVias, leyendaVias } = useVisor()
  const { filtros, orden, colorear, mostrarVias, wms, cambiar } = estado
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)
  const [viendo, setViendo] = useState<FilaVisor | null>(null)
  const predios = useVisorPredios(anio, corrida, filtros, orden, page, size, hay)

  // another year or corrida starts on its first page
  useEffect(() => setPage(0), [anio, corrida])
  // fewer rows after a filter: the page goes back to the last one that exists
  const totalPaginas = predios.data?.totalPages
  useEffect(() => {
    if (totalPaginas !== undefined && page > 0 && page >= totalPaginas) setPage(Math.max(0, totalPaginas - 1))
  }, [totalPaginas, page])

  const cambiarFiltros = (f: Filtros) => {
    cambiar({ filtros: f })
    setPage(0)
  }
  const cargando = panel.isFetching || predios.isFetching || lotes.isFetching

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Visor de brechas</h1>
        <p className="text-sm text-ink-muted">
          Lo que la municipalidad cobra frente a lo que valora el catastro, predio a predio, en el mapa, con las decisiones que catastro tomó sobre cada uno.
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-end justify-between gap-3">
          <SelectorCorrida puedeLeer={puedeLeer} conservar={CLAVES_VISOR} />
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className="text-sm text-ink-muted">
              {cargando ? 'Cargando…' : ''}
            </span>
            {puedeLeer && (
              <Link
                to={{ pathname: RUTA_PANTALLA, search: estado.search }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                <Maximize2 aria-hidden className="size-4" />
                Mapa a pantalla completa
              </Link>
            )}
          </div>
        </CardBody>
      </Card>

      {!conPermisos ? (
        <LoadingState />
      ) : !puedeLeer ? (
        <Alert tone="notice">Sin permiso para ver el visor: pide lectura sobre las corridas de brecha.</Alert>
      ) : noHay(panel.error) ? (
        <Card>
          <EmptyState title={`Aún no se ha calculado la brecha de ${anio}`}>
            <p>
              Calcúlala en la{' '}
              <Link to="/brecha" className="text-link hover:underline">
                brecha de recaudación
              </Link>
              : el visor lee su último resultado.
            </p>
          </EmptyState>
        </Card>
      ) : panel.isError ? (
        <Alert tone="danger">{errorMessage(panel.error, 'No se pudo leer el panel del visor')}</Alert>
      ) : !panel.data ? (
        <LoadingState />
      ) : (
        <>
          <section aria-label="Corrida" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
            <span className="font-medium text-ink">{`Corrida del ${formatInstante(panel.data.corrida.terminado ?? null)}`}</span>
            {panel.data.corrida.version_catastro && <span>{`Catastro ${panel.data.corrida.version_catastro}`}</span>}
          </section>

          <Indicadores panel={panel.data} />

          {/* minmax(0,1fr): the column takes the width of the body, not that of the widest control in it */}
          <section aria-label="Visor" className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <CapasVisor
              colorear={colorear}
              onColorear={(c) => cambiar({ colorear: c })}
              mostrarVias={mostrarVias}
              onMostrarVias={(v) => cambiar({ mostrarVias: v })}
              anio={anio}
              errorVias={vias.isError ? sinCatastro(vias.error, 'las vías') : null}
              wms={wms}
              onWms={(w) => cambiar({ wms: w })}
            />
            <div className="relative h-[32rem] overflow-hidden rounded-md border border-border bg-surface-muted">
              <MapaVisor
                clave={`${anio}|${corrida}`}
                anio={anio}
                corrida={corrida}
                lotes={lotes.data}
                colorear={colorear}
                vias={vias.data}
                mostrarVias={mostrarVias}
                clasesVias={clasesVias}
                wms={wms}
                opacidadLotes={estado.opacidadLotes}
                opacidadVias={estado.opacidadVias}
                base={estado.base}
                camara={estado.camara}
                onCamara={(c) => cambiar({ camara: c })}
              />
              {lotes.isError && (
                <Alert tone="danger" className="absolute inset-x-2 top-2">
                  <span className="flex flex-wrap items-center gap-2">
                    No se pudieron cargar los lotes del mapa.
                    <Button size="sm" variant="secondary" onClick={() => void lotes.refetch()}>
                      Reintentar
                    </Button>
                  </span>
                </Alert>
              )}
              <Leyenda colorear={colorear} clases={clases} vias={leyendaVias} anio={anio} />
            </div>
          </section>

          <section aria-label="Predios" className="space-y-3">
            <FiltrosVisor filtros={filtros} onCambio={cambiarFiltros} orden={orden} onOrden={(o) => (cambiar({ orden: o }), setPage(0))} />
            <ExportarCsv anio={anio} corrida={corrida} filtros={filtros} orden={orden} />
            {predios.isError ? (
              <Alert tone="danger">{errorMessage(predios.error, 'No se pudieron leer los predios')}</Alert>
            ) : (
              <TablaVisor pagina={predios.data} page={page} size={size} onPage={setPage} onSize={(s) => (setSize(s), setPage(0))} onNiveles={setViendo} />
            )}
          </section>

          <DetalleNiveles fila={viendo} onCerrar={() => setViendo(null)} />
        </>
      )}
    </div>
  )
}

// every row of the filters (no page), in their order, under the backend's file name
function ExportarCsv({ anio, corrida, filtros, orden }: { anio: number; corrida: string; filtros: Filtros; orden: Orden }) {
  const [pendiente, setPendiente] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const exportar = async () => {
    setPendiente(true)
    setError(null)
    try {
      const { blob, filename } = await rentas.blob(rentas.exportacionVisor(anio, corrida, filtros, orden))
      guardarArchivo(blob, filename)
    } catch (e) {
      setError(e)
    } finally {
      setPendiente(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="secondary" size="sm" disabled={pendiente} onClick={() => void exportar()}>
        {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Exportar CSV
      </Button>
      {error !== null && (
        <Alert tone="danger" className="basis-full">
          {errorMessage(error, 'No se pudo exportar el CSV')}
        </Alert>
      )}
    </div>
  )
}
