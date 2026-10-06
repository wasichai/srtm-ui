import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LotesMapImpl from './components/LotesMapImpl'
import type { FeatureCollection } from './components/geo'

// the map of lotes paints with the colours of the active theme (issue #51).
// jsdom has no webgl: the map is a double that keeps its layers and the calls that matter here
const fake = vi.hoisted(() => {
  class FakeMap {
    static all: FakeMap[] = []
    layers: { id: string; paint: Record<string, unknown> }[] = []
    onLoad: (() => void) | null = null
    setPaintProperty = vi.fn()
    setData = vi.fn()
    fitBounds = vi.fn()
    remove = vi.fn()
    constructor() {
      FakeMap.all.push(this)
    }
    on(event: string, ...rest: unknown[]) {
      if (event === 'load') this.onLoad = rest[0] as () => void
    }
    addControl() {}
    addSource() {}
    addLayer(layer: { id: string; paint: Record<string, unknown> }) {
      this.layers.push(layer)
    }
    getSource() {
      return { setData: this.setData }
    }
    getBounds() {
      return { getWest: () => 0, getSouth: () => 0, getEast: () => 0, getNorth: () => 0 }
    }
    getCanvas() {
      return document.createElement('canvas')
    }
    getZoom() {
      return 14
    }
    jumpTo() {}
    resize() {}
    paint(id: string) {
      return this.layers.find((layer) => layer.id === id)?.paint
    }
  }
  return { FakeMap }
})
vi.mock('maplibre-gl', () => {
  class Control {}
  return { Map: fake.FakeMap, NavigationControl: Control, ScaleControl: Control, GeoJSONSource: Control, setWorkerUrl: () => {} }
})

// two themes: one in oklch like wasichai's light and dark (without --map-selected), one in hex like portal-tributario.
// jsdom keeps "oklch(52% …)" in a custom property as "oklch(52%…)" and then refuses it: the test writes 0.52
const THEMES = `
[data-theme='claro'] { --brand: oklch(0.52 0.16 262); --surface: oklch(0.99 0.002 260); }
[data-theme='acero'] { --brand: #3a78af; --map-selected: #c9302c; --surface: #fff; }
`
// jsdom has no canvas either: this 2d context knows the srgb pixels of the oklch colours above
const PIXELS: Record<string, number[]> = {
  'oklch(0.52 0.16 262)': [50, 99, 195, 255],
  'oklch(0.99 0.002 260)': [251, 252, 253, 255]
}
function fakeCanvas() {
  let fill = ''
  const context = {
    get fillStyle() {
      return fill
    },
    set fillStyle(value: string) {
      if (PIXELS[value]) fill = value
    },
    fillRect() {},
    getImageData: () => ({ data: Uint8ClampedArray.from(PIXELS[fill] ?? [0, 0, 0, 255]) })
  }
  return vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => context) as never)
}

const selectedBy = (selected: unknown, other: unknown) => ['case', ['boolean', ['get', '__selected'], false], selected, other]
const ACERO = { brand: 'rgb(58, 120, 175)', selected: 'rgb(201, 48, 44)', surface: 'rgb(255, 255, 255)' }

const LOTES: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'l1:g',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-75.225, -10.948],
            [-75.2245, -10.948],
            [-75.2245, -10.9475],
            [-75.225, -10.948]
          ]
        ]
      },
      properties: {}
    }
  ]
}

// mounts the map on a lote picked and lets it load
function renderMap() {
  const view = render(<LotesMapImpl features={LOTES} selectedId="l1" point={{ value: null, onChange: () => {} }} />)
  const map = fake.FakeMap.all.at(-1)!
  act(() => map.onLoad?.())
  return { ...view, map }
}

