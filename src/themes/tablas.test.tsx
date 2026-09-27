// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (...path: string[]) => readFileSync(join(__dirname, ...path), 'utf8')

const PORTAL = "[data-theme='portal-tributario']"
const TABLE = `${PORTAL} [data-ui='table']`

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
const tokens = rule(read('portal-tributario', 'tokens.css'), PORTAL)
const token = (name: string) => tokens.get(`--${name}`)!

describe('tables.css of portal-tributario', () => {
  it('is imported by the theme after its tokens', () => {
    const index = read('portal-tributario', 'index.css')
    const imports = [...index.matchAll(/@import '([^']+)'/g)].map(([, path]) => path)
    expect(imports).toContain('./tables.css')
    expect(imports.indexOf('./tables.css')).toBeGreaterThan(imports.indexOf('./tokens.css'))
  })

  // unlayered: it beats tailwind's utilities, and only ever under the theme, so light and dark do not change
  it('is out of layers and only styles the theme', () => {
    expect(tables).not.toBe('')
    expect(tables).not.toMatch(/@layer/)
    const all = rules(tables)
    expect(all.length).toBeGreaterThan(0)
    for (const { selectors } of all) for (const selector of selectors) expect(selector.startsWith(`${PORTAL} `), selector).toBe(true)
  })

  it("draws the prototype's header", () => {
    const th = rule(tables, `${TABLE} th`)
    expect(th.get('padding')).toBe('11px 18px')
    expect(th.get('font-size')).toBe('13.5px')
    expect(th.get('font-weight')).toBe('700')
    expect(th.get('background-color')).toBe('var(--table-head)')
    expect(th.get('white-space')).toBe('nowrap')
    expect(th.get('text-transform')).toBe('none')
  })

  it('draws the cells over thin lines and stripes the rows', () => {
    const td = rule(tables, `${TABLE} td`)
    expect(td.get('font-size')).toBe('14.5px')
    expect(td.get('border-bottom')).toBe('1px solid var(--line)')
    expect(rule(tables, `${TABLE} > tbody > tr:nth-child(even):not([aria-selected='true'])`).get('background-color')).toBe('var(--table-stripe)')
  })

  it('draws the total row of the foot', () => {
    const total = rule(tables, `${TABLE} > tfoot td`)
    expect(total.get('font-weight')).toBe('700')
    expect(total.get('background-color')).toBe('var(--surface-muted)')
    expect(total.get('border-top')).toMatch(/^2px solid /)
  })

  it('keeps figures right aligned with digits of one width', () => {
    const numeric = rule(tables, `${TABLE} [data-numeric]`)
    expect(numeric.get('text-align')).toBe('right')
    expect(numeric.get('font-variant-numeric')).toBe('tabular-nums')
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

  it('writes the paginators as a muted note under the table', () => {
    const paginador = rule(tables, `${PORTAL} [data-ui='paginador']`)
    expect(paginador.get('background-color')).toBe('var(--table-stripe)')
    expect(paginador.get('color')).toBe('var(--ink-muted)')
    expect(paginador.get('font-size')).toBe('13.5px')
  })

  // the text over the backgrounds this partial paints: header, stripes, total, a selected row
  it('keeps AA over the backgrounds it paints', () => {
    const head = rule(tables, `${TABLE} th`).get('color')!
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
