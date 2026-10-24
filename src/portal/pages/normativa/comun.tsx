import { useMutation } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Label, Table, Td, Textarea, Th } from '@wasichai/ui'
import { Loader2 } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { NativeSelect } from '../../../kit/forms/NativeSelect'
import { errorMessage } from '../../../kit/ui/errorMessage'
import { BadgeDeMapa, type EtiquetaDeMapa } from '../../components/BadgeDeMapa'
import { formatNumber, parseNumber } from '../../components/format'
import { NUMERICA } from '../../components/tabla'
import { MensajeDeError } from '../../components/DialogoDeActo'
import type { EstadoNormativa, ResultadoImportacion, ResultadoVerificacion, Sincronizacion } from '../../types'

// what the two tabs of Normativa share (parámetros, aranceles): the estado, who signs, the verificación of a
// selection, the anulación with its motivo, the import of a csv and the dialog of a row's data

export const ESTADOS_NORMATIVA: Record<EstadoNormativa, EtiquetaDeMapa> = {
  POR_VERIFICAR: { texto: 'Por verificar', tono: 'ambar' },
  VIGENTE: { texto: 'Vigente', tono: 'verde' },
  ANULADO: { texto: 'Anulado', tono: '' }
}

export const ESTADOS: EstadoNormativa[] = ['POR_VERIFICAR', 'VIGENTE', 'ANULADO']

export function EstadoNormativaBadge({ estado }: { estado: EstadoNormativa | null }) {
  return <BadgeDeMapa valor={estado ?? 'VIGENTE'} mapa={ESTADOS_NORMATIVA} />
}

// who signed, as the backend compares it: the name before a comma, in capitals (a person signs with their email)
const firmante = (firma: string | null | undefined) => (firma ?? '').split(',')[0].trim().toUpperCase()

// whether the signed-in user wrote it: the doble firma asks another person to verify it
export function useEsPropio() {
  const { user } = useAuth()
  const yo = firmante(user?.email)
  return (transcribio: string | null) => yo !== '' && firmante(transcribio) === yo
}

export const PROPIO = 'La doble firma pide otra persona'

// a filter: its label over it
export function Campo({ etiqueta, children }: { etiqueta: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children(id)}
    </div>
  )
}

// a row's act: disabled, saying why, without the permission
export function Accion({ icono, puede, onClick, children }: { icono: ReactNode; puede: boolean; onClick: () => void; children: string }) {
  return (
    <Button variant="ghost" size="sm" disabled={!puede} title={puede ? undefined : 'Sin permiso'} onClick={onClick}>
      {icono}
      {children}
    </Button>
  )
}

// a button the user may not use: disabled, with why beside it (the backend would refuse with a 403 all the same)
export function SinPermiso({ puede, children }: { puede: boolean; children: string }) {
  return puede ? null : <p className="text-xs text-ink-muted">Sin permiso: {children}</p>
}

