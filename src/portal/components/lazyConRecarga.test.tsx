import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cargarConRecarga, ChunkViejoError, lazyConRecarga, type Entorno } from './lazyConRecarga'

// a sessionStorage in memory, and a reload that only counts
function entorno(inicial: Record<string, string> = {}, ahora = 1_000_000): Entorno & { datos: Map<string, string>; recargas: number } {
  const datos = new Map(Object.entries(inicial))
  const e = {
    datos,
    recargas: 0,
    storage: () =>
      ({
        getItem: (k: string) => datos.get(k) ?? null,
        setItem: (k: string, v: string) => void datos.set(k, v),
        removeItem: (k: string) => void datos.delete(k)
      }) as unknown as Storage,
    recargar: () => {
      e.recargas++
    },
    ahora: () => ahora
  }
  return e
}

const fallo = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/LotesMapImpl-viejo.js'))
const pendiente = (p: Promise<unknown>) =>
  Promise.race([
    p.then(
      () => 'resuelta',
      () => 'rechazada'
    ),
    new Promise((r) => setTimeout(() => r('pendiente'), 20))
  ])

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('cargarConRecarga', () => {
  it('reloads the page once when a chunk fails, and waits for it instead of failing', async () => {
    const e = entorno()
    const carga = cargarConRecarga('mapa', fallo, e)
    expect(await pendiente(carga)).toBe('pendiente')
    expect(e.recargas).toBe(1)
    expect(e.datos.get('srtm.recarga.mapa')).toBe('1000000')
  })

  it('does not reload again when the chunk fails right after the reload: it fails with ChunkViejoError', async () => {
    const e = entorno({ 'srtm.recarga.mapa': String(1_000_000 - 5_000) })
    await expect(cargarConRecarga('mapa', fallo, e)).rejects.toBeInstanceOf(ChunkViejoError)
    expect(e.recargas).toBe(0)
  })

  it('reloads again when the mark is old: another deploy, much later', async () => {
    const e = entorno({ 'srtm.recarga.mapa': String(1_000_000 - 10 * 60_000) })
    expect(await pendiente(cargarConRecarga('mapa', fallo, e))).toBe('pendiente')
    expect(e.recargas).toBe(1)
  })

  it('clears the mark when the chunk loads', async () => {
    const e = entorno({ 'srtm.recarga.mapa': String(1_000_000 - 5_000), 'srtm.recarga.otro': '1' })
    await expect(cargarConRecarga('mapa', () => Promise.resolve({ default: 1 }), e)).resolves.toEqual({ default: 1 })
    expect(e.datos.has('srtm.recarga.mapa')).toBe(false)
    expect(e.datos.get('srtm.recarga.otro')).toBe('1')
    expect(e.recargas).toBe(0)
  })

  it('does not loop when another chunk loads after the reload: each import has its own mark', async () => {
    const e = entorno()
    void cargarConRecarga('mapa', fallo, e)
    await pendiente(Promise.resolve())
    // after the reload: the portal loads (clears only its own mark), the map fails again
    await cargarConRecarga('portal', () => Promise.resolve({}), e)
    await expect(cargarConRecarga('mapa', fallo, e)).rejects.toBeInstanceOf(ChunkViejoError)
    expect(e.recargas).toBe(1)
  })

  it('survives a sessionStorage that throws: no reload (it could not stop a loop), a ChunkViejoError', async () => {
    const roto = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    const e = { ...entorno(), storage: roto }
    await expect(cargarConRecarga('mapa', fallo, e)).rejects.toBeInstanceOf(ChunkViejoError)
    expect(e.recargas).toBe(0)
    const s = { getItem: roto, setItem: roto, removeItem: roto } as unknown as Storage
    const e2 = { ...entorno(), storage: () => s }
    await expect(cargarConRecarga('mapa', fallo, e2)).rejects.toBeInstanceOf(ChunkViejoError)
    await expect(cargarConRecarga('mapa', () => Promise.resolve(7), e2)).resolves.toBe(7)
    expect(e2.recargas).toBe(0)
  })
})

describe('lazyConRecarga', () => {
  it('renders the component that loaded and clears its mark in the real sessionStorage', async () => {
    sessionStorage.setItem('srtm.recarga.hola', String(Date.now()))
    const Hola = lazyConRecarga('hola', () => Promise.resolve({ default: () => <p>hola</p> }))
    render(
      <Suspense>
        <Hola />
      </Suspense>
    )
    expect(await screen.findByText('hola')).toBeInTheDocument()
    expect(sessionStorage.getItem('srtm.recarga.hola')).toBeNull()
  })
})
