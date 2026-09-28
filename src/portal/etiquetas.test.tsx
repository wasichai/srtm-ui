import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DJ_DATOS_SECTIONS, FRENTE_SECTIONS, NIVEL_SECTIONS, OBRA_SECTIONS, UBICACION_SECTIONS } from './forms/declaracionSpecs'
import { ABREVIATURA_VIA } from './forms/direccion'
import { FieldGrid } from './forms/FieldGrid'
import { RecordForm } from './forms/RecordForm'
import { CONTRIBUYENTE_SECTIONS } from './forms/specs'
import { BuscarPrediosDialog } from './pages/BuscarPrediosDialog'

// the srtm's controls and wording (Presentacion2_.pdf, pages 2 to 21): the options show as the srtm writes them,
// the records keep the model's plain values

// jsdom has no webgl: the map is not what these tests look at
vi.mock('./components/LotesMap', () => ({ LotesMap: () => null }))

const page = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })

let fetch: FetchMock | null = null
afterEach(() => fetch?.restore())

// what the forms' own lookups (vías, categorías) ask for, answered empty
function conDatos(ui: ReactNode, routes: MockRoute[] = []) {
  fetch = mockFetch([...routes, { path: '/srtm/vias', body: page([]) }])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

// a select's options as [value, what it shows]
const opciones = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((o) => [o.getAttribute('value'), o.textContent])
// what the ficha shows under a label
const valor = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent

const contribuyente = {
  codigo: null,
  numero_declaracion: null,
  fecha_registro: null,
  motivo: 'INSCRIPCION',
  medio_determinacion: 'DECLARACION JURADA',
  medio_presentacion: 'FISICO',
  modificacion_oficio: null,
  fecha_presentacion: '2026-09-24',
  tipo_contribuyente: 'PERSONA NATURAL',
  codigo_anterior: null,
  tipo_persona: 'NATURAL',
  tipo_documento: 'DNI',
  numero_documento: '43554564',
  fuente_informacion: 'MANUAL',
  apellido_paterno: 'FLORES',
  apellido_materno: 'OTINIANO',
  nombres: 'JUNIOR PAOLO',
  fecha_nacimiento: null,
  fecha_fallecimiento: null,
  estado_civil: 'SOLTERO',
  sexo: 'HOMBRE',
  razon_social: null,
  nombre_completo: null,
  observacion: null
}

const catalogoContribuyente = {
  medio_presentacion: ['FISICO', 'VIRTUAL'],
  tipo_contribuyente: ['PERSONA NATURAL', 'PERSONA JURIDICA', 'SOCIEDAD CONYUGAL', 'SUCESION INDIVISA', 'SOCIEDAD IRREGULAR', 'OTROS PATRIMONIOS AUTONOMOS'],
  tipo_documento: ['SIN DOCUMENTO', 'DNI', 'CARNET DE EXTRANJERIA', 'RUC', 'PASAPORTE', 'PTP-CPP', 'CI', 'OTROS'],
  fuente_informacion: ['MANUAL', 'PIDE RENIEC'],
  estado_civil: ['SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO', 'CONVIVIENTE'],
  sexo: ['HOMBRE', 'MUJER']
}

describe('the selects show the srtm wording', () => {
  it('labels the options with their accents and the (A) of estado civil (pages 2 and 3)', () => {
    render(<RecordForm sections={CONTRIBUYENTE_SECTIONS} options={catalogoContribuyente} initial={contribuyente} submitLabel="Grabar" onSubmit={vi.fn()} />)
    expect(opciones(screen.getByLabelText(/Tipo de contribuyente/))).toEqual([
      ['', 'SELECCIONAR'],
      ['PERSONA NATURAL', 'PERSONA NATURAL'],
      ['PERSONA JURIDICA', 'PERSONA JURÍDICA'],
      ['SOCIEDAD CONYUGAL', 'SOCIEDAD CONYUGAL'],
      ['SUCESION INDIVISA', 'SUCESIÓN INDIVISA'],
      ['SOCIEDAD IRREGULAR', 'SOCIEDAD IRREGULAR'],
      ['OTROS PATRIMONIOS AUTONOMOS', 'OTROS PATRIMONIOS AUTÓNOMOS']
    ])
    expect(opciones(screen.getByLabelText(/Estado civil/))).toEqual([
      ['', 'SELECCIONAR'],
      ['SOLTERO', 'SOLTERO(A)'],
      ['CASADO', 'CASADO(A)'],
      ['VIUDO', 'VIUDO(A)'],
      ['DIVORCIADO', 'DIVORCIADO(A)'],
      ['CONVIVIENTE', 'CONVIVIENTE']
    ])
    expect(opciones(screen.getByLabelText(/Medio de presentación/))).toContainEqual(['FISICO', 'FÍSICO'])
    // the srtm's manuals (M01-1-012): DNI, pasaporte, CE, PTP / CPP, CI, S/D
    expect(opciones(screen.getByLabelText(/Tipo de documento/))).toEqual(
      expect.arrayContaining([
        ['CARNET DE EXTRANJERIA', 'CARNET DE EXTRANJERÍA'],
        ['PTP-CPP', 'PTP / CPP'],
        ['CI', 'CI']
      ])
    )
  })

  it('shows a read-only option by its label too', () => {
    render(<RecordForm sections={CONTRIBUYENTE_SECTIONS} options={catalogoContribuyente} initial={contribuyente} submitLabel="Grabar" onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/Medio de determinación/)).toHaveValue('DECLARACIÓN JURADA')
  })

  it('sends the plain value of the option picked', async () => {
    const onSubmit = vi.fn(async () => {})
    render(<RecordForm sections={CONTRIBUYENTE_SECTIONS} options={catalogoContribuyente} initial={contribuyente} submitLabel="Grabar" onSubmit={onSubmit} />)
    await userEvent.selectOptions(screen.getByLabelText(/Estado civil/), 'CASADO(A)')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ estado_civil: 'CASADO', medio_presentacion: 'FISICO', tipo_contribuyente: 'PERSONA NATURAL' })
    )
  })

  it('keeps a stored value the catalog no longer offers, with its label', () => {
    render(
      <RecordForm
        sections={CONTRIBUYENTE_SECTIONS}
        options={{ ...catalogoContribuyente, estado_civil: ['SOLTERO', 'CASADO'] }}
        initial={{ ...contribuyente, estado_civil: 'VIUDO' }}
        submitLabel="Grabar"
        onSubmit={vi.fn()}
      />
    )
    const select = screen.getByLabelText(/Estado civil/)
    expect(opciones(select)[1]).toEqual(['VIUDO', 'VIUDO(A)'])
    expect(select).toHaveValue('VIUDO')
  })

  it('names the tipo de vía by the abbreviation of the address (pages 6 and 14) and sends the whole word', async () => {
    const onSubmit = vi.fn(async () => {})
    const frente = { tipo_via: 'JIRON', via: 'LIMA', numero: null, numero_alterno: null, frontis: 7, lote: null, cuadra: null, lado: null, estado: 'ACTIVO' }
    conDatos(
      <RecordForm
        sections={FRENTE_SECTIONS}
        options={{ tipo_via: [...Object.keys(ABREVIATURA_VIA), 'MALECON'], lado: ['PAR', 'IMPAR'], estado: ['ACTIVO'] }}
        initial={frente}
        submitLabel="Grabar"
        onSubmit={onSubmit}
      />
    )
    // the same table as the address: a type without an abbreviation goes whole
    expect(opciones(screen.getByLabelText(/Tipo vía/))).toEqual([['', 'SELECCIONAR'], ...Object.entries(ABREVIATURA_VIA), ['MALECON', 'MALECON']])
    expect(opciones(screen.getByLabelText(/Tipo vía/))).toContainEqual(['AVENIDA', 'AV.'])
    await userEvent.selectOptions(screen.getByLabelText(/Tipo vía/), 'CA.')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tipo_via: 'CALLE' }))
  })

  it('shows a tipo de vía the lote locked by its abbreviation, and still sends the word', async () => {
    const onSubmit = vi.fn(async () => {})
    const frente = {
      tipo_via: 'AVENIDA',
      via: 'MARGINAL',
      numero: null,
      numero_alterno: null,
      frontis: 7,
      lote: null,
      cuadra: null,
      lado: null,
      estado: 'ACTIVO'
    }
    conDatos(
      <RecordForm
        sections={FRENTE_SECTIONS}
        options={{ tipo_via: ['AVENIDA'] }}
        initial={frente}
        bloqueados={['tipo_via']}
        submitLabel="Grabar"
        onSubmit={onSubmit}
      />
    )
    expect(screen.getByLabelText(/Tipo vía/)).toBeDisabled()
    expect(screen.getByLabelText(/Tipo vía/)).toHaveValue('AV.')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tipo_via: 'AVENIDA' }))
  })

  it('labels the documentos de sustento with their accents and sends them plain', async () => {
    const onSubmit = vi.fn(async () => {})
    const datos = {
      tipo_predio: 'PREDIO URBANO',
      medio_presentacion: 'FISICO',
      fecha_presentacion: '2026-09-24',
      anio: 2026,
      secuencia_uso: '001',
      tipo_adquisicion: 'COMPRA',
      fecha_adquisicion: '2024-09-04',
      condicion_propiedad: 'PROPIETARIO UNICO',
      porcentaje_condominio: 100,
      folios: 2,
      documentos_sustento: 'MINUTA'
    }
    render(
      <RecordForm
        sections={DJ_DATOS_SECTIONS}
        options={{
          tipo_predio: ['PREDIO URBANO', 'PREDIO RUSTICO'],
          medio_presentacion: ['FISICO'],
          tipo_adquisicion: ['COMPRA'],
          condicion_propiedad: ['PROPIETARIO UNICO', 'CONDOMINO']
        }}
        initial={datos}
        submitLabel="Grabar"
        onSubmit={onSubmit}
      />
    )
    // page 11: PREDIO URBANO, PREDIO RÚSTICO; page 12: PROPIETARIO ÚNICO
    expect(opciones(screen.getByLabelText(/Tipo de predio/))).toEqual([
      ['', 'SELECCIONAR'],
      ['PREDIO URBANO', 'PREDIO URBANO'],
      ['PREDIO RUSTICO', 'PREDIO RÚSTICO']
    ])
    expect(opciones(screen.getByLabelText(/Tipo de propiedad/))).toContainEqual(['PROPIETARIO UNICO', 'PROPIETARIO ÚNICO'])
    await userEvent.click(screen.getByLabelText('ESCRITURA PÚBLICA'))
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ documentos_sustento: 'MINUTA, ESCRITURA PUBLICA', tipo_predio: 'PREDIO URBANO' }))
  })
})

