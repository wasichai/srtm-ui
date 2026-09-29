import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordForm } from '../kit/forms/RecordForm'
import { UBICACION_SECTIONS } from './forms/declaracionSpecs'
import { ABREVIATURA_UNIDAD_URBANA, describirUbicacion } from './forms/direccion'
import { etiqueta } from './forms/etiquetas'
import { DOMICILIO_SECTIONS } from './forms/specs'

// the tipos de unidad urbana are the catastro fiscal's TIPO_UU (srtm-backend's model/data/tipos_unidad_urbana.csv), in
// page 5's order: the selects show them as they are, without accents, and the address writes their ABREV_UU

// jsdom has no webgl: the map is not what these tests look at
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const TIPOS = Object.keys(ABREVIATURA_UNIDAD_URBANA)
const page = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

let fetch: FetchMock | null = null
afterEach(() => fetch?.restore())

function conDatos(ui: React.ReactNode) {
  fetch = mockFetch([
    { path: '/srtm/ubigeos', body: [] },
    { path: '/srtm/vias', body: page([]) }
  ])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

const opciones = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((o) => [o.getAttribute('value'), o.textContent])

describe('tipos de unidad urbana del catastro fiscal', () => {
  it('has the 43 of TIPO_UU, sorted as page 5 lists them', () => {
    expect(TIPOS).toHaveLength(43)
    expect(TIPOS).toEqual([...TIPOS].sort())
    expect(TIPOS.slice(0, 6)).toEqual([
      'AGRUPACION',
      'ASENTAMIENTO HUMANO',
      'ASOCIACION',
      'ASOCIACION DE VIVIENDA',
      'ASOCIACION DE VIVIENDA DE INTERES SOCIAL',
      'ASOCIACION DE VIVIENDA E INTERES SOCIAL'
    ])
  })

  it('labels each as it is, in the domicilio and in the zona of the predio', () => {
    for (const campo of ['tipo_unidad_urbana', 'tipo_zona']) {
      expect(TIPOS.map((tipo) => etiqueta(campo, tipo))).toEqual(TIPOS)
    }
  })

  it("offers them in the domicilio's select as the catalog lists them", () => {
    conDatos(<RecordForm sections={DOMICILIO_SECTIONS} options={{ tipo_unidad_urbana: TIPOS }} initial={{}} submitLabel="Grabar" onSubmit={vi.fn()} />)
    expect(opciones(screen.getByLabelText(/Tipo unidad urbana/))).toEqual([['', 'SELECCIONAR'], ...TIPOS.map((tipo) => [tipo, tipo])])
  })

  it("offers them in the predio's zona as the catalog lists them", () => {
    conDatos(<RecordForm sections={UBICACION_SECTIONS} options={{ tipo_zona: TIPOS }} initial={{}} submitLabel="Grabar" onSubmit={vi.fn()} />)
    expect(opciones(screen.getByLabelText(/^Zona/))).toEqual([['', 'SELECCIONAR'], ...TIPOS.map((tipo) => [tipo, tipo])])
  })

  it("writes a predio's zona with its ABREV_UU", () => {
    expect(describirUbicacion({ tipo_via: 'CALLE', via: 'LIMA', tipo_zona: 'CENTRO POBLADO', habilitacion_urbana: 'MIRICHARO' })).toBe(
      'CA. LIMA, C.P. MIRICHARO'
    )
    expect(describirUbicacion({ tipo_via: 'CALLE', via: 'LIMA', tipo_zona: 'SECTOR', habilitacion_urbana: '10 DE OCTUBRE' })).toBe('CA. LIMA, S. 10 DE OCTUBRE')
  })
})
