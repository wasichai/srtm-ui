import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, EmptyState, QueryState } from '@wasichai/core'
import { Badge, Button, Card, CardBody, cn, ConfirmDialog, Table, Td, Th } from '@wasichai/ui'
import { Download, Loader2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../kit/ui/errorMessage'
import { rentas } from '../api'
import { Alerta } from '../components/Alerta'
import { guardarArchivo } from '../components/descarga'
import { currentYear, formatDate, formatText } from '../components/format'
import type { Tono } from '../components/tono'
import { YearSelect } from '../components/YearSelect'
import { useEmisiones } from '../queries'
import type { DocumentoEmision, Emision, EstadoEmision, FormatoEmision } from '../types'

// the emisión masiva of a year's HR and PU (wasichai/srtm-backend#37): launched here, run by the backend in the
// background, followed here (the list is asked again every 2 s while a job runs) and, once it ends, downloaded.
// the backend keeps only the last finished ones of each year: an older one stays TERMINADA without its file (archivo
// null, 410 on the download), and any that is not running can be deleted (wasichai/srtm-ui#67)

const FORMATOS: { valor: FormatoEmision; label: string }[] = [
  { valor: 'PDF', label: 'Un solo PDF' },
  { valor: 'ZIP', label: 'ZIP: un PDF por predio y la HR de cada contribuyente' }
]

// what each contribuyente gets, in this order; by default its HR and PUs, as before the HLA (srtm-backend#65)
const DOCUMENTOS: { valor: DocumentoEmision; label: string }[] = [
  { valor: 'HR', label: 'HR (hoja de resumen)' },
  { valor: 'PU', label: 'PU de cada predio' },
  { valor: 'HLA', label: 'HLA (liquidación de arbitrios)' }
]
const POR_DEFECTO: DocumentoEmision[] = ['HR', 'PU']
const esPorDefecto = (documentos: DocumentoEmision[]) => documentos.length === POR_DEFECTO.length && POR_DEFECTO.every((d) => documentos.includes(d))

// ENSAMBLANDO (wasichai/srtm-ui#70): every part of the job is done, the backend is still building the final file
export const ESTADOS: Record<EstadoEmision, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  ENSAMBLANDO: 'Ensamblando',
  TERMINADA: 'Terminada',
  FALLIDA: 'Fallida'
}
// the tone of each estado: running ones in amber, a failed one in red
export const TONOS: Record<EstadoEmision, Tono> = { PENDIENTE: 'ambar', EN_PROCESO: 'ambar', ENSAMBLANDO: 'ambar', TERMINADA: 'verde', FALLIDA: 'rojo' }
export const PILDORA: Record<Tono, string> = {
  verde: 'bg-success/10 text-success',
  ambar: 'bg-warning/10 text-warning',
  rojo: 'bg-danger/10 text-danger',
  '': 'bg-surface-muted text-ink-muted'
}

const mensajeDe = (error: unknown) => errorMessage(error, 'No se pudo completar')
const conEstado = (error: unknown, status: number) => error instanceof ApiError && error.status === status

// what the POST's error says: a 403 in the portal's words, with the backend's detail when it sends one (the client
// falls back to the title, "Forbidden", when it does not)
function errorAlEmitir(error: unknown) {
  if (conEstado(error, 409)) return 'Ya hay una emisión en proceso'
  if (conEstado(error, 403)) {
    const detalle = errorMessage(error, '')
    return detalle && detalle !== 'Forbidden' ? `No tiene permiso para lanzar emisiones masivas: ${detalle}` : 'No tiene permiso para lanzar emisiones masivas'
  }
  return mensajeDe(error)
}