describe('the ficha shows the srtm wording', () => {
  it('labels the options of a contribuyente', () => {
    render(<FieldGrid sections={CONTRIBUYENTE_SECTIONS} values={{ ...contribuyente, estado_civil: 'CASADO', tipo_contribuyente: 'SUCESION INDIVISA' }} />)
    expect(valor('Medio de presentación')).toBe('FÍSICO')
    expect(valor('Medio de determinación')).toBe('DECLARACIÓN JURADA')
    expect(valor('Tipo de contribuyente')).toBe('SUCESIÓN INDIVISA')
    // as the srtm writes it (pages 2 and 11)
    expect(valor('Motivo')).toBe('INSCRIPCION')
  })

  it("labels a predio's tipo de predio and tipo de vía, and leaves the zona's word as it is", () => {
    render(
      <FieldGrid
        sections={UBICACION_SECTIONS}
        values={{ tipo_predio: 'PREDIO URBANO', tipo_via: 'JIRON', via: 'LIMA', tipo_zona: 'URBANIZACION', habilitacion_urbana: 'SOL' }}
      />
    )
    expect(valor('Tipo de predio')).toBe('PREDIO URBANO')
    expect(valor('Tipo de vía')).toBe('JR.')
    expect(valor('Zona')).toBe('URBANIZACION')
  })

  it('labels each documento de sustento', () => {
    render(<FieldGrid sections={DJ_DATOS_SECTIONS} values={{ documentos_sustento: 'MINUTA, ESCRITURA PUBLICA', condicion_propiedad: 'PROPIETARIO UNICO' }} />)
    expect(valor('Documentos de sustento')).toBe('MINUTA, ESCRITURA PÚBLICA')
    expect(valor('Tipo de propiedad')).toBe('PROPIETARIO ÚNICO')
  })
})