// what the copy to catastro did after a write (srtm-backend#189): nothing when it did not run
export function AvisoSincronizacion({ sincronizacion }: { sincronizacion: Sincronizacion | null | undefined }) {
  if (!sincronizacion) return null
  const { sincronizados, errores } = sincronizacion
  return (
    <Alert tone={errores.length > 0 ? 'warning' : 'notice'}>
      {sincronizados} {sincronizados === 1 ? 'copiado' : 'copiados'} a catastro.
      {errores.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {errores.map((e) => (
            <li key={e.id}>
              {e.clave}: {e.error}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  )
}

// the answer of a verificación: how many passed and each rechazo with its motivo, the row named by `nombre`
export function ResultadoDeVerificacion({
  resultado,
  nombre,
  onCerrar
}: {
  resultado: ResultadoVerificacion
  nombre: (id: string) => string
  onCerrar: () => void
}) {
  const { verificados, rechazados } = resultado
  return (
    <div className="space-y-2" role="status">
      <Alert tone={rechazados.length > 0 ? 'warning' : 'success'} onDismiss={onCerrar}>
        {verificados.length} {verificados.length === 1 ? 'verificado' : 'verificados'}
        {rechazados.length > 0 && `, ${rechazados.length} ${rechazados.length === 1 ? 'rechazado' : 'rechazados'}`}.
        {rechazados.length > 0 && (
          <ul aria-label="Rechazos de la verificación" className="mt-1 list-disc pl-5">
            {rechazados.map((r) => (
              <li key={r.id}>
                {nombre(r.id)}: {r.motivo}
              </li>
            ))}
          </ul>
        )}
      </Alert>
      <AvisoSincronizacion sincronizacion={resultado.sincronizacion} />
    </div>
  )
}

// the rows picked to verify: only the ones POR_VERIFICAR that the user did not write
export function useSeleccion() {
  const [ids, setIds] = useState<string[]>([])
  const alternar = (id: string) => setIds((actuales) => (actuales.includes(id) ? actuales.filter((i) => i !== id) : [...actuales, id]))
  return { ids, alternar, limpiar: () => setIds([]), de: (visibles: string[]) => ids.filter((id) => visibles.includes(id)) }
}

// a row's checkbox for the verificación: disabled, with why, on one the user wrote
export function CasillaVerificar({ etiqueta, marcada, propio, onCambio }: { etiqueta: string; marcada: boolean; propio: boolean; onCambio: () => void }) {
  return (
    <span title={propio ? PROPIO : undefined} className="inline-flex">
      <input type="checkbox" aria-label={`Seleccionar ${etiqueta}`} checked={marcada} disabled={propio} onChange={onCambio} className="accent-brand" />
    </span>
  )
}

// the anulación of a VIGENTE: why, asked in a dialog. the backend keeps who and when
export function DialogoAnular<T>({
  titulo,
  descripcion,
  enviar,
  onHecho,
  onCerrar
}: {
  titulo: string
  descripcion: string
  enviar: (motivo: string) => Promise<T>
  onHecho: (resultado: T) => void
  onCerrar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const id = useId()
  const anular = useMutation({ mutationFn: () => enviar(motivo.trim()), onSuccess: onHecho })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (motivo.trim() && !anular.isPending) anular.mutate()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold">{titulo}</DialogTitle>
        <DialogDescription className="mb-3 text-sm text-ink-muted">{descripcion}</DialogDescription>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={id}>Motivo</Label>
            <Textarea id={id} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {anular.isError && (
            <Alert tone="danger">
              <MensajeDeError error={anular.error} siFalla="No se pudo anular" />
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={!motivo.trim() || anular.isPending}>
              {anular.isPending && <Loader2 className="size-4 animate-spin" />}
              Anular
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// the import of a csv: the file picked is sent as a dry run (nothing is written) and what it would do is shown; only
// «Confirmar» sends it again to write. `describir`: a row to create or update, in a line
export function DialogoImportar({
  titulo,
  columnas,
  importar,
  describir,
  onHecho,
  onCerrar
}: {
  titulo: string
  columnas: string
  importar: (archivo: File, dryRun: boolean) => Promise<ResultadoImportacion>
  describir: (fila: ResultadoImportacion['crear'][number]) => string
  onHecho: () => void
  onCerrar: () => void
}) {
  const id = useId()
  const [archivo, setArchivo] = useState<File | null>(null)
  const prueba = useMutation({ mutationFn: (elegido: File) => importar(elegido, true) })
  const confirmar = useMutation({ mutationFn: () => importar(archivo!, false), onSuccess: onHecho })
  const elegir = (elegido: File | null) => {
    setArchivo(elegido)
    confirmar.reset()
    if (elegido) prueba.mutate(elegido)
    else prueba.reset()
  }
  const vista = prueba.data
  const escribe = vista ? vista.crear.length + vista.actualizar.length : 0
  const hecho = confirmar.data

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-lg font-semibold">{titulo}</DialogTitle>
        <DialogDescription className="mb-3 text-sm text-ink-muted">
          Un CSV con las columnas <code>{columnas}</code>. Primero se muestra lo que haría; nada se escribe hasta confirmar.
        </DialogDescription>
        {hecho ? (
          <div className="space-y-3">
            <Alert tone="success">
              Importado: {hecho.crear.length} {hecho.crear.length === 1 ? 'creado' : 'creados'}, {hecho.actualizar.length}{' '}
              {hecho.actualizar.length === 1 ? 'actualizado' : 'actualizados'}, {hecho.iguales} sin cambios
              {hecho.rechazos.length > 0 && `, ${hecho.rechazos.length} rechazados`}.
            </Alert>
            <AvisoSincronizacion sincronizacion={hecho.sincronizacion} />
            <div className="flex justify-end">
              <Button onClick={onCerrar}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor={id}>Archivo CSV</Label>
              <Input id={id} type="file" accept=".csv,text/csv,text/plain" onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
            </div>
            {prueba.isPending && (
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                <Loader2 className="size-4 animate-spin" />
                Revisando el archivo…
              </p>
            )}
            {prueba.isError && (
              <Alert tone="danger">
                <MensajeDeError error={prueba.error} siFalla="No se pudo leer el archivo" />
              </Alert>
            )}
            {vista && <VistaPrevia vista={vista} describir={describir} />}
            {confirmar.isError && (
              <Alert tone="danger">
                <MensajeDeError error={confirmar.error} siFalla="No se pudo importar" />
              </Alert>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button disabled={!vista || escribe === 0 || confirmar.isPending} onClick={() => confirmar.mutate()}>
                {confirmar.isPending && <Loader2 className="size-4 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function VistaPrevia({ vista, describir }: { vista: ResultadoImportacion; describir: (fila: ResultadoImportacion['crear'][number]) => string }) {
  const grupos = [
    { titulo: 'Crear', filas: vista.crear },
    { titulo: 'Actualizar', filas: vista.actualizar }
  ]
  return (
    <section aria-label="Vista previa de la importación" className="space-y-3 text-sm text-ink">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Crear', vista.crear.length],
          ['Actualizar', vista.actualizar.length],
          ['Iguales', vista.iguales],
          ['Rechazos', vista.rechazos.length]
        ].map(([termino, cuenta]) => (
          <div key={termino} className="rounded-md border border-border px-3 py-2">
            <dt className="text-xs text-ink-muted">{termino}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatNumber(cuenta as number)}</dd>
          </div>
        ))}
      </dl>
      {grupos
        .filter((g) => g.filas.length > 0)
        .map((g) => (
          <div key={g.titulo}>
            <h3 className="text-xs font-semibold text-ink-muted uppercase">{g.titulo}</h3>
            <ul aria-label={`Filas a ${g.titulo.toLowerCase()}`} className="max-h-32 overflow-y-auto">
              {g.filas.map((f) => (
                <li key={f.fila}>
                  Línea {f.fila}: {describir(f)}
                  {f.estado ? ` (${ESTADOS_NORMATIVA[f.estado as EstadoNormativa]?.texto ?? f.estado})` : ''}
                </li>
              ))}
            </ul>
          </div>
        ))}
      {vista.rechazos.length > 0 && (
        <div className="max-h-48 overflow-y-auto">
          <Table aria-label="Rechazos de la importación">
            <thead>
              <tr>
                <Th {...NUMERICA}>Línea</Th>
                <Th>Motivo</Th>
              </tr>
            </thead>
            <tbody>
              {vista.rechazos.map((r) => (
                <tr key={`${r.fila}-${r.motivo}`}>
                  <Td {...NUMERICA}>{r.fila}</Td>
                  <Td>{r.motivo}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-1 text-xs text-ink-muted">Las filas rechazadas no se escriben.</p>
        </div>
      )}
    </section>
  )
}

// a field of a row's dialog: text, a number, a date or one of some options
export interface CampoDeDatos {
  nombre: string
  etiqueta: string
  tipo?: 'texto' | 'numero' | 'fecha' | 'opciones'
  opciones?: { valor: string; texto: string }[]
  requerido?: boolean
  // fixed once written (the tipo of a parámetro being corrected)
  fijo?: boolean
  // a line under it: the unit, what it is for
  ayuda?: string
  // the backend's name for it, when the dialog's is another (a parámetro's valor is valor_numerico or texto)
  alias?: string
}

export type Valores = Record<string, string>

// the backend's 400 by field (errors[].field), under each field; the rest above the buttons
function porCampo(error: unknown, campos: CampoDeDatos[]): { campos: Record<string, string>; resto: boolean } {
  const violaciones = error instanceof ApiError ? error.violations : []
  const de = (field: string) => campos.find((c) => c.nombre === field || c.alias === field)
  const propias = violaciones.filter((v) => de(v.field))
  return {
    campos: Object.fromEntries(propias.map((v) => [de(v.field)!.nombre, v.message])),
    resto: propias.length === 0 || propias.length < violaciones.length
  }
}

// a new row or a correction of one POR_VERIFICAR: its fields (which may depend on what is typed, as a tipo's), sent
// by `enviar`; the backend's refusal under each field
export function DialogoDeDatos<T>({
  titulo,
  descripcion,
  inicial,
  campos,
  enviar,
  accion,
  onHecho,
  onCerrar
}: {
  titulo: string
  descripcion: ReactNode
  inicial: Valores
  campos: (valores: Valores) => CampoDeDatos[]
  enviar: (valores: Valores) => Promise<T>
  accion: string
  onHecho: (resultado: T) => void
  onCerrar: () => void
}) {
  const [valores, setValores] = useState<Valores>(inicial)
  const base = useId()
  const visibles = campos(valores)
  const guardar = useMutation({ mutationFn: () => enviar(valores), onSuccess: onHecho })
  const errores = guardar.isError ? porCampo(guardar.error, visibles) : { campos: {} as Record<string, string>, resto: false }
  // a number is checked here, before it goes: es-PE, a point before the decimals
  const noNumero = (c: CampoDeDatos) => c.tipo === 'numero' && (valores[c.nombre] ?? '').trim() !== '' && parseNumber(valores[c.nombre]) === null
  const completo = visibles.every((c) => (!c.requerido || (valores[c.nombre] ?? '').trim() !== '') && !noNumero(c))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (completo && !guardar.isPending) guardar.mutate()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold">{titulo}</DialogTitle>
        <DialogDescription className="mb-3 text-sm text-ink-muted">{descripcion}</DialogDescription>
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {visibles.map((c) => {
              const id = `${base}-${c.nombre}`
              const error = noNumero(c) ? 'No es un número (use punto para los decimales)' : errores.campos[c.nombre]
              const aria = { id, 'aria-invalid': error ? (true as const) : undefined, 'aria-describedby': error ? `${id}-error` : undefined }
              const valor = valores[c.nombre] ?? ''
              const cambiar = (nuevo: string) => setValores((actuales) => ({ ...actuales, [c.nombre]: nuevo }))
              return (
                <div key={c.nombre} className={c.tipo === 'opciones' && !c.fijo ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
                  <Label htmlFor={id}>
                    {c.etiqueta}
                    {c.requerido && <span className="text-danger"> *</span>}
                  </Label>
                  {c.tipo === 'opciones' ? (
                    <NativeSelect {...aria} value={valor} disabled={c.fijo} onChange={(e) => cambiar(e.target.value)}>
                      <option value="">SELECCIONAR</option>
                      {(c.opciones ?? []).map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.texto}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      {...aria}
                      type={c.tipo === 'fecha' ? 'date' : 'text'}
                      inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
                      value={valor}
                      readOnly={c.fijo}
                      onChange={(e) => cambiar(e.target.value)}
                    />
                  )}
                  {c.ayuda && <p className="text-xs text-ink-muted">{c.ayuda}</p>}
                  {error && (
                    <p id={`${id}-error`} className="text-xs text-danger">
                      {error}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {guardar.isError && errores.resto && (
            <Alert tone="danger">
              {Object.keys(errores.campos).length > 0 ? (
                errorMessage(guardar.error, 'No se pudo guardar')
              ) : (
                <MensajeDeError error={guardar.error} siFalla="No se pudo guardar" />
              )}
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!completo || guardar.isPending}>
              {guardar.isPending && <Loader2 className="size-4 animate-spin" />}
              {accion}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// a form's text as the backend takes it: blank is null
export const textoONulo = (valor: string | undefined) => (valor ?? '').trim() || null
