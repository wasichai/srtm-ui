import { useMutation, useQueryClient } from '@tanstack/react-query'
import { EmptyState, QueryState } from '@wasichai/core'
import { Alert, Button, Card, ConfirmDialog, Input, Table, Td, Th } from '@wasichai/ui'
import { CalendarX, FilePlus, Pencil, Search, ShieldCheck, Trash2, Upload, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { NativeSelect } from '../../../kit/forms/NativeSelect'
import { errorMessage } from '../../../kit/ui/errorMessage'
import { normativa } from '../../api'
import { MensajeDeError } from '../../components/DialogoDeActo'
import { formatDate, formatNumber, formatText, parseNumber } from '../../components/format'
import { usePuede } from '../../components/permisos'
import { NUMERICA } from '../../components/tabla'
import { clavesNormativa, useParametros, useTiposDeParametro } from '../../queries'
import type { DatosDeParametro, EstadoNormativa, FiltrosParametros, Parametro, ResultadoVerificacion, TipoDeParametro } from '../../types'
import {
  Accion,
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

// the parámetros tributarios (srtm-backend#187): the UIT, the tramos, the plazos… each with its vigencia and norma,
// written by one person and verified by another. a POR_VERIFICAR is corrected or deleted; a VIGENTE is only annulled
// or, while its vigencia is open, closed. the catalog of tipos says what each asks for (a clave, a number or a text)

const OBJETO = 'parametro_tributario'
const COLUMNAS_CSV = 'tipo,clave,vigencia_desde,vigencia_hasta,valor_numerico,texto,norma,fuente,transcribio,verifico'

const vigencia = (p: Parametro) => `${formatDate(p.vigencia_desde)} – ${p.vigencia_hasta ? formatDate(p.vigencia_hasta) : 'abierta'}`
const nombre = (p: Pick<Parametro, 'tipo' | 'clave' | 'vigencia_desde'>) => [p.tipo, p.clave, p.vigencia_desde].filter(Boolean).join(' ')

type Dialogo = { tipo: 'datos'; parametro: Parametro | null } | { tipo: 'borrar' | 'anular' | 'cerrar'; parametro: Parametro } | { tipo: 'importar' }

export function ParametrosTab() {
  const queryClient = useQueryClient()
  const tipos = useTiposDeParametro()
  const [borrador, setBorrador] = useState<{ tipo: string; estado: string; vigente_en: string }>({ tipo: '', estado: '', vigente_en: '' })
  const [filtros, setFiltros] = useState<FiltrosParametros>({})
  const query = useParametros(filtros)
  const puedeCrear = usePuede(OBJETO, 'CREATE')
  const puedeActualizar = usePuede(OBJETO, 'UPDATE')
  const puedeBorrar = usePuede(OBJETO, 'DELETE')
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const seleccion = useSeleccion()
  const [verificacion, setVerificacion] = useState<ResultadoVerificacion | null>(null)

  const refrescar = () => queryClient.invalidateQueries({ queryKey: clavesNormativa.todo })
  const cerrar = () => setDialogo(null)
  const hecho = () => {
    cerrar()
    void refrescar()
  }
  const buscar = (event: FormEvent) => {
    event.preventDefault()
    setFiltros({
      tipo: borrador.tipo || undefined,
      estado: (borrador.estado || undefined) as EstadoNormativa | undefined,
      vigente_en: borrador.vigente_en || undefined
    })
    setVerificacion(null)
  }

  const filas = query.data ?? []
  const elegidos = seleccion.de(filas.filter((p) => p.estado === 'POR_VERIFICAR').map((p) => p.id))
  const verificar = useMutation({
    mutationFn: () => normativa.verificarParametros(elegidos),
    onSuccess: (resultado) => {
      setVerificacion(resultado)
      seleccion.limpiar()
      void refrescar()
    }
  })
  const etiqueta = (tipo: string) => tipos.data?.find((t) => t.tipo === tipo)?.etiqueta ?? tipo
  const porId = (id: string) => {
    const p = filas.find((f) => f.id === id)
    return p ? `${etiqueta(p.tipo)}${p.clave ? ` ${p.clave}` : ''} desde ${formatDate(p.vigencia_desde)}` : id
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <form role="search" aria-label="Filtros de parámetros" onSubmit={buscar} className="flex flex-wrap items-end gap-4">
          <Campo etiqueta="Tipo">
            {(id) => (
              <NativeSelect id={id} value={borrador.tipo} onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value })}>
                <option value="">Todos</option>
                {(tipos.data ?? []).map((t) => (
                  <option key={t.tipo} value={t.tipo}>
                    {t.etiqueta}
                  </option>
                ))}
              </NativeSelect>
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
          <Campo etiqueta="Vigente en">
            {(id) => <Input id={id} type="date" value={borrador.vigente_en} onChange={(e) => setBorrador({ ...borrador, vigente_en: e.target.value })} />}
          </Campo>
          <Button type="submit">
            <Search className="size-4" />
            Buscar
          </Button>
        </form>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={!puedeCrear || !puedeActualizar} onClick={() => setDialogo({ tipo: 'importar' })}>
              <Upload className="size-4" />
              Importar CSV
            </Button>
            <Button disabled={!puedeCrear} onClick={() => setDialogo({ tipo: 'datos', parametro: null })}>
              <FilePlus className="size-4" />
              Nuevo parámetro
            </Button>
          </div>
          <SinPermiso puede={puedeCrear}>registrar un parámetro pide creación sobre los parámetros tributarios.</SinPermiso>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={!puedeActualizar || elegidos.length === 0 || verificar.isPending} onClick={() => verificar.mutate()}>
          <ShieldCheck className="size-4" />
          Verificar{elegidos.length > 0 ? ` (${elegidos.length})` : ''}
        </Button>
        <p className="text-xs text-ink-muted">
          {puedeActualizar ? 'Marque los parámetros por verificar que transcribió otra persona.' : 'Sin permiso: verificar pide actualización.'}
        </p>
      </div>
      {verificar.isError && (
        <Alert tone="danger">
          <MensajeDeError error={verificar.error} siFalla="No se pudo verificar" />
        </Alert>
      )}
      {verificacion && <ResultadoDeVerificacion resultado={verificacion} nombre={porId} onCerrar={() => setVerificacion(null)} />}

      <QueryState query={query}>
        {(parametros) => (
          <Tabla
            parametros={parametros}
            etiqueta={etiqueta}
            tipos={tipos.data ?? []}
            seleccionados={elegidos}
            onSeleccion={seleccion.alternar}
            permisos={{ actualizar: puedeActualizar, borrar: puedeBorrar }}
            onAccion={setDialogo}
          />
        )}
      </QueryState>

      {dialogo?.tipo === 'datos' && <DialogoParametro parametro={dialogo.parametro} tipos={tipos.data ?? []} onHecho={hecho} onCerrar={cerrar} />}
      {dialogo?.tipo === 'borrar' && <BorrarParametro parametro={dialogo.parametro} etiqueta={etiqueta} onHecho={hecho} onCerrar={cerrar} />}
      {dialogo?.tipo === 'anular' && (
        <DialogoAnular
          titulo={`Anular ${etiqueta(dialogo.parametro.tipo)}${dialogo.parametro.clave ? ` ${dialogo.parametro.clave}` : ''}`}
          descripcion={`Vigente ${vigencia(dialogo.parametro)}. Deja de regir y no se puede reactivar: para corregirlo, registre otro.`}
          enviar={(motivo) => normativa.anularParametro(dialogo.parametro.id, motivo)}
          onHecho={hecho}
          onCerrar={cerrar}
        />
      )}
      {dialogo?.tipo === 'cerrar' && <CerrarVigencia parametro={dialogo.parametro} etiqueta={etiqueta} onHecho={hecho} onCerrar={cerrar} />}
      {dialogo?.tipo === 'importar' && (
        <DialogoImportar
          titulo="Importar parámetros"
          columnas={COLUMNAS_CSV}
          importar={normativa.importarParametros}
          describir={(f) => nombre({ tipo: String(f.tipo ?? ''), clave: (f.clave as string | null) ?? null, vigencia_desde: String(f.vigencia_desde ?? '') })}
          onHecho={() => void refrescar()}
          onCerrar={cerrar}
        />
      )}
    </div>
  )
}

const valor = (p: Parametro, tipo: TipoDeParametro | undefined) => {
  if (p.valor_numerico !== null) return `${formatNumber(p.valor_numerico)}${tipo?.unidad ? ` ${tipo.unidad}` : ''}`
  return formatText(p.texto)
}

function Tabla({
  parametros,
  etiqueta,
  tipos,
  seleccionados,
  onSeleccion,
  permisos,
  onAccion
}: {
  parametros: Parametro[]
  etiqueta: (tipo: string) => string
  tipos: TipoDeParametro[]
  seleccionados: string[]
  onSeleccion: (id: string) => void
  permisos: { actualizar: boolean; borrar: boolean }
  onAccion: (dialogo: Dialogo) => void
}) {
  const esPropio = useEsPropio()
  if (parametros.length === 0) {
    return (
      <EmptyState title="Ningún parámetro">
        <p>Cambie los filtros, o registre o importe los parámetros.</p>
      </EmptyState>
    )
  }
  return (
    <Card>
      <Table aria-label="Parámetros tributarios">
        <thead>
          <tr>
            <Th>
              <span className="sr-only">Verificar</span>
            </Th>
            <Th>Tipo</Th>
            <Th>Clave</Th>
            <Th {...NUMERICA}>Valor</Th>
            <Th>Vigencia</Th>
            <Th>Norma</Th>
            <Th>Transcribió</Th>
            <Th>Verificó</Th>
            <Th>Estado</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {parametros.map((p) => {
            const titulo = `${etiqueta(p.tipo)}${p.clave ? ` ${p.clave}` : ''} desde ${formatDate(p.vigencia_desde)}`
            return (
              <tr key={p.id}>
                <Td>
                  {p.estado === 'POR_VERIFICAR' && (
                    <CasillaVerificar
                      etiqueta={titulo}
                      marcada={seleccionados.includes(p.id)}
                      propio={esPropio(p.transcribio)}
                      onCambio={() => onSeleccion(p.id)}
                    />
                  )}
                </Td>
                <Td>{etiqueta(p.tipo)}</Td>
                <Td>{formatText(p.clave)}</Td>
                <Td {...NUMERICA}>
                  {valor(
                    p,
                    tipos.find((t) => t.tipo === p.tipo)
                  )}
                </Td>
                <Td className="whitespace-nowrap">{vigencia(p)}</Td>
                <Td>{formatText(p.norma)}</Td>
                <Td>{formatText(p.transcribio)}</Td>
                <Td>{formatText(p.verifico)}</Td>
                <Td>
                  <EstadoNormativaBadge estado={p.estado} />
                  {p.estado === 'ANULADO' && p.motivo_anulacion && <span className="block text-xs text-ink-muted">{p.motivo_anulacion}</span>}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {p.estado === 'POR_VERIFICAR' && (
                      <>
                        <Accion icono={<Pencil className="size-4" />} puede={permisos.actualizar} onClick={() => onAccion({ tipo: 'datos', parametro: p })}>
                          Editar
                        </Accion>
                        <Accion icono={<Trash2 className="size-4" />} puede={permisos.borrar} onClick={() => onAccion({ tipo: 'borrar', parametro: p })}>
                          Borrar
                        </Accion>
                      </>
                    )}
                    {p.estado === 'VIGENTE' && (
                      <>
                        <Accion icono={<XCircle className="size-4" />} puede={permisos.actualizar} onClick={() => onAccion({ tipo: 'anular', parametro: p })}>
                          Anular
                        </Accion>
                        {!p.vigencia_hasta && (
                          <Accion
                            icono={<CalendarX className="size-4" />}
                            puede={permisos.actualizar}
                            onClick={() => onAccion({ tipo: 'cerrar', parametro: p })}
                          >
                            Cerrar vigencia
                          </Accion>
                        )}
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Card>
  )
}

// what the dialog sends: the tipo's shape (a clave, a number or a text), the vigencia and where it comes from
function datos(v: Valores, tipo: TipoDeParametro | undefined): DatosDeParametro {
  const texto = (v.valor ?? '').trim()
  return {
    tipo: v.tipo,
    clave: tipo?.usa_clave ? textoONulo(v.clave) : null,
    vigencia_desde: v.vigencia_desde,
    vigencia_hasta: textoONulo(v.vigencia_hasta),
    valor_numerico: tipo?.valor === 'NUMERICO' ? parseNumber(texto) : null,
    texto: tipo?.valor === 'TEXTO' ? texto || null : null,
    norma: textoONulo(v.norma),
    fuente: textoONulo(v.fuente)
  }
}

function DialogoParametro({
  parametro,
  tipos,
  onHecho,
  onCerrar
}: {
  parametro: Parametro | null
  tipos: TipoDeParametro[]
  onHecho: () => void
  onCerrar: () => void
}) {
  const de = (v: Valores) => tipos.find((t) => t.tipo === v.tipo)
  const campos = (v: Valores): CampoDeDatos[] => {
    const tipo = de(v)
    const valor = tipo?.valor === 'TEXTO' ? 'texto' : 'valor_numerico'
    return [
      {
        nombre: 'tipo',
        etiqueta: 'Tipo',
        tipo: 'opciones',
        requerido: true,
        fijo: parametro !== null,
        opciones: tipos.map((t) => ({ valor: t.tipo, texto: t.etiqueta }))
      },
      ...(tipo?.usa_clave ? [{ nombre: 'clave', etiqueta: 'Clave', requerido: true }] : []),
      ...(tipo
        ? [
            {
              nombre: 'valor',
              etiqueta: tipo.valor === 'TEXTO' ? 'Texto' : 'Valor',
              tipo: tipo.valor === 'TEXTO' ? ('texto' as const) : ('numero' as const),
              requerido: !tipo.admite_vacio,
              ayuda: tipo.unidad ?? undefined,
              // the backend names the field it refuses by its own name
              alias: valor
            }
          ]
        : []),
      { nombre: 'vigencia_desde', etiqueta: 'Vigente desde', tipo: 'fecha', requerido: true },
      { nombre: 'vigencia_hasta', etiqueta: 'Vigente hasta', tipo: 'fecha' },
      { nombre: 'norma', etiqueta: 'Norma' },
      { nombre: 'fuente', etiqueta: 'Fuente' }
    ]
  }
  const inicial: Valores = {
    tipo: parametro?.tipo ?? '',
    clave: parametro?.clave ?? '',
    valor: parametro ? (parametro.valor_numerico !== null ? String(parametro.valor_numerico) : (parametro.texto ?? '')) : '',
    vigencia_desde: parametro?.vigencia_desde ?? '',
    vigencia_hasta: parametro?.vigencia_hasta ?? '',
    norma: parametro?.norma ?? '',
    fuente: parametro?.fuente ?? ''
  }
  return (
    <DialogoDeDatos
      titulo={parametro ? 'Corregir parámetro' : 'Nuevo parámetro'}
      descripcion={
        parametro
          ? 'Sigue por verificar. Quien corrige pasa a ser quien lo transcribió: lo verifica otra persona.'
          : 'Entra por verificar: rige cuando otra persona lo verifique.'
      }
      inicial={inicial}
      campos={campos}
      accion={parametro ? 'Guardar' : 'Registrar'}
      enviar={(v) => {
        const cuerpo = datos(v, de(v))
        return parametro ? normativa.corregirParametro(parametro.id, cuerpo) : normativa.registrarParametro(cuerpo)
      }}
      onHecho={onHecho}
      onCerrar={onCerrar}
    />
  )
}

function BorrarParametro({
  parametro,
  etiqueta,
  onHecho,
  onCerrar
}: {
  parametro: Parametro
  etiqueta: (tipo: string) => string
  onHecho: () => void
  onCerrar: () => void
}) {
  const borrar = useMutation({ mutationFn: () => normativa.borrarParametro(parametro.id), onSuccess: onHecho })
  return (
    <ConfirmDialog
      title="¿Borrar este parámetro?"
      description={`${etiqueta(parametro.tipo)}${parametro.clave ? ` ${parametro.clave}` : ''}, vigente ${vigencia(parametro)}. Aún no rige: se borra sin dejar rastro.`}
      confirmLabel="Borrar"
      busy={borrar.isPending}
      error={borrar.isError && errorMessage(borrar.error, 'No se pudo borrar')}
      onConfirm={() => borrar.mutate()}
      onCancel={onCerrar}
    />
  )
}

// a VIGENTE with its vigencia open gets the day it stops: nothing else of it changes
function CerrarVigencia({
  parametro,
  etiqueta,
  onHecho,
  onCerrar
}: {
  parametro: Parametro
  etiqueta: (tipo: string) => string
  onHecho: () => void
  onCerrar: () => void
}) {
  return (
    <DialogoDeDatos
      titulo={`Cerrar la vigencia de ${etiqueta(parametro.tipo)}${parametro.clave ? ` ${parametro.clave}` : ''}`}
      descripcion={`Vigente desde el ${formatDate(parametro.vigencia_desde)}, sin fecha de fin. Rige hasta el día que ponga, incluido; nada más cambia.`}
      inicial={{ vigencia_hasta: '' }}
      campos={() => [{ nombre: 'vigencia_hasta', etiqueta: 'Vigente hasta', tipo: 'fecha', requerido: true }]}
      accion="Cerrar vigencia"
      enviar={(v) => normativa.cerrarParametro(parametro.id, v.vigencia_hasta)}
      onHecho={onHecho}
      onCerrar={onCerrar}
    />
  )
}
