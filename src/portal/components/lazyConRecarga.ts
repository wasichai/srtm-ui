import { lazy, type ComponentType } from 'react'

// after a deploy, a browser that kept the previous index.html asks for chunks whose hashed names are gone: the
// import() fails (vite's preload helper fires vite:preloadError and then rejects it too, so this catches both). the
// cure is the new index.html, so the page reloads once, alone. a mark per import in sessionStorage, with its time,
// keeps it from looping: if that import fails again within VENTANA_MS of the reload, it fails for good with
// ChunkViejoError, and the error boundary around it (SinMapa) suggests a reload without the cache. the mark is
// cleared when the import loads. without a usable sessionStorage it does not reload: it could not stop a loop
export const VENTANA_MS = 60_000
const PREFIJO = 'srtm.recarga.'

export class ChunkViejoError extends Error {
  constructor(nombre: string, cause: unknown) {
    super(`No se pudo cargar «${nombre}» ni tras recargar la página`, { cause })
    this.name = 'ChunkViejoError'
  }
}

export interface Entorno {
  storage: () => Storage | undefined
  recargar: () => void
  ahora: () => number
}

const navegador: Entorno = {
  storage: () => window.sessionStorage,
  recargar: () => window.location.reload(),
  ahora: () => Date.now()
}

// sessionStorage may be missing or throw (privacy settings, a sandboxed frame): null when it cannot be used
function intentar<T>(f: () => T): T | null {
  try {
    return f()
  } catch {
    return null
  }
}

export async function cargarConRecarga<T>(nombre: string, importar: () => Promise<T>, entorno: Entorno = navegador): Promise<T> {
  const clave = PREFIJO + nombre
  try {
    const modulo = await importar()
    intentar(() => entorno.storage()?.removeItem(clave))
    return modulo
  } catch (error) {
    const storage = intentar(() => entorno.storage())
    const marca = storage ? intentar(() => ({ valor: storage.getItem(clave) })) : null
    const reciente = marca?.valor != null && entorno.ahora() - Number(marca.valor) < VENTANA_MS
    const marcada = marca && !reciente && intentar(() => (storage!.setItem(clave, String(entorno.ahora())), true))
    if (!marcada) throw new ChunkViejoError(nombre, error)
    entorno.recargar()
    // the page is going away: suspense keeps showing its fallback until it does
    return new Promise<T>(() => {})
  }
}

// React.lazy that reloads the page once when its chunk is gone (see above). nombre: its mark in sessionStorage
// C: the same bound as React.lazy's
export function lazyConRecarga<C extends ComponentType<any>>(nombre: string, importar: () => Promise<{ default: C }>) {
  return lazy(() => cargarConRecarga(nombre, importar))
}
