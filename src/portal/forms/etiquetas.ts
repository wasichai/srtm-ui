import { ABREVIATURA_VIA } from './direccion'

// how the srtm writes an option the model keeps plain (Presentacion2_.pdf, pages 2 to 21, and the M01 manuals): with
// its accents, SOLTERO(A), PREDIO URBANO. only what a select or a ficha shows changes: the records keep the model's
// value (Core's options take no parentheses, commas or slashes, and the padrón's records are stored with them). an
// option not here shows as it is: the srtm writes its address catalogs (AGRUPACION, URBANIZACION, page 5), INSCRIPCION
// and CONYUGE without accents. the uso, sub clase and clase de uso are named by their own catalog
const ETIQUETAS: Record<string, string> = {
  // contribuyente (pages 2 and 3)
  JURIDICA: 'JURÍDICA',
  SUCESION: 'SUCESIÓN',
  'PERSONA JURIDICA': 'PERSONA JURÍDICA',
  'SUCESION INDIVISA': 'SUCESIÓN INDIVISA',
  'OTROS PATRIMONIOS AUTONOMOS': 'OTROS PATRIMONIOS AUTÓNOMOS',
  'CARNET DE EXTRANJERIA': 'CARNET DE EXTRANJERÍA',
  'PTP-CPP': 'PTP / CPP',
  'DECLARACION JURADA': 'DECLARACIÓN JURADA',
  FISCALIZACION: 'FISCALIZACIÓN',
  FISICO: 'FÍSICO',
  'CRUCE DE INFORMACION': 'CRUCE DE INFORMACIÓN',
  RESOLUCION: 'RESOLUCIÓN',
  SOLTERO: 'SOLTERO(A)',
  CASADO: 'CASADO(A)',
  VIUDO: 'VIUDO(A)',
  DIVORCIADO: 'DIVORCIADO(A)',
  // medios de contacto and documentos de sustento (page 9)
  'TELEFONO CELULAR': 'TELÉFONO CELULAR',
  'TELEFONO FIJO': 'TELÉFONO FIJO',
  'CORREO ELECTRONICO': 'CORREO ELECTRÓNICO',
  'RECIBO DE SERVICIOS': 'RECIBO DE SERVICIOS (LUZ, AGUA)',
  'PARTIDA DE DEFUNCION': 'PARTIDA DE DEFUNCIÓN',
  'SUCESION INTESTADA': 'SUCESIÓN INTESTADA',
  // the declaración and its predio (pages 11 and 12)
  URBANO: 'PREDIO URBANO',
  RUSTICO: 'PREDIO RÚSTICO',
  'PREDIO RUSTICO': 'PREDIO RÚSTICO',
  'PROPIETARIO UNICO': 'PROPIETARIO ÚNICO',
  CONDOMINO: 'CONDÓMINO',
  DONACION: 'DONACIÓN',
  'ANTICIPO DE LEGITIMA': 'ANTICIPO DE LEGÍTIMA',
  ADJUDICACION: 'ADJUDICACIÓN',
  'PRESCRIPCION ADQUISITIVA': 'PRESCRIPCIÓN ADQUISITIVA',
  'DACION EN PAGO': 'DACIÓN EN PAGO',
  'ESCRITURA PUBLICA': 'ESCRITURA PÚBLICA',
  'TITULO DE PROPIEDAD': 'TÍTULO DE PROPIEDAD',
  'CONSTANCIA DE POSESION': 'CONSTANCIA DE POSESIÓN',
  'RESOLUCION JUDICIAL': 'RESOLUCIÓN JUDICIAL',
  'INFORME TECNICO': 'INFORME TÉCNICO',
  'MEDIANAMENTE CERCANO A AREAS VERDES': 'MEDIANAMENTE CERCANO A ÁREAS VERDES',
  // características, niveles and obras (pages 16 to 20)
  'CASA HABITACION Y DEPARTAMENTOS PARA VIVIENDA': 'CASA HABITACIÓN Y DEPARTAMENTOS PARA VIVIENDA',
  'TIENDAS DEPOSITOS CENTROS DE RECREACION CLUBES E INSTITUCIONES': 'TIENDAS DEPÓSITOS CENTROS DE RECREACIÓN CLUBES E INSTITUCIONES',
  'CLINICAS HOSPITALES CINES INDUSTRIAS COLEGIOS TALLERES': 'CLÍNICAS HOSPITALES CINES INDUSTRIAS COLEGIOS TALLERES',
  'EN CONSTRUCCION': 'EN CONSTRUCCIÓN',
  SOTANO: 'SÓTANO',
  'POR CATEGORIAS': 'POR CATEGORÍAS',
  'CON VALORIZACION': 'CON VALORIZACIÓN',
  'MUROS PERIMETRICOS O CERCOS': 'MUROS PERIMÉTRICOS O CERCOS'
}

// a tipo de vía shows as the address writes it (AV., JR., pages 6 and 14): the address's own table
const POR_CAMPO: Record<string, Record<string, string>> = { tipo_via: ABREVIATURA_VIA }

// what an option of a field shows
export function etiqueta(campo: string, valor: string): string {
  return POR_CAMPO[campo]?.[valor] ?? ETIQUETAS[valor] ?? valor
}
