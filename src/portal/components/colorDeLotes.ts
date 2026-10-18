import type { ExpressionSpecification } from 'maplibre-gl'
import type { MapColors } from './themeColors'

// the lotes coloured by one of their properties (the brecha's categoria): each value its colour, any css colour
// (a theme's var(--danger) too, resolved to what maplibre reads when the map paints and on every theme change). a
// value without one, or a lote without the property, takes porDefecto, else the theme's brand
export interface ColorPor {
  propiedad: string
  colores: Record<string, string>
  porDefecto?: string
}

export const IS_SELECTED: ExpressionSpecification = ['boolean', ['get', '__selected'], false]

// a colour as maplibre reads it, or null: themeColors' toRgb in the browser
type Resolver = (color: string) => string | null

// a lote's fill and line: the selected one in the theme's map-selected; the rest in its brand or, with colorPor, by a
// `match` on the property (read as text: a number or a missing value falls to the default rather than breaking it)
export function colorDeLote(colors: MapColors, colorPor?: ColorPor | null, resolver: Resolver = (color) => color): ExpressionSpecification {
  if (!colorPor) return ['case', IS_SELECTED, colors.selected, colors.brand]
  const porDefecto = (colorPor.porDefecto ? resolver(colorPor.porDefecto) : null) ?? colors.brand
  const pares = Object.entries(colorPor.colores).flatMap(([valor, color]) => [valor, resolver(color) ?? porDefecto])
  // match takes at least one value: none given, every lote is the default
  const relleno = pares.length
    ? (['match', ['to-string', ['get', colorPor.propiedad]], ...pares, porDefecto] as unknown as ExpressionSpecification)
    : porDefecto
  return ['case', IS_SELECTED, colors.selected, relleno]
}

// coloured by a property the colour is what the map says, so it is filled stronger than the plain lotes around a
// predio, which only outline where they are
export function opacidadDeLote(colorPor?: ColorPor | null): ExpressionSpecification {
  return colorPor ? ['case', IS_SELECTED, 0.75, 0.5] : ['case', IS_SELECTED, 0.45, 0.18]
}
