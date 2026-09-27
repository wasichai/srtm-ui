// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast, rule } from './css'

const read = (...path: string[]) => readFileSync(join(__dirname, ...path), 'utf8')

const base = read('..', '..', 'node_modules', '@wasichai', 'ui', 'dist', 'theme.css')
const extensions = read('extensions.css')
const portal = read('portal-tributario', 'tokens.css')

const PORTAL = "[data-theme='portal-tributario']"

// the tokens every theme gets on top of the base ones (and --color-* utilities for them)
const EXTENSION = ['success-soft', 'danger-soft', 'notice', 'notice-soft', 'link', 'focus', 'table-head', 'table-stripe', 'line', 'map-selected']

const customProperties = (declarations: Map<string, string>) => [...declarations.keys()].filter((name) => name.startsWith('--')).sort()

describe('contrast', () => {
  it('follows WCAG 2.x', () => {
    expect(contrast('#000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('rgb(255 255 255)', '#fff')).toBe(1)
    expect(contrast('#767676', '#fff')).toBeCloseTo(4.54, 2)
    expect(contrast('#fff', '#767676')).toBe(contrast('#767676', '#fff'))
  })
})

describe('extension tokens', () => {
  it('every theme gets them, derived from its base tokens', () => {
    const root = rule(extensions, ':root')
    expect(customProperties(root)).toEqual(EXTENSION.map((name) => `--${name}`).sort())
    for (const name of EXTENSION.filter((name) => name !== 'map-selected')) expect(root.get(`--${name}`), name).toMatch(/var\(--[a-z-]+\)/)
  })

  it('keeps the lotes map selection orange it has today', () => {
    expect(rule(extensions, ':root').get('--map-selected')).toBe('#e8590c')
  })

  it('are tailwind colors', () => {
    const inline = rule(extensions, '@theme inline')
    for (const name of EXTENSION) expect(inline.get(`--color-${name}`), name).toBe(`var(--${name})`)
  })
})

describe('portal-tributario', () => {
  const tokens = rule(portal, PORTAL)

  it('sets every base token', () => {
    const required = customProperties(rule(base, "[data-theme='light']"))
    expect(required.length).toBeGreaterThan(10)
    expect(customProperties(tokens)).toEqual(expect.arrayContaining(required))
  })

  it('sets every extension token', () => {
    expect(customProperties(tokens)).toEqual(expect.arrayContaining(EXTENSION.map((name) => `--${name}`)))
  })

  it('uses arial, 3px corners, 14px text and its own focus ring', () => {
    expect(tokens.get('--font-sans')).toBe('Arial, Helvetica, sans-serif')
    for (const radius of ['--radius', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-card'])
      expect(tokens.get(radius), radius).toBe('3px')
    const body = rule(portal, `${PORTAL} body`)
    expect(body.get('font-size')).toBe('14px')
    expect(body.get('line-height')).toBe('1.45')
    const focus = rule(portal, `${PORTAL} *:focus-visible`)
    expect(focus.get('outline')).toBe('2px solid var(--focus)')
    expect(focus.get('outline-offset')).toBe('1px')
  })

  it('reaches WCAG AA (4.5:1) on every text pair', () => {
    const color = (name: string) => {
      const value = tokens.get(`--${name}`)
      if (!value) throw new Error(`no --${name}`)
      return value
    }
    const pairs = [
      ...['ink', 'ink-muted', 'brand-strong', 'danger', 'success', 'warning', 'link'].map((text) => [text, 'surface']),
      ['on-brand', 'brand'],
      ['shell-ink', 'shell'],
      ['on-danger', 'danger'],
      ['success', 'success-soft'],
      ['warning', 'warning-soft'],
      ['danger', 'danger-soft'],
      ['notice', 'notice-soft']
    ]
    const failing = pairs.flatMap(([text, background]) => {
      const ratio = contrast(color(text), color(background))
      return ratio >= 4.5 ? [] : [`${text} on ${background}: ${ratio.toFixed(2)}`]
    })
    expect(failing).toEqual([])
  })

  // WCAG 1.4.11 (non-text contrast): the focus ring and the focused input's border, over the page
  it('draws its focus at 3:1 or more over the surface', () => {
    expect(contrast(tokens.get('--focus') ?? '', tokens.get('--surface') ?? '')).toBeGreaterThanOrEqual(3)
  })
})

describe('src/index.css', () => {
  it('imports the extension tokens and the themes after the base theme', () => {
    const index = read('..', 'index.css')
    const at = (path: string) => index.indexOf(`@import '${path}';`)
    expect(at('@wasichai/ui/theme.css')).toBeGreaterThan(at('tailwindcss'))
    expect(at('./themes/extensions.css')).toBeGreaterThan(at('@wasichai/ui/theme.css'))
    expect(at('./themes/portal-tributario/index.css')).toBeGreaterThan(at('./themes/extensions.css'))
    expect(read('portal-tributario', 'index.css')).toContain("@import './tokens.css';")
  })
})
