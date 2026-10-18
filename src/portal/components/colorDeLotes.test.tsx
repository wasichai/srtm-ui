import { describe, expect, it } from 'vitest'
import { colorDeLote, IS_SELECTED, opacidadDeLote } from './colorDeLotes'
import { MAP_FALLBACK } from './themeColors'

const colores = { brand: 'rgb(1, 2, 3)', selected: 'rgb(9, 9, 9)', surface: 'rgb(255, 255, 255)' }

describe('colorDeLote', () => {
  it('without colorPor keeps the old paint: the brand, the selected lote in map-selected, as faint as before', () => {
    expect(colorDeLote(colores)).toEqual(['case', ['boolean', ['get', '__selected'], false], 'rgb(9, 9, 9)', 'rgb(1, 2, 3)'])
    expect(colorDeLote(MAP_FALLBACK, null)).toEqual(['case', IS_SELECTED, '#e8590c', '#3b5bdb'])
    expect(opacidadDeLote()).toEqual(['case', IS_SELECTED, 0.45, 0.18])
  })

  it('with colorPor builds a match on the property, each value with its colour resolved, the selected lote still marked', () => {
    const resueltos: Record<string, string> = { 'var(--danger)': 'rgb(200, 0, 0)', 'var(--success)': 'rgb(0, 150, 0)' }
    const expresion = colorDeLote(
      colores,
      { propiedad: 'categoria', colores: { OMISO: 'var(--danger)', COINCIDE: 'var(--success)' } },
      (c) => resueltos[c] ?? null
    )
    expect(expresion).toEqual([
      'case',
      IS_SELECTED,
      'rgb(9, 9, 9)',
      ['match', ['to-string', ['get', 'categoria']], 'OMISO', 'rgb(200, 0, 0)', 'COINCIDE', 'rgb(0, 150, 0)', 'rgb(1, 2, 3)']
    ])
    expect(opacidadDeLote({ propiedad: 'categoria', colores: {} })).toEqual(['case', IS_SELECTED, 0.75, 0.5])
  })

  it('falls back to porDefecto, then to the brand, for a colour it cannot read', () => {
    const resolver = (c: string) => (c.startsWith('#') ? c : null)
    expect(colorDeLote(colores, { propiedad: 'p', colores: { A: '#111111', B: 'nada' }, porDefecto: '#222222' }, resolver)).toEqual([
      'case',
      IS_SELECTED,
      'rgb(9, 9, 9)',
      ['match', ['to-string', ['get', 'p']], 'A', '#111111', 'B', '#222222', '#222222']
    ])
    expect(colorDeLote(colores, { propiedad: 'p', colores: { A: 'nada' }, porDefecto: 'tampoco' }, resolver)).toEqual([
      'case',
      IS_SELECTED,
      'rgb(9, 9, 9)',
      ['match', ['to-string', ['get', 'p']], 'A', 'rgb(1, 2, 3)', 'rgb(1, 2, 3)']
    ])
    // no value to match: every lote in the default (match takes at least one)
    expect(colorDeLote(colores, { propiedad: 'p', colores: {}, porDefecto: '#222222' }, resolver)).toEqual(['case', IS_SELECTED, 'rgb(9, 9, 9)', '#222222'])
  })
})
