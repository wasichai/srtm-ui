import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordForm } from '../kit/forms/RecordForm'
import { NIVEL_SECTIONS } from './forms/declaracionSpecs'

// which letters of a nivel de construcción are valued: the cuadros de valores unitarios oficiales de edificación from the
// ejercicio 2023 on have three columns only (R.D. 003-2022-VIVIENDA/VMVU-DGPRVU), and the srtm greys the other four for
// a construction of 2023 on (Presentacion2_.pdf, pages 16 and 17)

const year = new Date().getFullYear()

let fetch: FetchMock | null = null
afterEach(() => fetch?.restore())

const categorias = [
  { columna: 1, categoria: 'MUROS Y COLUMNAS', letra: 'C', descripcion: 'PLACAS DE CONCRETO (E= 10 A 15 CM), ALBAÑILERÍA ARMADA' },
  { columna: 2, categoria: 'TECHOS', letra: 'C', descripcion: 'ALIGERADO O LOSAS DE CONCRETO ARMADO HORIZONTALES' },
  { columna: 3, categoria: 'PISOS', letra: 'D', descripcion: 'PARQUET DE 1ERA., LAJAS, CERÁMICA NACIONAL' },
  { columna: 4, categoria: 'PUERTAS Y VENTANAS', letra: 'D', descripcion: 'VENTANAS DE ALUMINIO, PUERTAS DE MADERA SELECTA, VIDRIO TRATADO TRANSPARENTE' },
  { columna: 5, categoria: 'REVESTIMIENTOS', letra: 'F', descripcion: 'TARRAJEO FROTACHADO Y/O YESO MOLDURADO, PINTURA LAVABLE' },
  { columna: 6, categoria: 'BAÑOS', letra: 'E', descripcion: 'BAÑOS CON MAYÓLICA BLANCA, PARCIAL' },
  { columna: 7, categoria: 'INSTALACIONES ELÉCTRICAS Y SANITARIAS', letra: 'D', descripcion: 'AGUA FRÍA, AGUA CALIENTE, CORRIENTE TRIFÁSICA, TELÉFONO' }
]

// the nivel of page 16
const nivel = {
  tipo_nivel: 'PISO',
  numero_piso: 1,
  anio_construccion: 2023,
  mes_construccion: 1,
  material: 'LADRILLO',
  estado_conservacion: 'BUENO',
  area_construida: 200,
  muros_columnas: 'C',
  techos: 'C',
  puertas_ventanas: 'D'
}
// what an older nivel, of the seven columns, has in the other four
const cuatro = { pisos: 'D', revestimientos: 'F', banos: 'E', instalaciones: 'D' }

function nivelDe(initial: Record<string, unknown>) {
  const onSubmit = vi.fn(async () => {})
  fetch = mockFetch([{ path: '/srtm/categorias-valor', body: categorias }])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RecordForm
          sections={NIVEL_SECTIONS}
          options={{ tipo_nivel: ['PISO'], material: ['LADRILLO'], estado_conservacion: ['BUENO'] }}
          initial={initial}
          submitLabel="Grabar"
          onSubmit={onSubmit}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return onSubmit
}

const valuadas = [/^Muros y columnas/, /^Techos/, /^Puertas y ventanas/]
const sinValor = [/^Pisos/, /^Revestimientos/, /^Baños/, /^Instalaciones de E\/S/]
const etiquetaDe = (name: string) => document.querySelector(`label[for="field-${name}"]`)

describe("a nivel de construcción's categorías (pages 16 and 17)", () => {
  it('greys pisos, revestimientos, baños and instalaciones of the construction of 2023 on page 16, and sends them empty', async () => {
    const onSubmit = nivelDe(nivel)
    await screen.findByText(/VENTANAS DE ALUMINIO, PUERTAS DE MADERA SELECTA/)
    for (const label of valuadas) expect(screen.getByLabelText(label)).toBeEnabled()
    for (const label of sinValor) expect(screen.getByLabelText(label)).toBeDisabled()
    for (const name of ['muros_columnas', 'techos', 'puertas_ventanas']) expect(etiquetaDe(name)).toHaveTextContent('*')
    for (const name of ['pisos', 'revestimientos', 'banos', 'instalaciones']) expect(etiquetaDe(name)).not.toHaveTextContent('*')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          anio_construccion: 2023,
          muros_columnas: 'C',
          techos: 'C',
          puertas_ventanas: 'D',
          pisos: null,
          revestimientos: null,
          banos: null,
          instalaciones: null
        })
      )
    )
  })

  it.each([2024, year])('greys them for a construction of %i too (page 17), and clears what an imported one had', async (anio) => {
    const onSubmit = nivelDe({ ...nivel, ...cuatro, anio_construccion: anio })
    for (const label of sinValor) {
      expect(screen.getByLabelText(label)).toBeDisabled()
      expect(screen.getByLabelText(label)).toHaveValue('')
    }
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ pisos: null, revestimientos: null, banos: null, instalaciones: null })))
  })

  it('lets a construction of 2022, of the cuadro of seven columns, have them, and keeps the ones it has', async () => {
    const onSubmit = nivelDe({ ...nivel, ...cuatro, anio_construccion: 2022 })
    for (const label of [...valuadas, ...sinValor]) expect(screen.getByLabelText(label)).toBeEnabled()
    expect(screen.getByLabelText(/^Pisos/)).toHaveValue('D')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ anio_construccion: 2022, ...cuatro })))
  })

  it('asks a construction before 2023 for all seven, as the manual shows one of 2019 (M01-1-014, page 65)', async () => {
    const onSubmit = nivelDe({ ...nivel, anio_construccion: 2019 })
    for (const name of ['muros_columnas', 'techos', 'pisos', 'puertas_ventanas', 'revestimientos', 'banos', 'instalaciones'])
      expect(etiquetaDe(name)).toHaveTextContent('*')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    expect(await screen.findAllByText('Este dato es obligatorio')).toHaveLength(4)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('greys them as soon as the año de construcción becomes 2023, and lets them be picked again before it', async () => {
    nivelDe({ ...nivel, anio_construccion: 1995 })
    for (const label of sinValor) expect(screen.getByLabelText(label)).toBeEnabled()
    await userEvent.selectOptions(screen.getByLabelText(/Año construcción/), '2023')
    for (const label of sinValor) expect(screen.getByLabelText(label)).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText(/Año construcción/), '2022')
    for (const label of sinValor) expect(screen.getByLabelText(label)).toBeEnabled()
  })
})
