import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, EmptyState, QueryState, useAuth } from '@wasichai/core'
import { Badge, Button, Card, CardBody, ConfirmDialog, Label, Table, Td, Textarea, Th } from '@wasichai/ui'
import { Loader2, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { errorMessage } from '../../kit/ui/errorMessage'
import { rentas } from '../api'
import { Alerta } from '../components/Alerta'
import { currentYear, formatText } from '../components/format'
import { YearSelect } from '../components/YearSelect'
import { useDeterminaciones } from '../queries'
import type { DeterminacionMasiva } from '../types'
import { ESTADOS, formatInstante, PILDORA, TONOS } from './EmisionesPage'
import { SubnavArbitrios } from './SubnavArbitrios'

// the determinación masiva of a year's arbitrios (wasichai/srtm-backend#64): launched here with why, run by the backend
// in the background by lotes of predios (the list is asked again every 2 s while one runs), and followed here. it
// writes cuotas and no file: no download, never ENSAMBLANDO. a predio it cannot determine is listed with why; the rest
// are determined. one that is not running can be deleted (its cuotas stay: a cuota is never deleted)

const MINIMO = 5
const MAXIMO = 500

const conEstado = (error: unknown, status: number) => error instanceof ApiError && error.status === status

function errorAlLanzar(error: unknown) {
  if (conEstado(error, 409)) return 'Ya hay una determinación masiva del año en curso'
  if (conEstado(error, 403)) {
    const detalle = errorMessage(error, '')
    return detalle && detalle !== 'Forbidden' ? `No tiene permiso: ${detalle}` : 'No tiene permiso para determinar arbitrios'
  }
  return errorMessage(error, 'No se pudo lanzar')
}

export function DeterminacionesPage() {
  const query = useDeterminaciones()
  const queryClient = useQueryClient()
  const { permissions } = useAuth()
  const objetos = permissions?.objects ?? {}
  // what its lotes use: the job, its lotes and the cuotas (the backend refuses the rest with a 403)
  const puede = Boolean(
    permissions?.admin ||
    (objetos.determinacion_arbitrio_masiva?.includes('CREATE') &&
      objetos.determinacion_arbitrio_masiva?.includes('UPDATE') &&
      objetos.determinacion_arbitrio_lote?.includes('CREATE') &&
      objetos.cuota_arbitrio?.includes('CREATE'))
  )
  const [anio, setAnio] = useState(currentYear)
  const [observacion, setObservacion] = useState('')
  const campo = useId()
  const largo = observacion.trim().length
  const valida = largo >= MINIMO && largo <= MAXIMO

  const lanzar = useMutation({
    mutationFn: () => rentas.determinarMasiva(anio, observacion.trim()),
    onSuccess: async (job) => {
      queryClient.setQueryData<DeterminacionMasiva[]>(['arbitrios', 'determinaciones'], (actuales = []) => [job, ...actuales.filter((d) => d.id !== job.id)])
      setObservacion('')
      await queryClient.invalidateQueries({ queryKey: ['arbitrios'] })
    }
  })
  const enviar = (event: FormEvent) => {
    event.preventDefault()
    if (valida) lanzar.mutate()
  }

  return (
    <div className="space-y-5">
      <SubnavArbitrios />
      <div>
        <h1 className="text-xl font-semibold text-ink">Determinación masiva de arbitrios</h1>
        <p className="text-sm text-ink-muted">Las cuotas que falten de todos los predios declarados en un año. Las ya determinadas no cambian.</p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={enviar} className="flex flex-wrap items-end gap-6">
            <YearSelect value={anio} onChange={setAnio} />
            <div className="min-w-72 flex-1 space-y-1">
              <Label htmlFor={campo}>Observación</Label>
              <Textarea id={campo} rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} disabled={!puede} />
              <p className="text-xs text-ink-muted">
                Por qué se determina: de {MINIMO} a {MAXIMO} caracteres ({largo}).
              </p>
            </div>
            <Button type="submit" disabled={!puede || !valida || lanzar.isPending}>
              {lanzar.isPending && <Loader2 className="size-4 animate-spin" />}
              Determinar
            </Button>
          </form>
          {!puede && (
            <p className="mt-2 text-xs text-ink-muted">
              Sin permiso: pide creación y edición sobre las determinaciones masivas, y creación sobre sus lotes y las cuotas de arbitrio.
            </p>
          )}
          {lanzar.isError && (
            <Alerta tono="error" className="mt-3">
              {errorAlLanzar(lanzar.error)}
            </Alerta>
          )}
        </CardBody>
      </Card>

      <Card>
        <QueryState query={query}>
          {(determinaciones) =>
            determinaciones.length === 0 ? (
              <EmptyState title="Aún no hay determinaciones masivas" />
            ) : (
              <Table aria-label="Determinaciones masivas">
                <thead>
                  <tr>
                    <Th>Año</Th>
                    <Th>Estado</Th>
                    <Th>Predios</Th>
                    <Th>Cuotas</Th>
                    <Th>Iniciado</Th>
                    <Th>Terminado</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {determinaciones.map((d) => (
                    <FilaDeterminacion key={d.id} determinacion={d} />
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

function FilaDeterminacion({ determinacion: d }: { determinacion: DeterminacionMasiva }) {
  const [verErrores, setVerErrores] = useState(false)
  const tono = TONOS[d.estado] ?? ''
  const corriendo = d.estado === 'PENDIENTE' || d.estado === 'EN_PROCESO'
  const porcentaje = d.total > 0 ? Math.min(100, Math.round((d.procesados / d.total) * 100)) : 0
  return (
    <tr className="align-top">
      <Td className="font-medium">
        {d.anio}
        {d.observacion && <p className="text-xs font-normal text-ink-muted">{d.observacion}</p>}
      </Td>
      <Td>
        <Badge data-tono={tono} className={PILDORA[tono]}>
          {ESTADOS[d.estado] ?? d.estado}
        </Badge>
      </Td>
      <Td className="min-w-40">
        <div
          role="progressbar"
          aria-label={`Progreso de la determinación ${d.anio}`}
          aria-valuemin={0}
          aria-valuemax={d.total}
          aria-valuenow={d.procesados}
          className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          <div className={d.estado === 'FALLIDA' ? 'h-full rounded-full bg-danger' : 'h-full rounded-full bg-brand'} style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="text-xs text-ink-muted tabular-nums">{`${d.procesados}/${d.total}`}</p>
      </Td>
      <Td className="tabular-nums">{d.generadas}</Td>
      <Td className="whitespace-nowrap">{formatInstante(d.iniciado)}</Td>
      <Td className="whitespace-nowrap">{formatInstante(d.terminado)}</Td>
      <Td className="space-y-2">
        {d.estado === 'FALLIDA' && <p className="text-sm text-danger">{formatText(d.mensaje)}</p>}
        {d.errores.length > 0 && (
          <div>
            <button type="button" aria-expanded={verErrores} onClick={() => setVerErrores((v) => !v)} className="text-sm text-warning underline">
              {d.errores.length === 1 ? '1 predio sin determinar' : `${d.errores.length} predios sin determinar`}
            </button>
            {verErrores && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-muted">
                {d.errores.map((error, i) => (
                  <li key={`${error.predio}-${i}`}>{`${error.predio}: ${error.mensaje}`}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!corriendo && <EliminarDeterminacion determinacion={d} />}
      </Td>
    </tr>
  )
}

function EliminarDeterminacion({ determinacion }: { determinacion: DeterminacionMasiva }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const borrar = useMutation({
    mutationFn: () => rentas.borrarDeterminacion(determinacion.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['arbitrios', 'determinaciones'] })
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
          title="¿Eliminar esta determinación masiva?"
          description={`Se borra el registro de la determinación ${determinacion.anio}. Las cuotas que escribió quedan: una cuota no se borra.`}
          busy={borrar.isPending}
          error={borrar.isError && errorMessage(borrar.error, 'No se pudo eliminar')}
          onConfirm={() => borrar.mutate()}
          onCancel={cerrar}
        />
      )}
    </>
  )
}
