import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXTS } from './texts'

// the editable list's words agree with the gender of the row's name
describe('DEFAULT_TEXTS', () => {
  it('speaks of a masculine row by default', () => {
    expect(DEFAULT_TEXTS.newOne('domicilio')).toBe('Nuevo domicilio')
    expect(DEFAULT_TEXTS.dataOf('domicilio')).toBe('Datos del domicilio')
    expect(DEFAULT_TEXTS.removeTitle('domicilio')).toBe('¿Eliminar este domicilio?')
  })

  it('agrees with a feminine one', () => {
    expect(DEFAULT_TEXTS.newOne('obra complementaria', true)).toBe('Nueva obra complementaria')
    expect(DEFAULT_TEXTS.dataOf('obra complementaria', true)).toBe('Datos de la obra complementaria')
    expect(DEFAULT_TEXTS.removeTitle('obra complementaria', true)).toBe('¿Eliminar esta obra complementaria?')
    // the ones that do not agree stay the same
    expect(DEFAULT_TEXTS.add('obra complementaria')).toBe('Agregar obra complementaria')
    expect(DEFAULT_TEXTS.editOne('obra complementaria')).toBe('Editar obra complementaria')
  })
})
