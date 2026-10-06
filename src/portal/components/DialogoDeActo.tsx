import { useMutation } from '@tanstack/react-query'
import { ApiError } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Label, Textarea } from '@wasichai/ui'
import { Loader2 } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../kit/ui/errorMessage'
import { RentasError } from '../api'
import type { Falta } from '../types'

// every act asks why (srtm.Observacion): 5 to 500 characters, kept in its row
export const OBSERVACION_MINIMA = 5
export const OBSERVACION_MAXIMA = 500

export interface DialogoDeActoProps<T> {
  titulo: string
  descripcion?: ReactNode
  // what the clerk should know before writing
  avisos?: string[]
  // the act's own fields, above the observación
  children?: ReactNode
  // whether the act's own fields can be sent (the observación is checked here)
  completo?: boolean
  // the help under the observación, before its length: "Por qué se determina"
  porQue?: string
  // the submit button: "Determinar", "Crear versión"
  accion: string
  // what a failure says when the backend says nothing usable
  siFalla: string
  // writes the act with the observación, trimmed
  enviar: (observacion: string) => Promise<T>
  // after it is written (refresh what reads it)
  onExito?: (resultado: T) => unknown
  // what the dialog says once written, with a button to close it; without it the dialog closes itself
  exito?: (resultado: T) => ReactNode
  onCerrar: () => void
}

// what a fetch that got no answer says: the request may or may not have arrived, and the act is not written twice
export const SIN_RESPUESTA = 'No hubo respuesta del servidor. Vuelva a intentarlo: el acto no se registra dos veces.'

// fetch rejects with a TypeError when no answer came (Chrome «Failed to fetch», Firefox «NetworkError…», Safari «Load
// failed»): any other TypeError is a bug of its own and says what it says
const sinRespuesta = (error: unknown) => error instanceof TypeError && /failed to fetch|networkerror|load failed|network request failed/i.test(error.message)

// a failure in the portal's words: the backend's detail, what it lacks to compute (faltan) and the fields it refused;
// no answer at all, in words a clerk can act on
export function MensajeDeError({ error, siFalla }: { error: unknown; siFalla: string }) {
  if (sinRespuesta(error)) return <>{SIN_RESPUESTA}</>
  const faltan = error instanceof RentasError ? error.faltan : []
  const faltanDetalle = error instanceof RentasError ? error.faltanDetalle : []
  const campos = error instanceof ApiError ? error.violations : []
  return (
    <>
      {errorMessage(error, siFalla)}
      {faltan.length > 0 && <> Falta: {faltanDetalle.length > 0 ? <FaltanDetalle faltan={faltanDetalle} /> : <>{faltan.join('; ')}</>}.</>}
      {campos.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {campos.map((c) => (
            <li key={`${c.field}-${c.message}`}>
              {c.field}: {c.message}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// each Falta of an arbitrios' faltan_detalle, mensaje by mensaje, linked by its enlace (where it gets fixed, not whose
// it is): DECLARACION, to its declaración's características; PREDIO, to its predio's ubicación; anything else (a row
// of the ordinance, which names the predio too), or without the id to link to, plain text, as faltan always showed.
// the portal's generic FaltanArbitrios carries detalle only from arbitrios (ArbitriosController.problemaFaltan); any
// other 422's faltan has no detalle, and falls back to it above
export function FaltanDetalle({ faltan }: { faltan: Falta[] }) {
  return (
    <>
      {faltan.map((f, i) => (
        <span key={f.mensaje}>
          {i > 0 && '; '}
          <FaltaEnlace falta={f} />
        </span>
      ))}
    </>
  )
}

function FaltaEnlace({ falta }: { falta: Falta }) {
  if (falta.enlace === 'DECLARACION' && falta.declaracion) {
    return (
      <Link to={`/declaraciones/${falta.declaracion}?tab=caracteristicas`} className="text-link hover:underline">
        {falta.mensaje}
      </Link>
    )
  }
  if (falta.enlace === 'PREDIO' && falta.predio) {
    return (
      <Link to={`/predios/${falta.predio}?tab=ubicacion`} className="text-link hover:underline">
        {falta.mensaje}
      </Link>
    )
  }
  return <>{falta.mensaje}</>
}

// the confirmation of an act (a determinación, a version of the CUIS, a descargo…): its fields, the observación with
// its length, the submit disabled until both are valid, the backend's error inside, and what was written. the opener
// mounts it while open and unmounts it on onCerrar, so each opening starts blank
export function DialogoDeActo<T>({
  titulo,
  descripcion,
  avisos = [],
  children,
  completo = true,
  porQue = 'Por qué',
  accion,
  siFalla,
  enviar,
  onExito,
  exito,
  onCerrar
}: DialogoDeActoProps<T>) {
  const [observacion, setObservacion] = useState('')
  const campo = useId()
  const acto = useMutation({
    mutationFn: () => enviar(observacion.trim()),
    onSuccess: (resultado) => {
      onExito?.(resultado)
      if (!exito) onCerrar()
    }
  })
  const largo = observacion.trim().length
  const valida = largo >= OBSERVACION_MINIMA && largo <= OBSERVACION_MAXIMA
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valida && completo && !acto.isPending) acto.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold">{titulo}</DialogTitle>
        {descripcion && <DialogDescription className="mb-3 text-sm text-ink-muted">{descripcion}</DialogDescription>}
        {avisos.map((aviso) => (
          <Alert key={aviso} tone="notice" className="mb-2">
            {aviso}
          </Alert>
        ))}
        {acto.isSuccess && exito ? (
          <div className="space-y-3">
            {exito(acto.data)}
            <div className="flex justify-end">
              <Button onClick={onCerrar}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {children}
            <div className="space-y-1">
              <Label htmlFor={campo}>Observación</Label>
              <Textarea id={campo} value={observacion} rows={3} maxLength={OBSERVACION_MAXIMA + 50} onChange={(e) => setObservacion(e.target.value)} />
              <p className="text-xs text-ink-muted">
                {porQue}: de {OBSERVACION_MINIMA} a {OBSERVACION_MAXIMA} caracteres ({largo}).
              </p>
            </div>
            {acto.isError && (
              <Alert tone="danger">
                <MensajeDeError error={acto.error} siFalla={siFalla} />
              </Alert>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!valida || !completo || acto.isPending}>
                {acto.isPending && <Loader2 className="size-4 animate-spin" />}
                {accion}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