let style: HTMLStyleElement
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  style = document.createElement('style')
  style.textContent = THEMES
  document.head.append(style)
})
afterEach(() => {
  style.remove()
  delete document.documentElement.dataset.theme
  fake.FakeMap.all = []
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('mapa de lotes con el tema', () => {
  it('paints the lotes and the point with the colours of the theme', () => {
    document.documentElement.dataset.theme = 'acero'
    const { map } = renderMap()
    expect(map.paint('srtm-lotes-fill')?.['fill-color']).toEqual(selectedBy(ACERO.selected, ACERO.brand))
    expect(map.paint('srtm-lotes-line')?.['line-color']).toEqual(selectedBy(ACERO.selected, ACERO.brand))
    expect(map.paint('srtm-punto')).toMatchObject({ 'circle-color': ACERO.selected, 'circle-stroke-color': ACERO.surface })
    // what does not follow the theme stays
    expect(map.paint('srtm-lotes-fill')?.['fill-opacity']).toEqual(selectedBy(0.45, 0.18))
  })

  // maplibre reads hex, rgb(), hsl() and names, not the oklch of wasichai's themes
  it('turns an oklch theme into rgb, and uses its own colour for a variable the theme lacks', () => {
    fakeCanvas()
    document.documentElement.dataset.theme = 'claro'
    const { map } = renderMap()
    expect(map.paint('srtm-lotes-fill')?.['fill-color']).toEqual(selectedBy('#e8590c', 'rgb(50, 99, 195)'))
    expect(map.paint('srtm-punto')).toMatchObject({ 'circle-color': '#e8590c', 'circle-stroke-color': 'rgb(251, 252, 253)' })
  })

  it('keeps its own colours without a theme', () => {
    const { map } = renderMap()
    expect(map.paint('srtm-lotes-line')?.['line-color']).toEqual(selectedBy('#e8590c', '#3b5bdb'))
    expect(map.paint('srtm-punto')).toMatchObject({ 'circle-color': '#e8590c', 'circle-stroke-color': '#ffffff' })
  })

  it('repaints on a theme change, on the same map, keeping the lote picked and the view', async () => {
    fakeCanvas()
    document.documentElement.dataset.theme = 'claro'
    const { map } = renderMap()
    const data = map.setData.mock.calls.length
    const moves = map.fitBounds.mock.calls.length
    expect(moves).toBeGreaterThan(0)
    expect(map.setPaintProperty).not.toHaveBeenCalled()

    document.documentElement.dataset.theme = 'acero'
    await waitFor(() => expect(map.setPaintProperty).toHaveBeenCalledTimes(4))
    expect(map.setPaintProperty).toHaveBeenCalledWith('srtm-lotes-fill', 'fill-color', selectedBy(ACERO.selected, ACERO.brand))
    expect(map.setPaintProperty).toHaveBeenCalledWith('srtm-lotes-line', 'line-color', selectedBy(ACERO.selected, ACERO.brand))
    expect(map.setPaintProperty).toHaveBeenCalledWith('srtm-punto', 'circle-color', ACERO.selected)
    expect(map.setPaintProperty).toHaveBeenCalledWith('srtm-punto', 'circle-stroke-color', ACERO.surface)
    expect(fake.FakeMap.all).toHaveLength(1)
    expect(map.remove).not.toHaveBeenCalled()
    expect(map.setData).toHaveBeenCalledTimes(data)
    expect(map.fitBounds).toHaveBeenCalledTimes(moves)
  })

  it('stops following the theme once it unmounts', async () => {
    document.documentElement.dataset.theme = 'acero'
    const { map, unmount } = renderMap()
    unmount()
    expect(map.remove).toHaveBeenCalled()
    document.documentElement.dataset.theme = 'claro'
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(map.setPaintProperty).not.toHaveBeenCalled()
  })
})

describe('mapa de lotes: la vista', () => {
  const vecino = (id: string, dx: number) => ({
    ...LOTES.features[0],
    id: `${id}:g`,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-75.225 + dx, -10.948],
          [-75.2245 + dx, -10.948],
          [-75.2245 + dx, -10.9475],
          [-75.225 + dx, -10.948]
        ]
      ]
    }
  })

  it('goes to the lote picked, and stays where the clerk moved it while its neighbours load', () => {
    const { map, rerender } = renderMap()
    const moves = map.fitBounds.mock.calls.length
    expect(moves).toBeGreaterThan(0)

    // the clerk moves the map: the lotes around come, the one picked stays the same
    const conVecinos: FeatureCollection = { type: 'FeatureCollection', features: [...LOTES.features, vecino('l2', 0.001), vecino('l3', 0.002)] }
    rerender(<LotesMapImpl features={conVecinos} selectedId="l1" point={{ value: null, onChange: () => {} }} />)
    expect(map.setData.mock.lastCall?.[0].features).toHaveLength(3)
    expect(map.fitBounds).toHaveBeenCalledTimes(moves)

    // another lote picked: the view goes to it
    rerender(<LotesMapImpl features={conVecinos} selectedId="l3" point={{ value: null, onChange: () => {} }} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(moves + 1)
  })
})
