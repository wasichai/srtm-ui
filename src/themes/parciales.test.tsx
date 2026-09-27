// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast, rule, rules } from './css'

// portal-tributario's component partials, one per issue: every rule under the theme and outside any layer (so it wins
// over tailwind's utilities), each imported by the theme's index.css after its tokens

const dir = join(__dirname, 'portal-tributario')
const read = (file: string) => readFileSync(join(dir, file), 'utf8')

const PORTAL = "[data-theme='portal-tributario']"
const PARCIALES = ['tables.css', 'shell.css', 'controls.css']

describe('portal-tributario partials', () => {
  it('are the ones listed here', () => {
    const css = readdirSync(dir).filter((file) => file.endsWith('.css') && file !== 'index.css' && file !== 'tokens.css')
    expect(css.sort()).toEqual([...PARCIALES].sort())
  })

  describe.each(PARCIALES)('%s', (file) => {
    const css = read(file)

    it('is imported by the theme, after its tokens', () => {
      const index = read('index.css')
      expect(index.indexOf(`@import './${file}';`)).toBeGreaterThan(index.indexOf("@import './tokens.css';"))
    })

    it('scopes every rule to the theme', () => {
      const selectors = rules(css).flatMap((r) => r.selectors)
      expect(selectors.length).toBeGreaterThan(0)
      expect(selectors.filter((selector) => !selector.startsWith(`${PORTAL} `))).toEqual([])
    })

    it('stays outside any layer', () => {
      expect(css).not.toMatch(/@layer/)
    })
  })
})

describe('controls.css', () => {
  const css = read('controls.css')
  const button = (variant: string, state = '') => rule(css, `${PORTAL} [data-ui='button'][data-variant='${variant}']${state}`)

  it('keeps the danger border of an invalid field', () => {
    const invalid = rules(css).find((r) => r.selectors.some((s) => s.includes("[aria-invalid='true']")))
    expect(invalid?.declarations.get('border-color')).toBe('var(--danger)')
  })

  // WCAG 1.4.11: the round icon button's white icon over its grey disc, at rest and hovered
  it('draws the round icon button at 3:1 or more', () => {
    for (const declarations of [button('round'), button('round', ':hover:not(:disabled)')])
      expect(contrast(declarations.get('color') ?? '#fff', declarations.get('background') ?? '')).toBeGreaterThanOrEqual(3)
  })

  it('marks a disabled button without losing the not-allowed cursor', () => {
    const disabled = rule(css, `${PORTAL} [data-ui='button']:disabled`)
    expect(disabled.get('cursor')).toBe('not-allowed')
    expect(disabled.get('pointer-events')).toBe('auto')
  })
})
