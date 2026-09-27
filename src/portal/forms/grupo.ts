import { useCallback, useRef, useState } from 'react'
import type { FormValues } from './specs'

// forms edited in place and saved by one button outside them (the declaración's header saves all its tabs at once)

// what such a form hands over
export interface FormHandle {
  // once the form is valid, what the clerk changed in it (the fields it sends, as it sends them); null while it is
  // not: the errors show under the fields
  cambios: () => Promise<Record<string, unknown> | null>
  // the same, but everything it sends (as its onSubmit gets it): what a wizard presents
  valores: () => Promise<Record<string, unknown> | null>
  // the backend's violations of this form's fields, under them (above its buttons the ones with no input): whether it
  // had any
  errores: (error: unknown) => boolean
}

// RecordForm's `enlace`: where its handle goes, and where it says whether it has changes
export interface Enlace {
  handle?: (handle: FormHandle | null) => void
  cambios?: (pendiente: boolean) => void
}

// the forms of a page, by name: which have changes (in the order given), and their changes once all are valid
export function useGrupoFormularios<N extends string>(nombres: readonly N[]) {
  const handles = useRef(new Map<N, FormHandle>())
  const [conCambios, setConCambios] = useState<N[]>([])
  const [enlaces] = useState(
    () =>
      Object.fromEntries(
        nombres.map((nombre): [N, Enlace] => [
          nombre,
          {
            handle: (handle) => {
              if (handle) handles.current.set(nombre, handle)
              else handles.current.delete(nombre)
            },
            cambios: (pendiente) =>
              setConCambios((actual) => (pendiente ? (actual.includes(nombre) ? actual : [...actual, nombre]) : actual.filter((n) => n !== nombre)))
          }
        ])
      ) as Record<N, Enlace>
  )
  const pendientes = nombres.filter((nombre) => conCambios.includes(nombre))

  // every pending form is validated (each shows its own errors): their changes, and the ones not valid
  const cambios = async () => {
    const valores: Partial<Record<N, Record<string, unknown>>> = {}
    const invalidos: N[] = []
    for (const nombre of pendientes) {
      const handle = handles.current.get(nombre)
      if (!handle) continue
      const cambiado = await handle.cambios()
      if (cambiado) valores[nombre] = cambiado
      else invalidos.push(nombre)
    }
    return { valores, invalidos }
  }
  // one form's values, once valid; null while it is not (or it is not there)
  const valores = async (nombre: N) => (await handles.current.get(nombre)?.valores()) ?? null
  // the backend's refusal, to the forms it may be about: the ones that took a violation of one of their fields
  const errores = (error: unknown, de: N[]) => nombres.filter((nombre) => de.includes(nombre) && handles.current.get(nombre)?.errores(error))

  return { enlaces, pendientes, cambios, valores, errores }
}

// RecordForm's `comun`: fields that are one value in several forms of a page (the predio's tipo, in datos del predio
// and in the ubicación). what the clerk sets in one, the others take
export interface Comun {
  campos: readonly string[]
  // the last value the clerk set, by field: none until then
  valores: FormValues
  cambiar: (name: string, value: string) => void
}

// those fields, for the forms of a page. empty again (reiniciar) when the forms start over from the record
export function useComun(campos: readonly string[]) {
  const [valores, setValores] = useState<FormValues>({})
  const cambiar = useCallback((name: string, value: string) => setValores((actual) => (actual[name] === value ? actual : { ...actual, [name]: value })), [])
  const reiniciar = useCallback(() => setValores({}), [])
  return { campos, valores, cambiar, reiniciar }
}