export function EmisionesPage() {
  const query = useEmisiones()
  const queryClient = useQueryClient()
  const [anio, setAnio] = useState(currentYear)
  const [formato, setFormato] = useState<FormatoEmision>('PDF')
  const [documentos, setDocumentos] = useState<DocumentoEmision[]>(POR_DEFECTO)
  const alternar = (documento: DocumentoEmision) =>
    setDocumentos((actuales) =>
      actuales.includes(documento)
        ? actuales.filter((d) => d !== documento)
        : DOCUMENTOS.map((d) => d.valor).filter((d) => d === documento || actuales.includes(d))
    )

  const emitir = useMutation({
    mutationFn: () => rentas.emitir(anio, formato, esPorDefecto(documentos) ? undefined : documentos),
    onSuccess: async (job) => {
      // the new job at once, then the backend's list (which starts the polling)
      queryClient.setQueryData<Emision[]>(['emisiones'], (actuales = []) => [job, ...actuales.filter((e) => e.id !== job.id)])
      await queryClient.invalidateQueries({ queryKey: ['emisiones'] })
    }
  })
  const enviar = (event: FormEvent) => {
    event.preventDefault()
    emitir.mutate()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Emisión masiva</h1>
        <p className="text-sm text-ink-muted">Hojas de resumen (HR) y declaraciones de predio urbano (PU) de todos los contribuyentes de un año</p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={enviar} className="flex flex-wrap items-end gap-6">
            <YearSelect value={anio} onChange={setAnio} />
            <fieldset className="space-y-1">
              <legend className="text-sm text-ink-muted">Formato</legend>
              {FORMATOS.map(({ valor, label }) => (
                <label key={valor} className="flex items-center gap-2 text-sm text-ink">
                  <input type="radio" name="formato" value={valor} checked={formato === valor} onChange={() => setFormato(valor)} />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-1">
              <legend className="text-sm text-ink-muted">Documentos de cada contribuyente</legend>
              {DOCUMENTOS.map(({ valor, label }) => (
                <label key={valor} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="documentos" value={valor} checked={documentos.includes(valor)} onChange={() => alternar(valor)} />
                  {label}
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={emitir.isPending || documentos.length === 0}>
              {emitir.isPending && <Loader2 className="size-4 animate-spin" />}
              Emitir
            </Button>
          </form>
          {emitir.isError && (
            <Alerta tono="error" className="mt-3">
              {errorAlEmitir(emitir.error)}
            </Alerta>
          )}
        </CardBody>
      </Card>

      <Card>
        <QueryState query={query}>
          {(emisiones) =>
            emisiones.length === 0 ? (
              <EmptyState title="Aún no hay emisiones" />
            ) : (
              <Table aria-label="Emisiones">
                <thead>
                  <tr>
                    <Th>Año</Th>
                    <Th>Formato</Th>
                    <Th>Estado</Th>
                    <Th>Progreso</Th>
                    <Th>Iniciado</Th>
                    <Th>Terminado</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {emisiones.map((emision) => (
                    <FilaEmision key={emision.id} emision={emision} />
                  ))}
                </tbody>
              </Table>
            )
          }
        </QueryState>
      </Card>
    </div>
  )
}

function FilaEmision({ emision }: { emision: Emision }) {
  const [verErrores, setVerErrores] = useState(false)
  const descargar = useMutation({
    mutationFn: () => rentas.blob(`/srtm/emisiones/${emision.id}/archivo`),
    onSuccess: ({ blob, filename }) => guardarArchivo(blob, filename)
  })
  const errores = emision.errores ?? []
  const tono = TONOS[emision.estado] ?? ''
  const terminada = emision.estado === 'TERMINADA'
  // purged by the retention: known from the list (no file) or from the download (410)
  const depurado = terminada && (!emision.archivo || conEstado(descargar.error, 410))
  // ENSAMBLANDO also counts as running: the backend refuses to delete it (409), so no "Eliminar" here either
  const corriendo = emision.estado === 'PENDIENTE' || emision.estado === 'EN_PROCESO' || emision.estado === 'ENSAMBLANDO'

  return (
    <tr className="align-top">
      <Td className="font-medium">{emision.anio}</Td>
      <Td>
        {emision.formato}
        {emision.documentos && !esPorDefecto(emision.documentos) && <p className="text-xs text-ink-muted">{emision.documentos.join(', ')}</p>}
      </Td>
      <Td>
        <Badge data-tono={tono} className={PILDORA[tono]}>
          {ESTADOS[emision.estado] ?? emision.estado}
        </Badge>
      </Td>
      <Td className="min-w-40">
        <Progreso emision={emision} />
      </Td>
      <Td className="whitespace-nowrap">{formatInstante(emision.iniciado)}</Td>
      <Td className="whitespace-nowrap">{formatInstante(emision.terminado)}</Td>
      <Td className="space-y-2">
        {terminada && !depurado && (
          <Button variant="secondary" size="sm" onClick={() => descargar.mutate()} disabled={descargar.isPending}>
            {descargar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Descargar{emision.tamano ? ` (${formatTamano(emision.tamano)})` : ''}
          </Button>
        )}
        {depurado && <Alerta tono="aviso">Archivo depurado</Alerta>}
        {descargar.isError && !depurado && <Alerta tono="error">{mensajeDe(descargar.error)}</Alerta>}
        {emision.estado === 'FALLIDA' && <p className="text-sm text-danger">{formatText(emision.mensaje)}</p>}
        {errores.length > 0 && (
          <div>
            <button type="button" aria-expanded={verErrores} onClick={() => setVerErrores((v) => !v)} className="text-sm text-warning underline">
              {errores.length === 1 ? '1 contribuyente con error' : `${errores.length} contribuyentes con error`}
            </button>
            {verErrores && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-muted">
                {errores.map((error, i) => (
                  <li key={`${error.contribuyente}-${i}`}>{`${error.contribuyente}: ${error.mensaje}`}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!corriendo && <EliminarEmision emision={emision} />}
      </Td>
    </tr>
  )
}

// deleting a job that is not running, confirmed first like EliminarFicha; once gone, the list is read again
function EliminarEmision({ emision }: { emision: Emision }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const borrar = useMutation({
    mutationFn: () => rentas.borrarEmision(emision.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emisiones'] })
      setOpen(false)
    }
  })
  const cerrar = () => {
    setOpen(false)
    borrar.reset()
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4 text-danger" />
        Eliminar
      </Button>
      {open && (
        <ConfirmDialog
          title="¿Eliminar esta emisión?"
          description={`Se borran el registro de la emisión ${emision.anio} y su archivo. No se puede deshacer.`}
          busy={borrar.isPending}
          error={borrar.isError && (conEstado(borrar.error, 409) ? 'La emisión está en curso: no se puede eliminar mientras corre' : mensajeDe(borrar.error))}
          onConfirm={() => borrar.mutate()}
          onCancel={cerrar}
        />
      )}
    </>
  )
}

function Progreso({ emision }: { emision: Emision }) {
  const { procesados, total, estado, anio } = emision
  // ENSAMBLANDO has no procesados/total left to show (every part is already done): an ARIA indeterminate
  // progressbar instead, no aria-valuenow/aria-valuemax, a full, pulsing bar
  const ensamblando = estado === 'ENSAMBLANDO'
  const porcentaje = total > 0 ? Math.min(100, Math.round((procesados / total) * 100)) : 0
  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-label={`Progreso de la emisión ${anio}`}
        aria-valuemin={0}
        aria-valuemax={ensamblando ? undefined : total}
        aria-valuenow={ensamblando ? undefined : procesados}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', estado === 'FALLIDA' ? 'bg-danger' : 'bg-brand', ensamblando && 'w-full animate-pulse')}
          style={ensamblando ? undefined : { width: `${porcentaje}%` }}
        />
      </div>
      <p className="text-xs text-ink-muted tabular-nums">{ensamblando ? 'Ensamblando el archivo…' : `${procesados}/${total}`}</p>
    </div>
  )
}

// an instant in Perú's time: the day, as the srtm writes it, and the hour
const HORA = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false })
export function formatInstante(valor: string | null | undefined) {
  if (!valor) return '—'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? formatText(valor) : `${formatDate(valor)} ${HORA.format(fecha)}`
}

function formatTamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
