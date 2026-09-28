import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from './PortalApp'
import { describirDomicilio, describirUbicacion } from './forms/direccion'
import type { LotesMapProps } from './components/LotesMap'

// the address one-liner, as the backend writes it (srtm-backend: ReglasTest has the same cases), and its live preview
// in the ubicación of a predio

vi.mock('./components/LotesMap', () => ({
  LotesMap: (props: LotesMapProps) => <div data-testid="lotes-map" aria-label={props.label} />
}))

const PERENE = { departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }

describe('describirDomicilio', () => {
  it("prints a domicilio's one-line description", () => {
    expect(
      describirDomicilio({
        tipo_via: 'CALLE',
        via: 'ADELA DELGADO DE VELEZMORO',
        numero: '234',
        letra1: 'A',
        manzana: 'C',
        lote: '19',
        tipo_unidad_urbana: 'ASENTAMIENTO HUMANO',
        unidad_urbana: 'SANTO TORIBIO DE MOGROVEJO',
        ...PERENE
      })
    ).toBe('CA. ADELA DELGADO DE VELEZMORO, N° 234 A, MZ. C, LT. 19, AA.HH. SANTO TORIBIO DE MOGROVEJO, JUNIN-CHANCHAMAYO-PERENE')
    // OTROS is not a word of the address, blanks are skipped
    expect(describirDomicilio({ tipo_via: 'OTROS', via: 'SECTOR IPANEMA', kilometro: '12', numero: ' ', departamento: 'JUNIN' })).toBe(
      'SECTOR IPANEMA, KM. 12, JUNIN'
    )
  })

  it('abbreviates the common types of via and unidad urbana as the srtm does, the rest go whole', () => {
    expect(
      ['AVENIDA', 'CALLE', 'JIRON', 'PASAJE', 'PROLONGACION', 'CARRETERA', 'CARROZABLE', 'MALECON', 'OTROS'].map((tipo) =>
        describirDomicilio({ tipo_via: tipo, via: 'A' })
      )
    ).toEqual(['AV. A', 'CA. A', 'JR. A', 'PSJE. A', 'PROL. A', 'CARR. A', 'CARROZABLE A', 'MALECON A', 'A'])
    // every tipo de unidad urbana, with the catastro fiscal's ABREV_UU
    const unidades = [
      ['AGRUPACION', 'AGRUP B'],
      ['ASENTAMIENTO HUMANO', 'AA.HH. B'],
      ['ASOCIACION', 'ASOC B'],
      ['ASOCIACION DE VIVIENDA', 'ASOC. VIV. B'],
      ['ASOCIACION DE VIVIENDA DE INTERES SOCIAL', 'ASOC.VIS. B'],
      ['ASOCIACION DE VIVIENDA E INTERES SOCIAL', 'ASOC.VIS. B'],
      ['ASOCIACION DE VIVIENDA POPULAR DE INTERES SOCIAL', 'ASOC.V.POPIS B'],
      ['ASOCIACION POPULAR URBANIZADORA', 'ASOC.PU. B'],
      ['ASOCIACION PRO VIVIENDA', 'A.P.V. B'],
      ['ASOCIACION PRO VIVIENDA DE INTERES SOCIAL', 'ASOC.PVIS. B'],
      ['ASOCIACION PRO VIVIENDA UNIDAD VECINAL', 'ASOC.PVUV. B'],
      ['BALNEARIO', 'BAL. B'],
      ['BARRIO', 'BAR B'],
      ['CASERIO', 'CAS B'],
      ['CENTRO POBLADO', 'C.P. B'],
      ['CERCADO', 'CER B'],
      ['COMPLEJO HABITACIONAL', 'C.HAB. B'],
      ['CONJUNTO HABITACIONAL', 'CONJ. HAB. B'],
      ['CONJUNTO RESIDENCIAL', 'C.R. B'],
      ['COOPERATIVA', 'COOP B'],
      ['COOPERATIVA DE VIVIENDA', 'COOP. VIV. B'],
      ['FUNDO', 'FDO B'],
      ['LOTE UNICO', 'L.U. B'],
      ['LOTIZACION', 'LOT B'],
      ['POSESION INFORMAL', 'P.I. B'],
      ['PROGRAMA', 'PRO. B'],
      ['PROGRAMA DE ADJUDICACION DE LOTES', 'P.A.L. B'],
      ['PROGRAMA DE VIVIENDA', 'P.V. B'],
      ['PROGRAMA MUNICIPAL DE VIVIENDA', 'PMV. B'],
      ['PROYECTO INTEGRAL DE LAS JUNTAS VECINALES', 'PROY.I.J.V. B'],
      ['PUEBLO JOVEN', 'P.J. B'],
      ['PUEBLO TRADICIONAL', 'P. T. B'],
      ['RESIDENCIAL', 'RES. B'],
      ['SECTOR', 'S. B'],
      ['SIN HABILITACION', 'SIN. HAB. B'],
      ['UNIDAD VECINAL', 'U.V. B'],
      ['URBANIZACION', 'URB. B'],
      ['URBANIZACION POPULAR', 'URB. POP. B'],
      ['URBANIZACION POPULAR DE INTERES SOCIAL', 'UPIS B'],
      ['URBANIZACION PRO VIVIENDA DE INTERES SOCIAL', 'UPVIS B'],
      ['ZONA', 'Z. B'],
      ['ZONA INDUSTRIAL', 'Z.I. B'],
      ['ZONA URBANA', 'Z.U. B']
    ]
    expect(unidades.map(([tipo]) => describirDomicilio({ tipo_unidad_urbana: tipo, unidad_urbana: 'B' }))).toEqual(unidades.map(([, escrita]) => escrita))
  })

  it('does not repeat a type the via or zona already starts with', () => {
    expect(describirDomicilio({ tipo_via: 'JIRON', via: 'JR. LIMA' })).toBe('JR. LIMA')
    expect(describirDomicilio({ tipo_via: 'JIRON', via: 'JIRON LIMA' })).toBe('JIRON LIMA')
    expect(describirDomicilio({ tipo_unidad_urbana: 'URBANIZACION', unidad_urbana: 'URB. LOS PINOS' })).toBe('URB. LOS PINOS')
    expect(describirDomicilio({ tipo_unidad_urbana: 'ASOCIACION DE VIVIENDA', unidad_urbana: 'ASOC. VIV. LAS VEGAS' })).toBe('ASOC. VIV. LAS VEGAS')
    // a word that only starts like the type is the name's
    expect(describirDomicilio({ tipo_via: 'CALLE', via: 'CALLEJON OSCURO' })).toBe('CA. CALLEJON OSCURO')
    // a type alone, with no name, is still written
    expect(describirDomicilio({ tipo_via: 'AVENIDA' })).toBe('AV.')
  })
})

