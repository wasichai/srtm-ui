// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (...path: string[]) => readFileSync(join(__dirname, ...path), 'utf8')

const PORTAL = "[data-theme='portal-tributario']"
const TABLE = `${PORTAL} [data-slot='table']`
// the header, cells, stripes and total are @wasichai/ui's theme sheet's since 0.3 (#66), scoped to the theme
const LIB_TABLE = "[data-slot='table']"

// the innermost rules (inside @media too), with their selector lists split at the top level
function rules(css: string): { selectors: string[]; declarations: Map<string, string> }[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
    selectors: splitTopLevel(selectors.trim()),
    declarations: new Map(
      body.split(';').flatMap((declaration) => {
        const colon = declaration.indexOf(':')
        return colon < 0 ? [] : [[declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()] as const]
      })
    )
  }))
}

function splitTopLevel(list: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of list) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else current += char
  }
  return [...parts, current.trim()].filter(Boolean)
}

// the declarations of the rule whose selector list has exactly `selector`
function rule(css: string, selector: string): Map<string, string> {
  const found = rules(css).find((r) => r.selectors.includes(selector))
  if (!found) throw new Error(`no rule for ${selector}`)
  return found.declarations
}

// WCAG 2.x contrast of two #rgb / #rrggbb colours (as in tokens.test.tsx)
function luminance(color: string): number {
  const hex = color.length === 4 ? [...color.slice(1)].map((digit) => digit + digit).join('') : color.slice(1)
  const [r, g, b] = [0, 2, 4]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const tables = read('portal-tributario', 'tables.css')
const library = (file: string) => read('..', '..', 'node_modules', '@wasichai', 'ui', 'dist', 'themes', 'portal-tributario', file)
const libraryTables = library('tables.css')
const tokens = rule(library('tokens.css'), PORTAL)
const token = (name: string) => tokens.get(`--${name}`)!

describe('tables.css of portal-tributario', () => {
  it('is imported by the theme', () => {
    const index = read('portal-tributario', 'index.css')
    expect([...index.matchAll(/@import '([^']+)'/g)].map(([, path]) => path)).toContain('./tables.css')
  })

  // unlayered: it beats tailwind's utilities, and only ever under the theme, so light and dark do not change
  it('is out of layers and only styles the theme', () => {
    expect(tables).not.toBe('')
    expect(tables).not.toMatch(/@layer/)
    const all = rules(tables)
    expect(all.length).toBeGreaterThan(0)
    for (const { selectors } of all) for (const selector of selectors) expect(selector.startsWith(`${PORTAL} `), selector).toBe(true)
  })

  // what srtm relies on from the library's sheet: the prototype's header, cells, stripes and total
  it("gets the prototype's header, cells, stripes and total from the library", () => {
    const th = rule(libraryTables, `${LIB_TABLE} th`)
    expect(th.get('padding')).toBe('11px 18px')
    expect(th.get('font-size')).toBe('13.5px')
    expect(th.get('background-color')).toBe('var(--table-head)')
    expect(th.get('white-space')).toBe('nowrap')
    const td = rule(libraryTables, `${LIB_TABLE} td`)
    expect(td.get('font-size')).toBe('14.5px')
    expect(td.get('border-bottom')).toBe('1px solid var(--line)')
    expect(rule(libraryTables, `${LIB_TABLE} > tbody > tr:nth-child(even)`).get('background-color')).toBe('var(--table-stripe)')
    const total = rule(libraryTables, `${LIB_TABLE} > tfoot td`)
    expect(total.get('font-weight')).toBe('700')
    expect(total.get('border-top')).toMatch(/^2px solid /)
  })

  it("does not repeat the library's header, cells, stripes or total", () => {
    const selectors = rules(tables).flatMap((r) => r.selectors)
    expect(selectors.filter((selector) => /\b(th|td)$|tbody|tfoot/.test(selector))).toEqual([])
  })

  it('stripes the key-value ficha, with a tone per row', () => {
    const selectors = rules(tables).flatMap((r) => r.selectors)
    expect(selectors.some((s) => s.startsWith(`${PORTAL} [data-ui='ficha-kv']`) && s.includes('nth-child'))).toBe(true)
    for (const [tono, fondo, texto] of [
      ['verde', 'var(--success-soft)', 'var(--success)'],
      ['ambar', 'var(--warning-soft)', 'var(--warning)'],
      ['rojo', 'var(--danger-soft)', 'var(--danger)']
    ]) {
      const row = rule(tables, `${PORTAL} [data-ui='ficha-kv'] > [data-tono='${tono}']`)
      expect(row.get('background-color'), tono).toBe(fondo)
      expect(row.get('color'), tono).toBe(texto)
    }
  })

  it('draws a read-only section as a group with its title on the border, like the form fieldsets', () => {
    const seccion = rule(tables, `${PORTAL} [data-ui='ficha-seccion']`)
    expect(seccion.get('border')).toBe('1px solid var(--brand)')
    expect(seccion.get('border-radius')).toBe('3px')
    const titulo = rule(tables, `${PORTAL} [data-ui='ficha-titulo']`)
    expect(titulo.get('color')).toBe('var(--shell)')
    expect(titulo.get('font-size')).toBe('15px')
    expect(titulo.get('text-transform')).toBe('none')
    expect(titulo.get('background-color')).toBe('var(--surface)')
  })

  it('keeps the codes in a cell on one line', () => {
    expect(rule(tables, `${TABLE} td a`).get('white-space')).toBe('nowrap')
  })

  it('writes the paginators as a muted note under the table', () => {
    const paginador = rule(tables, `${PORTAL} [data-ui='paginador']`)
    expect(paginador.get('background-color')).toBe('var(--table-stripe)')
    expect(paginador.get('color')).toBe('var(--ink-muted)')
    expect(paginador.get('font-size')).toBe('13.5px')
  })

  // the text over the backgrounds this partial paints: header, stripes, total, a selected row
  it('keeps AA over the backgrounds it paints', () => {
    const head = rule(libraryTables, `${LIB_TABLE} th`).get('color')!
    const pairs: [string, string, string][] = [
      ['th', head, token('table-head')],
      ...['ink', 'ink-muted', 'link', 'success', 'danger', 'warning'].map((name): [string, string, string] => [
        `${name} / stripe`,
        token(name),
        token('table-stripe')
      ]),
      ['ink / total', token('ink'), token('surface-muted')],
      // EstadoBadge in a selected row: its tones are green or red
      ['success / selected', token('success'), token('brand-soft')],
      ['danger / selected', token('danger'), token('brand-soft')]
    ]
    for (const [name, text, background] of pairs) expect(contrast(text, background), name).toBeGreaterThanOrEqual(4.5)
  })
})
