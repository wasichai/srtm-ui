import { describe, expect, it } from 'vitest'
import type { Contribuyente } from '../types'
import { describirContribuyente, nombres, PERENE_PREDIO, PERENE_UBIGEO, ubigeoCampos } from './bloques'

// the field blocks the specs and pages share, so an address is asked the same way everywhere

describe('ubigeoCampos', () => {
  it('trae la cascada y los cuatro campos que escribe, en ese orden', () => {
    expect(ubigeoCampos().map((f) => [f.name, f.kind])).toEqual([
      ['ubigeo_cascada', 'custom'],
      ['ubigeo', 'hidden'],
      ['departamento', 'hidden'],
      ['provincia', 'hidden'],
      ['distrito', 'hidden']
    ])
  })

  it('pide departamento, provincia y distrito, y el ubigeo no', () => {
    const requeridos = Object.fromEntries(ubigeoCampos().map((f) => [f.name, f.required ?? false]))
    expect(requeridos).toEqual({ ubigeo_cascada: false, ubigeo: false, departamento: true, provincia: true, distrito: true })
  })

  it('pone la cascada a todo el ancho y con su propio dibujo', () => {
    const cascada = ubigeoCampos()[0]
    expect(cascada.span).toBe(6)
    expect(cascada.render).toBeTypeOf('function')
  })

  it('da campos nuevos en cada llamada: una spec que los ajuste no toca a las otras', () => {
    const [a, b] = [ubigeoCampos(), ubigeoCampos()]
    expect(a).not.toBe(b)
    expect(a[2]).not.toBe(b[2])
  })
})

describe('PERENE', () => {
  it('el distrito del municipio, y el predio nuevo además en la selva', () => {
    expect(PERENE_UBIGEO).toEqual({ ubigeo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' })
    expect(PERENE_PREDIO).toEqual({ ...PERENE_UBIGEO, region: 'SELVA' })
  })
})

describe('nombres', () => {
  it('lista los nombres y salta los vacíos', () => {
    expect(nombres([{ nombre: 'AV. LIMA' }, { nombre: null }, { nombre: '' }, { nombre: 'JR. CUSCO' }])).toEqual(['AV. LIMA', 'JR. CUSCO'])
  })
})

describe('describirContribuyente', () => {
  const contribuyente = (c: Partial<Contribuyente>) => c as Contribuyente

  it('escribe "s/d" cuando no hay documento', () => {
    expect(describirContribuyente(contribuyente({ id: 'c1', numero_documento: null, nombre_completo: 'ANA' }))).toEqual({ id: 'c1', label: 's/d · ANA' })
  })

  it('escribe el documento y el nombre', () => {
    expect(describirContribuyente(contribuyente({ id: 'c2', numero_documento: '12345678', nombre_completo: 'LUIS PEREZ' }))).toEqual({
      id: 'c2',
      label: '12345678 · LUIS PEREZ'
    })
  })

  it('deja el nombre en blanco si falta', () => {
    expect(describirContribuyente(contribuyente({ id: 'c3', numero_documento: '20123456789', nombre_completo: null })).label).toBe('20123456789 · ')
  })
})
