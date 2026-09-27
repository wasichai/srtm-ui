import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { describirDomicilio } from './forms/direccion'
import { RecordForm } from './forms/RecordForm'
import { DOMICILIO_SECTIONS } from './forms/specs'

// the two tipos de unidad urbana page 5 cuts ("ASOCIACION DE VIVIENDA D…", "…E I…"), named as the catastro fiscal's
// TIPO_UU domain (srtm-backend's model.json): the srtm writes its address catalogs as they are, without accents

// jsdom has no webgl: the map is not what these tests look at
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const NUEVAS = ['ASOCIACION DE VIVIENDA DE INTERES SOCIAL', 'ASOCIACION DE VIVIENDA E INTERES SOCIAL']
// page 5's list, as far as it shows
const PAGINA_5 = ['AGRUPACION', 'ASENTAMIENTO HUMANO', 'ASOCIACION', 'ASOCIACION DE VIVIENDA', ...NUEVAS]

let fetch: FetchMock | null = null
afterEach(() => fetch?.restore())

describe('tipos de unidad urbana de la pág. 5', () => {
  it('offers them in the domicilio as the srtm writes them', () => {
    fetch = mockFetch([{ path: '/srtm/ubigeos', body: [] }])
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <RecordForm sections={DOMICILIO_SECTIONS} options={{ tipo_unidad_urbana: PAGINA_5 }} initial={{}} submitLabel="Grabar" onSubmit={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    )
    const opciones = within(screen.getByLabelText(/Tipo unidad urbana/))
      .getAllByRole('option')
      .map((o) => [o.getAttribute('value'), o.textContent])
    expect(opciones).toEqual([['', 'SELECCIONAR'], ...PAGINA_5.map((tipo) => [tipo, tipo])])
  })

  it('writes both with the ABREV_UU they share, ASOC.VIS.', () => {
    expect(NUEVAS.map((tipo) => describirDomicilio({ tipo_unidad_urbana: tipo, unidad_urbana: 'LOS PINOS' }))).toEqual([
      'ASOC.VIS. LOS PINOS',
      'ASOC.VIS. LOS PINOS'
    ])
  })
})
