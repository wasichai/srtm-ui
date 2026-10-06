// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast, rule, rules } from './css'

// portal-tributario's component partials, one per issue: every rule under the theme and outside any layer (so it wins
// over tailwind's utilities), each imported by the theme's index.css. the tokens are @wasichai/ui's (#66)

const dir = join(__dirname, 'portal-tributario')
const read = (file: string) => readFileSync(join(dir, file), 'utf8')
// the theme's tokens, from @wasichai/ui's sheet
const libraryTokens = () =>
  readFileSync(join(__dirname, '..', '..', 'node_modules', '@wasichai', 'ui', 'dist', 'themes', 'portal-tributario', 'tokens.css'), 'utf8')

const PORTAL = "[data-theme='portal-tributario']"
const PARCIALES = ['tables.css', 'shell.css', 'menu.css', 'controls.css', 'tabs.css', 'pasos.css', 'banda.css']

describe('portal-tributario partials', () => {
  it('are the ones listed here', () => {
    const css = readdirSync(dir).filter((file) => file.endsWith('.css') && file !== 'index.css')
    expect(css.sort()).toEqual([...PARCIALES].sort())
  })

  describe.each(PARCIALES)('%s', (file) => {
    const css = read(file)

    it('is imported by the theme', () => {
      expect(read('index.css')).toContain(`@import './${file}';`)
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

describe('menu.css', () => {
  const css = read('menu.css')
  const tokens = rule(libraryTokens(), PORTAL)
  const MENU = `${PORTAL} [data-ui='menu-portal']`

  // the tree's greys (the library's nav.css), with AA on the bar, on an open group and on the current leaf
  it('marks the current group and the hovered one in the dark link blue', () => {
    const grupo = rule(css, `${MENU} [data-ui='menu-grupo']:is(:hover, [aria-current])`)
    expect(grupo.get('color')).toBe('#0d4d80')
    expect(contrast('#0d4d80', tokens.get('--table-head')!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#0d4d80', tokens.get('--surface')!)).toBeGreaterThanOrEqual(4.5)
  })

  it('draws the carets and the icons in #555, 3:1 on the bar', () => {
    expect(rule(css, `${MENU} [data-ui='menu-caret']`).get('color')).toBe('#555')
    expect(contrast('#555', tokens.get('--table-head')!)).toBeGreaterThanOrEqual(3)
  })

  it("shades its panel as the session menu's", () => {
    expect(rule(css, `${MENU} [data-ui='menu-panel']`).get('box-shadow')).toBe('0 6px 22px rgb(13 95 168 / 22%)')
    expect(rule(read('shell.css'), `${PORTAL} [data-ui='menu-sesion-panel']`).get('box-shadow')).toBe('0 6px 22px rgb(13 95 168 / 22%)')
  })

  it("marks the panel's leaves as the tree's: grey under the pointer, the current one darker, with AA", () => {
    const hover = rule(css, `${MENU} [data-ui='menu-hoja']:hover`)
    expect(hover.get('background-color')).toBe('#e9e9e9')
    expect(contrast(tokens.get('--link')!, '#e9e9e9')).toBeGreaterThanOrEqual(4.5)
    const actual = rule(css, `${MENU} [data-ui='menu-hoja'][aria-current='page']`)
    expect(actual.get('color')).toBe('#0d4d80')
    expect(actual.get('background-color')).toBe('#e6e6e6')
    expect(contrast(actual.get('color')!, actual.get('background-color')!)).toBeGreaterThanOrEqual(4.5)
  })

  // after the hover: the current leaf keeps its grey under the pointer
  it('keeps the current leaf grey under the pointer', () => {
    const selectores = rules(css).flatMap((r) => r.selectors)
    expect(selectores.indexOf(`${MENU} [data-ui='menu-hoja'][aria-current='page']`)).toBeGreaterThan(selectores.indexOf(`${MENU} [data-ui='menu-hoja']:hover`))
  })
})

describe('controls.css', () => {
  const css = read('controls.css')

  // the library's sheet leaves ghost to the app: in the portal's content it reads as a link, not in the shell or admin
  it("paints the content's ghost buttons as links", () => {
    expect(rule(css, `${PORTAL} #content [data-slot='button'][data-variant='ghost']`).get('color')).toBe('var(--link)')
  })

  it('gives radios and checkboxes the link blue', () => {
    expect(rule(css, `${PORTAL} input:is([type='radio'], [type='checkbox'])`).get('accent-color')).toBe('var(--link)')
  })

  // buttons and fields are the library sheet's (@wasichai/ui/themes/portal-tributario.css): no copy here
  it("does not repeat the library's controls", () => {
    expect(css).not.toMatch(/\[data-ui='(button|input|textarea|select)'\]/)
  })
})

describe('tabs.css', () => {
  const css = read('tabs.css')

  // the ficha's tabs are the library sheet's, on FichaTabs' data-slot
  it("leaves the ficha's tabs to the library", () => {
    expect(css).not.toMatch(/ficha-tab|ficha-panel|tabs-trigger/)
  })

  it('joins the active workspace tab to what is under it', () => {
    const active = rule(css, `${PORTAL} [data-ui='workspace-tab']:has(> [aria-current='page'])`)
    expect(active.get('background')).toBe('var(--surface)')
    expect(active.get('border-bottom-color')).toBe('var(--surface)')
  })

  it('writes the legend in 15px bold shell blue, without capitals or tracking', () => {
    const legend = rule(css, `${PORTAL} [data-ui='record-legend']`)
    expect(legend.get('font-size')).toBe('15px')
    expect(legend.get('font-weight')).toBe('bold')
    expect(legend.get('color')).toBe('var(--shell)')
    expect(legend.get('text-transform')).toBe('none')
    expect(legend.get('letter-spacing')).toBe('normal')
  })
})

describe('pasos.css', () => {
  const css = read('pasos.css')
  const tokens = rule(libraryTokens(), PORTAL)
  const PASO = `${PORTAL} [data-ui='pasos-galon'] > [data-ui='paso']`
  const BARRA = `${PORTAL} [data-ui='barra-instruccion']`

  // a point of 14px on the right, a notch of 14px on the left
  it('cuts every step as a chevron, the first with no notch, the last with no point', () => {
    expect(rule(css, PASO).get('clip-path')).toBe('polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)')
    expect(rule(css, `${PASO}:first-child`).get('clip-path')).toBe('polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)')
    expect(rule(css, `${PASO}:last-child`).get('clip-path')).toBe('polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)')
    expect(rule(css, `${PASO}:only-child`).get('clip-path')).toBe('none')
  })

  // each step starts under the point of the one before; 2px short of its 14px, so two grey steps still read apart
  it('tucks each step under the point of the one before, but the first', () => {
    expect(rule(css, PASO).get('margin-left')).toBe('-12px')
    expect(rule(css, `${PASO}:first-child`).get('margin-left')).toBe('0')
  })

  it("gives the steps the prototype's size and room, around the notch and the point", () => {
    expect(rule(css, PASO).get('font-size')).toBe('15.5px')
    expect(rule(css, `${PASO} > *`).get('padding')).toBe('11px 30px 11px 34px')
    expect(rule(css, `${PASO}:first-child > *`).get('padding-left')).toBe('22px')
    expect(rule(css, `${PASO}:last-child > *`).get('padding-right')).toBe('26px')
  })

  // a declaración's six steps need some 1090px: below 1100px and 1000px of list they close up, as tabs.css's tabs
  it('closes the steps up where the list is narrow, clearing the notch and the point', () => {
    expect(rule(css, `${PORTAL} [data-ui='pasos-galon']`).get('container')).toBe('pasos-galon / inline-size')
    expect(css).toMatch(/@container pasos-galon \(max-width: 1100px\)/)
    expect(css).toMatch(/@container pasos-galon \(max-width: 1000px\)/)
    const room = rules(css)
      .filter((r) => r.selectors.includes(`${PASO} > *`))
      .map((r) => r.declarations.get('padding')!)
    expect(room).toEqual(['11px 30px 11px 34px', '11px 24px 11px 28px', '10px 20px 10px 24px'])
    // on the right the 14px point, on the left the 14px notch, and some room besides
    for (const padding of room) {
      const [, right, , left] = padding.split(' ').map((side) => parseFloat(side))
      expect(right).toBeGreaterThan(14)
      expect(left).toBeGreaterThan(14)
    }
    const sizes = rules(css)
      .filter((r) => r.selectors.includes(PASO))
      .map((r) => r.declarations.get('font-size'))
    expect(sizes).toEqual(['15.5px', '14.5px'])
  })

  // the current one keeps the component's brand (on-brand over brand, in tokens.test.tsx); the others, the
  // prototype's greys
  it('draws the steps that are not the current one in the prototype greys, with AA', () => {
    const otro = rule(css, `${PASO}:not([aria-current='step'])`)
    expect(otro.get('background-color')).toBe('#ededed')
    expect(otro.get('color')).toBe('#555')
    expect(contrast(otro.get('color')!, otro.get('background-color')!)).toBeGreaterThanOrEqual(4.5)
  })

  it("writes the instruction bar at the prototype's size, with AA", () => {
    expect(rule(css, BARRA).get('padding-left')).toBe('18px')
    const texto = rule(css, `${BARRA} > p`)
    expect(texto.get('padding')).toBe('11px 0')
    expect(texto.get('font-size')).toBe('15px')
    expect(contrast(tokens.get('--ink')!, tokens.get('--surface-muted')!)).toBeGreaterThanOrEqual(4.5)
  })

  // controls.css's primary button, flat, each after a line of 30% white
  it('lays its tools flat side by side', () => {
    const herramienta = rule(css, `${BARRA} [data-slot='button'][data-variant='primary']`)
    expect(herramienta.get('padding')).toBe('12px 18px')
    expect(herramienta.get('font-size')).toBe('14.5px')
    expect(herramienta.get('border-radius')).toBe('0')
    expect(herramienta.get('border-width')).toBe('0 0 0 1px')
    expect(herramienta.get('border-color')).toBe('color-mix(in srgb, var(--on-brand) 30%, transparent)')
    const icono = rule(css, `${BARRA} [data-slot='button'] svg`)
    expect(icono.get('width')).toBe('15px')
    expect(icono.get('height')).toBe('15px')
  })

  // after controls.css: its rule for the primary's padding is as specific, and the later one wins
  it('comes after controls.css', () => {
    const index = read('index.css')
    expect(index.indexOf("@import './pasos.css';")).toBeGreaterThan(index.indexOf("@import './controls.css';"))
  })
})

describe('banda.css', () => {
  const css = read('banda.css')
  const cabecera = `${PORTAL} [data-ui='cabecera-banda']`

  // the header, then the box whose child is FichaTabs' strip (the card tabs.css steps aside): one relative selector,
  // since a :has() cannot hold another
  it('hangs the folder tabs from the header, without the page gap', () => {
    expect(rule(css, `${cabecera}:has(+ * > [data-slot='tabs'])`).get('margin-block-end')).toBe('0')
    expect(rule(css, `${cabecera}:has(+ * > [data-slot='tabs']) > [data-ui='cabecera-fila']`).get('padding-block-end')).toBe('10px')
  })

  it("keeps a link of the band in the band's white, and its focus ring white", () => {
    expect(rule(css, `${PORTAL} [data-ui='banda-titulo'] a:hover`).get('color')).toBe('inherit')
    expect(rule(css, `${PORTAL} [data-ui='banda-titulo'] :focus-visible`).get('outline-color')).toBe('var(--on-brand)')
  })

  it("lays the form's footer out as the prototype: Cancelar on the left, then the note in 13.5px and the primary", () => {
    expect(rule(css, `${PORTAL} [data-ui='record-acciones'] > [type='button']`).get('margin-inline-end')).toBe('auto')
    expect(rule(css, `${PORTAL} [data-ui='record-nota']`).get('font-size')).toBe('13.5px')
  })
})