describe('describirUbicacion', () => {
  it("writes a predio's direccion from its srtm ubicacion; an imported one keeps the padron's", () => {
    const ubicacion = {
      tipo_via: 'AVENIDA',
      via: 'ANDRES AVELINO CACERES',
      manzana: 'C',
      lote: '19',
      tipo_zona: 'URBANIZACION',
      habilitacion_urbana: 'SOL DE LA ALAMEDA',
      ...PERENE,
      direccion: 'lo que diga el cliente'
    }
    expect(describirUbicacion(ubicacion)).toBe('AV. ANDRES AVELINO CACERES, MZ. C, LT. 19, URB. SOL DE LA ALAMEDA, JUNIN-CHANCHAMAYO-PERENE')
    expect(describirUbicacion({ direccion: 'JR. LIMA Nro.: 12', via: 'JR. LIMA' })).toBe('JR. LIMA Nro.: 12')
  })

  it('reads a normalized padron predio as the srtm writes it', () => {
    expect(
      describirUbicacion({
        direccion: 'JIRON LIMA Nro.: 12 Mz.: A Lt.: 5 Km.: 1 CERCADO II MESETA',
        tipo_via: 'JIRON',
        via: 'LIMA',
        numero: '12',
        manzana: 'A',
        lote: '5',
        kilometro: '1',
        tipo_zona: 'CERCADO',
        habilitacion_urbana: 'II MESETA',
        ...PERENE
      })
    ).toBe('JR. LIMA, N° 12, MZ. A, LT. 5, KM. 1, CER II MESETA, JUNIN-CHANCHAMAYO-PERENE')
  })
})

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }
const year = new Date().getFullYear()
const DEL_PADRON = 'JIRON LIMA Nro.: 12 Mz.: A Lt.: 5 CERCADO II MESETA'
// a predio of the padrón, normalized: no registration number, its padrón text in direccion
const predio = {
  id: 'p1',
  codigo: '01-01-0001',
  tipo_predio: 'PREDIO URBANO',
  direccion: DEL_PADRON,
  ubigeo: '120302',
  ...PERENE,
  region: 'SELVA',
  tipo_via: 'JIRON',
  via: 'LIMA',
  numero: '12',
  manzana: 'A',
  lote: '5',
  tipo_zona: 'CERCADO',
  habilitacion_urbana: 'II MESETA'
}
const totales = { declaraciones: 0, autoavaluo: 0, valor_afecto: 0 }
const page = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

