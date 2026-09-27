// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (...path: string[]) => readFileSync(join(__dirname, ...path), 'utf8')

const base = read('..', '..', 'node_modules', '@wasichai', 'ui', 'dist', 'theme.css')
const extensions = read('extensions.css')
const portal = read('portal-tributario', 'tokens.css')

const PORTAL = "[data-theme='portal-tributario']"

// the tokens every theme gets on top of the base ones (and --color-* utilities for them)
const EXTENSION = ['success-soft', 'danger-soft', 'notice', 'notice-soft', 'link', 'focus', 'table-head', 'table-stripe', 'line', 'map-selected']

// the declarations of the first rule whose selector list has `selector` (innermost rules, so `@layer` wrappers are skipped)
function rule(css: string, selector: string): Map<string, string> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, selectors, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(',').some((part) => part.trim() === selector)) continue
    const declarations = body.split(';').flatMap((declaration) => {
      const colon = declaration.indexOf(':')
      return colon < 0 ? [] : [[declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()] as const]
    })
    return new Map(declarations)
  }
  throw new Error(`no rule for ${selector}`)
}

const customProperties = (declarations: Map<string, string>) => [...declarations.keys()].filter((name) => name.startsWith('--')).sort()

// #rgb, #rrggbb or rgb(r g b) / rgb(r, g, b), as 0-255 channels
function channels(color: string): number[] {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1]
    return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16))
  }
  const rgb = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/i.exec(color)
  if (rgb) return rgb.slice(1, 4).map(Number)
  throw new Error(`not a plain srgb color: ${color}`)
}

// WCAG 2.x relative luminance and contrast ratio
function luminance(color: string): number {
  const [r, g, b] = channels(color)
    .map((channel) => channel / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

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
