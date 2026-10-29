import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChunkViejoError } from './lazyConRecarga'
import { LotesMap, SinMapa } from './LotesMap'

// maplibre needs webgl: without it (or with its chunk gone after a deploy) the map throws when it starts
vi.mock('./LotesMapImpl', () => ({
  default: () => {
    throw new Error('Failed to initialize WebGL')
  }
}))

afterEach(() => vi.restoreAllMocks())

describe('LotesMap', () => {
  it('says the map cannot be shown in its own place, leaving the form around it', async () => {
    // react logs the error it caught: expected here
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // no backend: the map opens without the organization's place
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <form aria-label="Ubicación">
          <input aria-label="Manzana" defaultValue="C" />
          <LotesMap label="Mapa de predios" />
        </form>
      </QueryClientProvider>
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo mostrar el mapa en este equipo.')
    expect(screen.getByRole('textbox', { name: 'Manzana' })).toHaveValue('C')
  })

  it('suggests a reload without the cache when the chunk is still missing after reloading', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Viejo = () => {
      throw new ChunkViejoError('mapa', new TypeError('Failed to fetch dynamically imported module'))
    }
    render(
      <SinMapa aviso="Los indicadores siguen disponibles.">
        <Viejo />
      </SinMapa>
    )
    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('No se pudo mostrar el mapa en este equipo.')
    expect(alerta).toHaveTextContent('Recarga la página sin caché')
    expect(alerta).toHaveTextContent('Los indicadores siguen disponibles.')
  })
})
