import { describe, expectTypeOf, it } from 'vitest'
import type { CatalogKey } from './types'

// the objects srtm-backend's /api/srtm/catalogos sends enum options for (CatalogoService.OBJETOS). checked by
// `yarn typecheck`: vitest itself does not compare types
const OBJETOS = [
  'contribuyente',
  'predio',
  'declaracion_predial',
  'domicilio',
  'relacionado',
  'medio_contacto',
  'sustento',
  'via',
  'unidad_urbana',
  'transferente',
  'nivel_construccion',
  'obra_complementaria',
  'otro_frente',
  'catastro_fiscal',
  'obra_categoria'
] as const

describe('CatalogKey', () => {
  it('names every catalog the backend sends, and only those', () => {
    expectTypeOf<(typeof OBJETOS)[number]>().toEqualTypeOf<CatalogKey>()
  })
})
