import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, EmptyState, QueryState } from '@wasichai/core'
import { Alert, Button, Card, ConfirmDialog, Input, Pagination, Table, Td, Th } from '@wasichai/ui'
import { FilePlus, Loader2, Pencil, RefreshCw, Search, ShieldCheck, Trash2, Upload, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { NativeSelect } from '../../../kit/forms/NativeSelect'
import { errorMessage } from '../../../kit/ui/errorMessage'
import { normativa } from '../../api'
import { MensajeDeError } from '../../components/DialogoDeActo'
import { currentYear, formatMoney, formatText, parseNumber } from '../../components/format'
import { usePuede } from '../../components/permisos'
import { NUMERICA } from '../../components/tabla'
import { YearSelect } from '../../components/YearSelect'
import { clavesNormativa, useAranceles } from '../../queries'
import type { Arancel, DatosDeArancel, EstadoNormativa, Pagina, ResultadoVerificacion, Sincronizacion } from '../../types'
import { formatInstante } from '../EmisionesPage'
import {
  Accion,
  AvisoSincronizacion,
  Campo,
  CasillaVerificar,
  DialogoAnular,
  DialogoDeDatos,
  DialogoImportar,
  ESTADOS,
  ESTADOS_NORMATIVA,
  EstadoNormativaBadge,
  ResultadoDeVerificacion,
  SinPermiso,
  textoONulo,
  useEsPropio,
  useSeleccion,
  type CampoDeDatos,
  type Valores
} from './comun'

// the aranceles (srtm-backend#188): the S/ por m² of each tramo de vía (id_aranc) in a year, with the same double
// signature as the parámetros, and no «cerrar» (each year has its own). srtm owns them; catastro-backend keeps a copy
// of the VIGENTE ones to value with (#189): the Catastro column says how that copy stands

const OBJETO = 'arancel'
const COLUMNAS_CSV = 'id_aranc,anio,valor_m2,cod_via,cuadra,lado,norma,fuente,transcribio,verifico'
export const SIN_SINCRONIZACION = 'La sincronización con catastro aún no está disponible'

type Dialogo = { tipo: 'datos'; arancel: Arancel | null } | { tipo: 'borrar' | 'anular'; arancel: Arancel } | { tipo: 'importar' }

export function ArancelesTab() {
  const queryClient = useQueryClient()
  const [anio, setAnio] = useState(currentYear)
  const [borrador, setBorrador] = useState({ q: '', estado: '' })
  const [filtros, setFiltros] = useState<{ q?: string; estado?: EstadoNormativa }>({})
  const [page, setPage] = useState(0)
  const query = useAranceles({ anio, ...filtros }, page)
  const puedeCrear = usePuede(OBJETO, 'CREATE')
  const puedeActualizar = usePuede(OBJETO, 'UPDATE')
  const puedeBorrar = usePuede(OBJETO, 'DELETE')
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const seleccion = useSeleccion()
  const [verificacion, setVerificacion] = useState<ResultadoVerificacion | null>(null)
  // what the copy to catastro did after an anulación (verificar and importar show theirs in place)
  const [sincronizacion, setSincronizacion] = useState<Sincronizacion | null>(null)

  const refrescar = () => queryClient.invalidateQueries({ queryKey: clavesNormativa.todo })
  const cerrar = () => setDialogo(null)
  const hecho = () => {
    cerrar()
    void refrescar()
  }
  const buscar = (event: FormEvent) => {
    event.preventDefault()
    setFiltros({ q: borrador.q.trim() || undefined, estado: (borrador.estado || undefined) as EstadoNormativa | undefined })
    setPage(0)
  }

  const filas = query.data?.content ?? []
  const elegidos = seleccion.de(filas.filter((a) => a.estado === 'POR_VERIFICAR').map((a) => a.id))
  const verificar = useMutation({
    mutationFn: () => normativa.verificarAranceles(elegidos),
    onSuccess: (resultado) => {
      setVerificacion(resultado)
      seleccion.limpiar()
      void refrescar()
    }
  })
  const sincronizar = useMutation({ mutationFn: () => normativa.sincronizarAranceles(anio), onSettled: () => void refrescar() })
  const porId = (id: string) => {
    const a = filas.find((f) => f.id === id)
    return a ? `${a.id_aranc} ${a.anio}` : id
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <form role="search" aria-label="Filtros de aranceles" onSubmit={buscar} className="flex flex-wrap items-end gap-4">
          <YearSelect
            value={anio}
            onChange={(nuevo) => {
              setAnio(nuevo)
              setPage(0)
              sincronizar.reset()
            }}
            siguiente
          />
          <Campo etiqueta="Tramo o vía">
            {(id) => (
              <Input
                id={id}
                type="search"
                placeholder="id_aranc o cod_via"
                value={borrador.q}
                onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
              />
            )}
          </Campo>
          <Campo etiqueta="Estado">
            {(id) => (
              <NativeSelect id={id} value={borrador.estado} onChange={(e) => setBorrador({ ...borrador, estado: e.target.value })}>
                <option value="">Todos</option>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {ESTADOS_NORMATIVA[e].texto}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Campo>
          <Button type="submit">
            <Search className="size-4" />
            Buscar
          </Button>
        </form>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={!puedeActualizar || sincronizar.isPending} onClick={() => sincronizar.mutate()}>
              {sincronizar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sincronizar con catastro
            </Button>
            <Button variant="secondary" disabled={!puedeCrear || !puedeActualizar} onClick={() => setDialogo({ tipo: 'importar' })}>
              <Upload className="size-4" />
              Importar CSV
            </Button>
            <Button disabled={!puedeCrear} onClick={() => setDialogo({ tipo: 'datos', arancel: null })}>
              <FilePlus className="size-4" />
              Nuevo arancel
            </Button>
          </div>
          <SinPermiso puede={puedeCrear}>registrar un arancel pide creación sobre los aranceles.</SinPermiso>
          <SinPermiso puede={puedeActualizar}>verificar, anular y sincronizar piden actualización sobre los aranceles.</SinPermiso>
        </div>
      </div>

      {sincronizar.isSuccess && (
        <div role="status">
          <Alert tone={sincronizar.data.errores.length > 0 ? 'warning' : 'success'} onDismiss={() => sincronizar.reset()}>
            Sincronización de {anio}: {sincronizar.data.sincronizados} {sincronizar.data.sincronizados === 1 ? 'copiado' : 'copiados'} a catastro.
            {sincronizar.data.errores.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {sincronizar.data.errores.map((e) => (
                  <li key={e.id}>
                    {e.clave}: {e.error}
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        </div>
      )}
      {sincronizar.isError && (
        <Alert tone={esNoEncontrado(sincronizar.error) ? 'notice' : 'danger'} onDismiss={() => sincronizar.reset()}>
          {esNoEncontrado(sincronizar.error) ? SIN_SINCRONIZACION : <MensajeDeError error={sincronizar.error} siFalla="No se pudo sincronizar" />}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={!puedeActualizar || elegidos.length === 0 || verificar.isPending} onClick={() => verificar.mutate()}>
          <ShieldCheck className="size-4" />
          Verificar{elegidos.length > 0 ? ` (${elegidos.length})` : ''}
        </Button>
        <p className="text-xs text-ink-muted">Marque los aranceles por verificar que transcribió otra persona.</p>
      </div>
      {verificar.isError && (
        <Alert tone="danger">
          <MensajeDeError error={verificar.error} siFalla="No se pudo verificar" />
        </Alert>
      )}
      {verificacion && <ResultadoDeVerificacion resultado={verificacion} nombre={porId} onCerrar={() => setVerificacion(null)} />}
      <AvisoSincronizacion sincronizacion={sincronizacion} />

      <QueryState query={query}>
        {(pagina) => (
          <Tabla
            pagina={pagina}
            anio={anio}
            seleccionados={elegidos}
            onSeleccion={seleccion.alternar}
            permisos={{ actualizar: puedeActualizar, borrar: puedeBorrar }}
            onAccion={(d) => {
              setSincronizacion(null)
              setDialogo(d)
            }}
            onPage={setPage}
          />
        )}
      </QueryState>

      {dialogo?.tipo === 'datos' && <DialogoArancel arancel={dialogo.arancel} anio={anio} onHecho={hecho} onCerrar={cerrar} />}
      {dialogo?.tipo === 'borrar' && <BorrarArancel arancel={dialogo.arancel} onHecho={hecho} onCerrar={cerrar} />}
      {dialogo?.tipo === 'anular' && (
        <DialogoAnular
          titulo={`Anular el arancel ${dialogo.arancel.id_aranc} ${dialogo.arancel.anio}`}
          descripcion={`${formatMoney(dialogo.arancel.valor_m2)} por m². Deja de regir y sale de catastro: para corregirlo, registre otro.`}
          enviar={(motivo) => normativa.anularArancel(dialogo.arancel.id, motivo)}
          onHecho={(anulado) => {
            setSincronizacion(anulado.sincronizacion ?? null)
            hecho()
          }}
          onCerrar={cerrar}
        />
      )}
      {dialogo?.tipo === 'importar' && (
        <DialogoImportar
          titulo="Importar aranceles"
          columnas={COLUMNAS_CSV}
          importar={normativa.importarAranceles}
          describir={(f) => `${String(f.id_aranc ?? '')} ${String(f.anio ?? '')}: ${formatMoney(typeof f.valor_m2 === 'number' ? f.valor_m2 : null)} por m²`}
          onHecho={() => void refrescar()}
          onCerrar={cerrar}
        />
      )}
    </div>
  )
}

const esNoEncontrado = (error: unknown) => error instanceof ApiError && error.status === 404

// how catastro's copy stands: copied (when), failed (why, in its tooltip), or a VIGENTE still to copy
export function EstadoCatastro({ arancel: a }: { arancel: Arancel }) {
  if (a.error_sincronizacion) {
    return (
      <span title={a.error_sincronizacion} data-catastro="error" className="cursor-help text-sm font-medium text-danger underline decoration-dotted">
        error
      </span>
    )
  }
  if (a.sincronizado_en) {
    return (
      <span data-catastro="sincronizado" className="text-sm text-success">
        sincronizado <span className="text-xs whitespace-nowrap text-ink-muted">{formatInstante(a.sincronizado_en)}</span>
      </span>
    )
  }
  if (a.estado === 'VIGENTE') {
    return (
      <span data-catastro="pendiente" className="text-sm text-warning">
        pendiente
      </span>
    )
  }
  return null
}

function Tabla({
  pagina,
  anio,
  seleccionados,
  onSeleccion,
  permisos,
  onAccion,
  onPage
}: {
  pagina: Pagina<Arancel>
  anio: number
  seleccionados: string[]
  onSeleccion: (id: string) => void
  permisos: { actualizar: boolean; borrar: boolean }
  onAccion: (dialogo: Dialogo) => void
  onPage: (page: number) => void
}) {
  const esPropio = useEsPropio()
  if (pagina.content.length === 0) {
    return (
      <EmptyState title={`Ningún arancel de ${anio}`}>
        <p>Cambie el año o los filtros, o registre o importe los aranceles.</p>
      </EmptyState>
    )
  }
  return (
    <>
      <Card>
        <Table aria-label={`Aranceles de ${anio}`}>
          <thead>
            <tr>
              <Th>
                <span className="sr-only">Verificar</span>
              </Th>
              <Th>id_aranc</Th>
              <Th>Año</Th>
              <Th {...NUMERICA}>S/ por m²</Th>
              <Th>Vía</Th>
              <Th>Cuadra</Th>
              <Th>Lado</Th>
              <Th>Norma</Th>
              <Th>Transcribió</Th>
              <Th>Verificó</Th>
              <Th>Estado</Th>
              <Th>Catastro</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {pagina.content.map((a) => (
              <tr key={a.id}>
                <Td>
                  {a.estado === 'POR_VERIFICAR' && (
                    <CasillaVerificar
                      etiqueta={`${a.id_aranc} ${a.anio}`}
                      marcada={seleccionados.includes(a.id)}
                      propio={esPropio(a.transcribio)}
                      onCambio={() => onSeleccion(a.id)}
                    />
                  )}
                </Td>
                <Td className="font-semibold">{a.id_aranc}</Td>
                <Td>{a.anio}</Td>
                <Td {...NUMERICA}>{formatMoney(a.valor_m2)}</Td>
                <Td>{formatText(a.cod_via)}</Td>
                <Td>{formatText(a.cuadra)}</Td>
                <Td>{formatText(a.lado)}</Td>
                <Td>{formatText(a.norma)}</Td>
                <Td>{formatText(a.transcribio)}</Td>
                <Td>{formatText(a.verifico)}</Td>
                <Td>
                  <EstadoNormativaBadge estado={a.estado} />
                  {a.estado === 'ANULADO' && a.motivo_anulacion && <span className="block text-xs text-ink-muted">{a.motivo_anulacion}</span>}
                </Td>
                <Td>
                  <EstadoCatastro arancel={a} />
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {a.estado === 'POR_VERIFICAR' && (
                      <>
                        <Accion icono={<Pencil className="size-4" />} puede={permisos.actualizar} onClick={() => onAccion({ tipo: 'datos', arancel: a })}>
                          Editar
                        </Accion>
                        <Accion icono={<Trash2 className="size-4" />} puede={permisos.borrar} onClick={() => onAccion({ tipo: 'borrar', arancel: a })}>
                          Borrar
                        </Accion>
                      </>
                    )}
                    {a.estado === 'VIGENTE' && (
                      <Accion icono={<XCircle className="size-4" />} puede={permisos.actualizar} onClick={() => onAccion({ tipo: 'anular', arancel: a })}>
                        Anular
                      </Accion>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Pagination page={pagina.page} totalPages={pagina.totalPages} totalElements={pagina.totalElements} onPage={onPage} />
    </>
  )
}

const CAMPOS_ARANCEL: CampoDeDatos[] = [
  { nombre: 'id_aranc', etiqueta: 'id_aranc', requerido: true },
  { nombre: 'anio', etiqueta: 'Año', tipo: 'numero', requerido: true },
  { nombre: 'valor_m2', etiqueta: 'S/ por m²', tipo: 'numero', requerido: true },
  { nombre: 'cod_via', etiqueta: 'Vía (cod_via)' },
  { nombre: 'cuadra', etiqueta: 'Cuadra' },
  { nombre: 'lado', etiqueta: 'Lado' },
  { nombre: 'norma', etiqueta: 'Norma' },
  { nombre: 'fuente', etiqueta: 'Fuente' }
]

function datos(v: Valores): DatosDeArancel {
  return {
    id_aranc: (v.id_aranc ?? '').trim(),
    anio: parseNumber(v.anio ?? '', { integer: true }) ?? undefined,
    valor_m2: parseNumber(v.valor_m2 ?? '') ?? undefined,
    cod_via: textoONulo(v.cod_via),
    cuadra: textoONulo(v.cuadra),
    lado: textoONulo(v.lado),
    norma: textoONulo(v.norma),
    fuente: textoONulo(v.fuente)
  }
}

function DialogoArancel({ arancel, anio, onHecho, onCerrar }: { arancel: Arancel | null; anio: number; onHecho: () => void; onCerrar: () => void }) {
  const texto = (valor: string | number | null | undefined) => (valor === null || valor === undefined ? '' : String(valor))
  const inicial: Valores = {
    id_aranc: texto(arancel?.id_aranc),
    anio: texto(arancel?.anio ?? anio),
    valor_m2: texto(arancel?.valor_m2),
    cod_via: texto(arancel?.cod_via),
    cuadra: texto(arancel?.cuadra),
    lado: texto(arancel?.lado),
    norma: texto(arancel?.norma),
    fuente: texto(arancel?.fuente)
  }
  return (
    <DialogoDeDatos
      titulo={arancel ? `Corregir el arancel ${arancel.id_aranc} ${arancel.anio}` : 'Nuevo arancel'}
      descripcion={
        arancel
          ? 'Sigue por verificar. Quien corrige pasa a ser quien lo transcribió: lo verifica otra persona.'
          : 'Entra por verificar: rige, y pasa a catastro, cuando otra persona lo verifique.'
      }
      inicial={inicial}
      campos={() => CAMPOS_ARANCEL}
      accion={arancel ? 'Guardar' : 'Registrar'}
      enviar={(v) => (arancel ? normativa.corregirArancel(arancel.id, datos(v)) : normativa.registrarArancel(datos(v)))}
      onHecho={onHecho}
      onCerrar={onCerrar}
    />
  )
}

function BorrarArancel({ arancel, onHecho, onCerrar }: { arancel: Arancel; onHecho: () => void; onCerrar: () => void }) {
  const borrar = useMutation({ mutationFn: () => normativa.borrarArancel(arancel.id), onSuccess: onHecho })
  return (
    <ConfirmDialog
      title="¿Borrar este arancel?"
      description={`${arancel.id_aranc} ${arancel.anio}, ${formatMoney(arancel.valor_m2)} por m². Aún no rige: se borra sin dejar rastro.`}
      confirmLabel="Borrar"
      busy={borrar.isPending}
      error={borrar.isError && errorMessage(borrar.error, 'No se pudo borrar')}
      onConfirm={() => borrar.mutate()}
      onCancel={onCerrar}
    />
  )
}
