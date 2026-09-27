// the address one-liner the backend writes (Reglas.kt describir / describirUbicacion in srtm-backend): same order,
// same words. the portal previews it before saving

type Texto = string | null | undefined
type Valores = Partial<Record<string, Texto>>

// the srtm writes the common types of vía and every type of unidad urbana abbreviated (AV. ANDRES AVELINO CACERES,
// A.P.V. LOS PINOS): the records keep the model's word, the address its abbreviation; a type not here goes whole. the
// same two tables are in Reglas.kt (ABREVIATURA_VIA, ABREVIATURA_UNIDAD_URBANA), and model/import_predios.py reads each
// abbreviation back: change the three together
export const ABREVIATURA_VIA: Record<string, string> = {
  AVENIDA: 'AV.',
  CALLE: 'CA.',
  JIRON: 'JR.',
  PASAJE: 'PSJE.',
  PROLONGACION: 'PROL.',
  CARRETERA: 'CARR.'
}

// the catastro fiscal's ABREV_UU (srtm-backend's model/data/tipos_unidad_urbana.csv), by type. 48 and 53 share ASOC.VIS.
export const ABREVIATURA_UNIDAD_URBANA: Record<string, string> = {
  AGRUPACION: 'AGRUP',
  'ASENTAMIENTO HUMANO': 'AA.HH.',
  ASOCIACION: 'ASOC',
  'ASOCIACION DE VIVIENDA': 'ASOC. VIV.',
  'ASOCIACION DE VIVIENDA DE INTERES SOCIAL': 'ASOC.VIS.',
  'ASOCIACION DE VIVIENDA E INTERES SOCIAL': 'ASOC.VIS.',
  'ASOCIACION DE VIVIENDA POPULAR DE INTERES SOCIAL': 'ASOC.V.POPIS',
  'ASOCIACION POPULAR URBANIZADORA': 'ASOC.PU.',
  'ASOCIACION PRO VIVIENDA': 'A.P.V.',
  'ASOCIACION PRO VIVIENDA DE INTERES SOCIAL': 'ASOC.PVIS.',
  'ASOCIACION PRO VIVIENDA UNIDAD VECINAL': 'ASOC.PVUV.',
  BALNEARIO: 'BAL.',
  BARRIO: 'BAR',
  CASERIO: 'CAS',
  'CENTRO POBLADO': 'C.P.',
  CERCADO: 'CER',
  'COMPLEJO HABITACIONAL': 'C.HAB.',
  'CONJUNTO HABITACIONAL': 'CONJ. HAB.',
  'CONJUNTO RESIDENCIAL': 'C.R.',
  COOPERATIVA: 'COOP',
  'COOPERATIVA DE VIVIENDA': 'COOP. VIV.',
  FUNDO: 'FDO',
  'LOTE UNICO': 'L.U.',
  LOTIZACION: 'LOT',
  'POSESION INFORMAL': 'P.I.',
  PROGRAMA: 'PRO.',
  'PROGRAMA DE ADJUDICACION DE LOTES': 'P.A.L.',
  'PROGRAMA DE VIVIENDA': 'P.V.',
  'PROGRAMA MUNICIPAL DE VIVIENDA': 'PMV.',
  'PROYECTO INTEGRAL DE LAS JUNTAS VECINALES': 'PROY.I.J.V.',
  'PUEBLO JOVEN': 'P.J.',
  'PUEBLO TRADICIONAL': 'P. T.',
  RESIDENCIAL: 'RES.',
  SECTOR: 'S.',
  'SIN HABILITACION': 'SIN. HAB.',
  'UNIDAD VECINAL': 'U.V.',
  URBANIZACION: 'URB.',
  'URBANIZACION POPULAR': 'URB. POP.',
  'URBANIZACION POPULAR DE INTERES SOCIAL': 'UPIS',
  'URBANIZACION PRO VIVIENDA DE INTERES SOCIAL': 'UPVIS',
  ZONA: 'Z.',
  'ZONA INDUSTRIAL': 'Z.I.',
  'ZONA URBANA': 'Z.U.'
}

const clean = (s: Texto) => (s ?? '').trim()
const join = (...parts: Texto[]) => parts.map(clean).filter(Boolean).join(' ')

// a vía or unidad urbana with its type in front, abbreviated. OTROS is not a word of the address, and a name that
// already starts with its type (a padrón's "JR. LIMA" not yet normalized) does not get it twice
export function conTipo(tipo: Texto, nombre: Texto, abreviaturas: Record<string, string>): string {
  const palabra = clean(tipo) === 'OTROS' ? '' : clean(tipo)
  const sigla = palabra ? (abreviaturas[palabra] ?? palabra) : ''
  const texto = clean(nombre)
  const repetido = Boolean(palabra && texto) && [sigla, palabra].some((t) => texto.startsWith(`${t} `))
  return join(repetido ? '' : sigla, texto)
}

export function describirDomicilio(d: Valores): string {
  const tipo = (value: Texto) => (value === 'OTROS' ? null : value)
  const labeled = (label: string, value: Texto) => (clean(value) ? `${label} ${clean(value)}` : '')
  const numero = join(d.numero, d.letra1, d.letra2)
  return [
    conTipo(d.tipo_via, d.via, ABREVIATURA_VIA),
    numero ? `N° ${numero}` : '',
    labeled('N° ALT.', d.numero_alterno),
    join(tipo(d.edificacion), d.nombre_edificacion),
    join(tipo(d.interior), d.descripcion_interior),
    labeled('PISO', d.piso),
    labeled('PUERTA', d.ingreso),
    labeled('MZ.', d.manzana),
    labeled('LT.', d.lote),
    labeled('SUB LT.', d.sub_lote),
    labeled('KM.', d.kilometro),
    conTipo(d.tipo_unidad_urbana, d.unidad_urbana, ABREVIATURA_UNIDAD_URBANA),
    join(tipo(d.sub_zona), d.descripcion_sub_zona),
    [d.departamento, d.provincia, d.distrito].map(clean).filter(Boolean).join('-')
  ]
    .filter(Boolean)
    .join(', ')
}

// a predio's direccion from its ubicación, as a domicilio's. only once it has a tipo de vía (the srtm's ubicación):
// a predio of the padrón without one keeps the padrón's text
export function describirUbicacion(p: Valores): string {
  if (!clean(p.tipo_via)) return clean(p.direccion)
  return describirDomicilio({
    tipo_via: p.tipo_via,
    via: p.via,
    numero: p.numero,
    numero_alterno: p.numero_alterno,
    letra1: p.letra1,
    letra2: p.letra2,
    manzana: p.manzana,
    lote: p.lote,
    sub_lote: p.sub_lote,
    kilometro: p.kilometro,
    edificacion: p.edificacion,
    nombre_edificacion: p.descripcion_edificacion,
    interior: p.interior,
    descripcion_interior: p.descripcion_interior,
    piso: p.piso,
    ingreso: p.ingreso,
    tipo_unidad_urbana: p.tipo_zona,
    unidad_urbana: p.habilitacion_urbana,
    sub_zona: p.sub_zona,
    descripcion_sub_zona: p.descripcion_sub_zona,
    departamento: p.departamento,
    provincia: p.provincia,
    distrito: p.distrito
  })
}