const routes: MockRoute[] = [
  { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
  { path: '/auth/me/preferences', body: { theme: 'system', locale: null } },
  {
    path: '/srtm/catalogos',
    body: {
      predio: {
        tipo_predio: ['PREDIO URBANO', 'PREDIO RUSTICO'],
        region: ['COSTA', 'SIERRA', 'SELVA'],
        tipo_via: ['AVENIDA', 'CALLE', 'JIRON'],
        tipo_zona: ['URBANIZACION', 'CERCADO']
      },
      declaracion_predial: { medio_presentacion: ['FISICO'], tipo_adquisicion: ['COMPRA'], condicion_propiedad: ['PROPIETARIO UNICO'] }
    }
  },
  { path: '/srtm/ubigeos', body: [{ codigo: '120302', ...PERENE }] },
  { path: '/srtm/vias', body: page([]) },
  { path: '/srtm/unidades-urbanas', body: page([]) },
  { path: '/srtm/predios/p1/declaraciones', body: [] }
]

let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => fetch?.restore())

function start(path: string, extra: MockRoute[] = []) {
  localStorage.setItem('srtm.token', 't')
  localStorage.setItem('srtm.user', JSON.stringify(admin))
  window.history.pushState({}, '', path)
  fetch = mockFetch([...extra, ...routes])
  render(<PortalApp />)
}

const preview = () => screen.getByRole('status', { name: 'Vista previa de la dirección' })

describe('the ubicacion of a predio', () => {
  it("shows the padron's direccion, and previews the srtm's as it is edited", async () => {
    start('/predios/p1', [{ path: '/srtm/predios/p1', body: { predio, anio: year, titulares: 0, totales } }])
    // reading: the stored direccion is there
    expect(await screen.findByText(DEL_PADRON)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Dirección actual')).toHaveValue(DEL_PADRON)
    expect(preview()).toHaveTextContent('JR. LIMA, N° 12, MZ. A, LT. 5, CER II MESETA, JUNIN-CHANCHAMAYO-PERENE')
    await userEvent.clear(screen.getByLabelText('Número principal'))
    await userEvent.type(screen.getByLabelText('Número principal'), '14')
    expect(preview()).toHaveTextContent('JR. LIMA, N° 14, MZ. A, LT. 5, CER II MESETA, JUNIN-CHANCHAMAYO-PERENE')
  })

  it("keeps the padron's text until the predio gets a tipo de via, as the backend does", async () => {
    const sinTipo = { ...predio, tipo_via: null, via: 'JIRON LIMA', tipo_zona: null, habilitacion_urbana: 'CERCADO II MESETA' }
    start('/predios/p1', [{ path: '/srtm/predios/p1', body: { predio: sinTipo, anio: year, titulares: 0, totales } }])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    expect(preview()).toHaveTextContent(DEL_PADRON)
    expect(screen.getByText('Sin tipo de vía se conserva la dirección del padrón.')).toBeInTheDocument()
    // the vía still carries its type: picking it does not write it twice
    await userEvent.selectOptions(screen.getByLabelText(/Tipo de vía/), 'JIRON')
    await waitFor(() => expect(preview()).toHaveTextContent('JIRON LIMA, N° 12, MZ. A, LT. 5, CERCADO II MESETA, JUNIN-CHANCHAMAYO-PERENE'))
    expect(screen.queryByText('Sin tipo de vía se conserva la dirección del padrón.')).not.toBeInTheDocument()
  })

  it("a new declaration's secuencia de uso has the padron's three digits", async () => {
    const contribuyente = { id: 'c1', tipo_persona: 'NATURAL', numero_documento: '20529936', nombre_completo: 'QUISPE MAMANI JUAN' }
    start('/contribuyentes/c1/declaraciones/nueva', [{ path: '/srtm/contribuyentes/c1', body: { contribuyente, anio: year, predios: 0, totales } }])
    expect(await screen.findByLabelText(/Secuencia de uso/)).toHaveValue('001')
  })

  it('a new predio has no stored direccion, only the preview', async () => {
    start('/predios/nuevo')
    expect(await screen.findByRole('heading', { name: 'Nuevo predio' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Dirección actual')).not.toBeInTheDocument()
    await userEvent.selectOptions(await screen.findByLabelText(/Tipo de vía/), 'AVENIDA')
    await userEvent.type(screen.getByLabelText(/Descripción de la vía/), 'MARGINAL')
    expect(preview()).toHaveTextContent(/^AV\. MARGINAL/)
  })
})
