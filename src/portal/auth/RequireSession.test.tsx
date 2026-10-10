import { describe, expect, it } from 'vitest'
import { safeNext } from './RequireSession'

// where the login sends one back (?next=): a path of this site, never another one
describe('safeNext', () => {
  it('keeps a path of the site, with its query and its hash', () => {
    expect(safeNext('/contribuyentes/c1?tab=domicilios')).toBe('/contribuyentes/c1?tab=domicilios')
    expect(safeNext('/declaraciones/d1#niveles')).toBe('/declaraciones/d1#niveles')
  })

  it('goes home without a next, or with one that is not a path', () => {
    expect(safeNext(null)).toBe('/')
    expect(safeNext('')).toBe('/')
    expect(safeNext('contribuyentes')).toBe('/')
    expect(safeNext('https://evil.example/login')).toBe('/')
    expect(safeNext('javascript:alert(1)')).toBe('/')
  })

  it('goes home with a path the browser would read as another site', () => {
    expect(safeNext('//evil.example')).toBe('/')
    // a backslash is a slash to the browser, and it drops tabs and newlines
    expect(safeNext('/\\evil.example')).toBe('/')
    expect(safeNext('/\t/evil.example')).toBe('/')
    expect(safeNext('/\n/evil.example')).toBe('/')
  })
})
