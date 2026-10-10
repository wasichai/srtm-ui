import { describe, expect, it } from 'vitest'
import { secuencia } from './secuencia'

// the secuencia de uso as srtm-backend compares it (Reglas.kt secuenciaUso)
describe('secuencia', () => {
  it('reads a number with its zeros: "1" is "001"', () => {
    expect(secuencia('1')).toBe('001')
    expect(secuencia('001')).toBe('001')
    expect(secuencia(' 12 ')).toBe('012')
    expect(secuencia('1234')).toBe('1234')
  })

  it('takes a blank one as the first', () => {
    expect(secuencia('')).toBe('001')
    expect(secuencia('  ')).toBe('001')
    expect(secuencia(null)).toBe('001')
    expect(secuencia(undefined)).toBe('001')
  })

  it('keeps one that is not a number as it is', () => {
    expect(secuencia('A1')).toBe('A1')
  })
})