describe('the año de construcción is a select, as in the srtm (pages 16 and 19)', () => {
  const year = new Date().getFullYear()
  const nivel = {
    tipo_nivel: 'PISO',
    numero_piso: 1,
    anio_construccion: 2024,
    mes_construccion: 1,
    material: 'LADRILLO',
    estado_conservacion: 'BUENO',
    estado: 'ACTIVO',
    area_construida: 200,
    area_comun: null,
    porcentaje_area_comun: null,
    muros_columnas: 'C',
    techos: 'C',
    pisos: null,
    puertas_ventanas: 'D',
    revestimientos: null,
    banos: null,
    instalaciones: null
  }
  const catalogoNivel = { tipo_nivel: ['PISO'], material: ['LADRILLO'], estado_conservacion: ['BUENO'], estado: ['ACTIVO'] }
  const obra = {
    ingreso: 'CON VALORIZACION',
    material: 'LADRILLO',
    tipo_obra: 'MUROS PERIMETRICOS O CERCOS',
    estado_conservacion: 'BUENO',
    anio_construccion: 1895,
    mes_construccion: 2,
    categoria: null,
    valor: 1000,
    numero_piso: 1,
    cantidad: 2,
    metrado: 50,
    unidad_medida: null,
    estado: 'ACTIVO'
  }

  it("offers a nivel's años from this one down to 1900, and sends the one picked as a number", async () => {
    const onSubmit = vi.fn(async () => {})
    conDatos(<RecordForm sections={NIVEL_SECTIONS} options={catalogoNivel} initial={nivel} submitLabel="Grabar" onSubmit={onSubmit} />, [
      { path: '/srtm/categorias-valor', body: [] }
    ])
    const anio = screen.getByLabelText(/Año construcción/)
    expect(anio.tagName).toBe('SELECT')
    const anios = opciones(anio)
    expect(anios[0]).toEqual(['', 'SELECCIONAR'])
    expect(anios[1]).toEqual([String(year), String(year)])
    expect(anios.at(-1)).toEqual(['1900', '1900'])
    expect(anios).toHaveLength(year - 1900 + 2)
    expect(anio).toHaveValue('2024')
    await userEvent.selectOptions(anio, '2023')
    await userEvent.click(screen.getByRole('button', { name: 'Grabar' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ anio_construccion: 2023 }))
  })

  it("offers an obra's años the same way, and keeps a stored one out of the list", async () => {
    conDatos(
      <RecordForm
        sections={OBRA_SECTIONS}
        options={{
          ingreso: ['POR CATEGORIAS', 'CON VALORIZACION'],
          material: ['LADRILLO'],
          tipo_obra: ['MUROS PERIMETRICOS O CERCOS'],
          estado_conservacion: ['BUENO']
        }}
        initial={obra}
        submitLabel="Grabar"
        onSubmit={vi.fn()}
      />,
      [{ path: '/srtm/obras-categorias', body: [] }]
    )
    const anio = screen.getByLabelText(/Año construcción/)
    expect(anio.tagName).toBe('SELECT')
    expect(opciones(anio)).toContainEqual(['1900', '1900'])
    expect(anio).toHaveValue('1895')
    // and its options by their srtm labels (pages 18 and 19)
    expect(opciones(screen.getByLabelText(/Ingreso/))).toContainEqual(['CON VALORIZACION', 'CON VALORIZACIÓN'])
    expect(opciones(screen.getByLabelText(/Tipo de obra/))).toContainEqual(['MUROS PERIMETRICOS O CERCOS', 'MUROS PERIMÉTRICOS O CERCOS'])
  })
})

