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
const PARCIALES = ['tables.css', 'shell.css', 'controls.css', 'tabs.css', 'nav.css', 'pasos.css', 'banda.css']

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

describe('nav.css', () => {
  const css = read('nav.css')
  const tokens = rule(libraryTokens(), PORTAL)
  const ARBOL = `${PORTAL} [data-ui='arbol-nav']`
  const arbol = (part: string) => rule(css, `${ARBOL} ${part}`)
  const actual = arbol("[data-ui='arbol-hoja'][aria-current='page']")
  const hover = arbol("[data-ui='arbol-hoja']:hover")
  const grupo = arbol("[data-ui='arbol-grupo']:hover")
  const caret = arbol("[data-ui='arbol-caret']")

  it('only styles the tree', () => {
    const selectors = rules(css).flatMap((r) => r.selectors)
    expect(selectors.filter((selector) => !selector.startsWith(`${ARBOL} `))).toEqual([])
  })

  it("pins the prototype's current leaf, hovers and carets", () => {
    expect(actual.get('color')).toBe('#0d4d80')
    expect(actual.get('background-color')).toBe('#e6e6e6')
    expect(hover.get('background-color')).toBe('#e9e9e9')
    expect(grupo.get('color')).toBe('#0d4d80')
    expect(caret.get('color')).toBe('#555555')
  })

  // over the lateral (table-head): a hovered leaf, the current one and a hovered group at 4.5:1; the caret, a graphic
  // next to its group's name, at 3:1
  it('keeps AA over the backgrounds it paints', () => {
    const head = tokens.get('--table-head')!
    expect(contrast(tokens.get('--link')!, hover.get('background-color')!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(actual.get('color')!, actual.get('background-color')!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(grupo.get('color')!, head)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(caret.get('color')!, head)).toBeGreaterThanOrEqual(3)
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
