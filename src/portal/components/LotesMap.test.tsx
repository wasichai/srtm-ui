import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LotesMap } from './LotesMap'

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
})