describe('the rest of the srtm wording', () => {
  it("shows an empty medio de determinación as the srtm's DECLARACIÓN JURADA (pages 2 and 11)", () => {
    render(
      <RecordForm
        sections={CONTRIBUYENTE_SECTIONS}
        options={catalogoContribuyente}
        initial={{ ...contribuyente, medio_determinacion: null }}
        submitLabel="Grabar"
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/Medio de determinación/)).toHaveAttribute('placeholder', 'DECLARACIÓN JURADA')
  })

  it("names the nivel's last categoría as the srtm does: Instalaciones de E/S (page 16)", () => {
    conDatos(<RecordForm sections={NIVEL_SECTIONS} options={{}} initial={{ anio_construccion: 2024 }} submitLabel="Grabar" onSubmit={vi.fn()} />, [
      { path: '/srtm/categorias-valor', body: [] }
    ])
    expect(screen.getByText('Instalaciones de E/S')).toBeInTheDocument()
  })

  it("labels the catastro's search filters as the srtm (page 13): AV., PREDIO RÚSTICO", async () => {
    conDatos(<BuscarPrediosDialog onClose={vi.fn()} onPick={vi.fn()} solo="catastro" />, [
      { path: '/srtm/catalogos', body: { predio: { tipo_via: ['AVENIDA', 'CALLE', 'MALECON'], tipo_zona: ['URBANIZACION'] } } }
    ])
    const tipoVia = await screen.findByLabelText('Tipo de vía')
    await screen.findByRole('option', { name: 'AV.' })
    expect(opciones(tipoVia)).toEqual([
      ['', 'SELECCIONAR'],
      ['AVENIDA', 'AV.'],
      ['CALLE', 'CA.'],
      ['MALECON', 'MALECON']
    ])
    expect(opciones(screen.getByLabelText('Tipo predio'))).toContainEqual(['PREDIO RUSTICO', 'PREDIO RÚSTICO'])
    expect(opciones(screen.getByLabelText('Zona'))).toContainEqual(['URBANIZACION', 'URBANIZACION'])
  })
})
