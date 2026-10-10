import { describe, expect, it } from 'vitest'
import { formatMoney, formatNumber, parseNumber } from './format'

// a figure is read back the way formatNumber writes it (es-PE): a point before the decimals, commas between thousands
describe('parseNumber', () => {
  it('reads plain figures and the ones written with thousands', () => {
    expect(parseNumber('25000')).toBe(25000)
    expect(parseNumber('25,000')).toBe(25000)
    expect(parseNumber('1,250.50')).toBe(1250.5)
    expect(parseNumber(' -1,234,567.8 ')).toBe(-1234567.8)
    expect(parseNumber('0.75')).toBe(0.75)
  })

  it('reads back what formatNumber and formatMoney write', () => {
    expect(parseNumber(formatNumber(12345.67))).toBe(12345.67)
    expect(parseNumber(formatMoney(25000).replace(/^S\/\s*/, ''))).toBe(25000)
  })

  it('refuses a comma before decimals instead of guessing it', () => {
    // 1,5 and 1,50 are not thousands; 25,000 read as 25.000 would save S/ 25
    expect(parseNumber('1,5')).toBeNull()
    expect(parseNumber('1,50')).toBeNull()
    expect(parseNumber('1.234,56')).toBeNull()
    expect(parseNumber('12,34,567')).toBeNull()
  })

  it('refuses what is not a figure', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('1e3')).toBeNull()
    expect(parseNumber('.5')).toBeNull()
    expect(parseNumber('5.')).toBeNull()
  })

  it('takes no decimals for an integer', () => {
    expect(parseNumber('1,500', { integer: true })).toBe(1500)
    expect(parseNumber('12', { integer: true })).toBe(12)
    expect(parseNumber('1.5', { integer: true })).toBeNull()
    expect(parseNumber('1,5', { integer: true })).toBeNull()
  })
})
