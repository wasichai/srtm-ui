import { describe, expect, it } from 'vitest'
import { basesDeArbitrio, dimensionesDeArbitrio } from './queries'
import type { ParametroTributario } from './types'

// what the DJ reads from the year's arbitrios rows: their texto trimmed, as srtm-backend reads it (Servicios.baseLeida,
// Servicios.dimensiones), so a row typed with spaces asks for the same as the backend charges by

const fila = (tipo: string, texto: string | null): ParametroTributario => ({
  id: null,
  tipo,
  clave: 'LIMPIEZA',
  texto,
  vigencia_desde: '2026-01-01',
  vigencia_hasta: null,
  valor_numerico: null,
  norma: null,
  fuente: null,
  transcribio: null,
  verifico: null
})

describe('basesDeArbitrio', () => {
  it('reads each BASE_ARBITRIO texto trimmed, and none from a blank one', () => {
    expect(basesDeArbitrio([fila('BASE_ARBITRIO', ' FRONTIS_ML '), fila('BASE_ARBITRIO', '   '), fila('TASA_ARBITRIO', 'AREA_CONSTRUIDA_M2')])).toEqual(
      new Set(['FRONTIS_ML'])
    )
  })

  it('reads none without rows', () => {
    expect(basesDeArbitrio(undefined)).toEqual(new Set())
  })
})

describe('dimensionesDeArbitrio', () => {
  it('reads each DIMENSIONES_ARBITRIO texto split by commas, each one trimmed', () => {
    expect(dimensionesDeArbitrio([fila('DIMENSIONES_ARBITRIO', ' ZONA , INFLUENCIA ,'), fila('DIMENSIONES_ARBITRIO', '  ')])).toEqual(
      new Set(['ZONA', 'INFLUENCIA'])
    )
  })
})
