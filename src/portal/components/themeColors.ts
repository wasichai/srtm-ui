// the map of lotes paints with the active theme: its colours are css variables on <html>, read when the map loads
// and again on every theme change. maplibre reads hex, rgb(), hsl() and colour names, not the oklch of wasichai's themes

export interface MapColors {
  // the lotes: fill and line
  brand: string
  // the lote picked, and the point
  selected: string
  // the ring around the point
  surface: string
}

// the only hex of the map (the colours it had before it followed the theme): used when a variable is missing
// (tests, ssr, a theme without --map-selected) or holds something that is not a colour
export const MAP_FALLBACK: MapColors = { brand: '#3b5bdb', selected: '#e8590c', surface: '#ffffff' }

const VARIABLES: Record<keyof MapColors, string> = { brand: '--brand', selected: '--map-selected', surface: '--surface' }

export function mapColors(): MapColors {
  if (typeof document === 'undefined') return MAP_FALLBACK
  const style = getComputedStyle(document.documentElement)
  const read = (key: keyof MapColors) => toRgb(style.getPropertyValue(VARIABLES[key])) ?? MAP_FALLBACK[key]
  return { brand: read('brand'), selected: read('selected'), surface: read('surface') }
}

// any css colour as rgb(), or null. the browser resolves it on a probe (color-mix, relative colours…), and a 1x1
// canvas turns what it does not give as rgb (oklch, lab, color()) into srgb pixels
export function toRgb(value: string): string | null {
  const probe = document.createElement('span')
  probe.style.color = value.trim()
  if (!probe.style.color) return null
  probe.hidden = true
  document.body.append(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  if (computed.startsWith('rgb')) return computed
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.fillStyle = computed
  context.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`
}

// calls back on every theme change (the data-theme of <html>); returns the function that stops it
export function watchTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}
