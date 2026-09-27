import 'maplibre-gl/dist/maplibre-gl.css'
import { GeoJSONSource, Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl, type MapLayerMouseEvent, type StyleSpecification } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { boundsOf, PERENE, recordIdOf, type Geometry } from './geo'
import type { LotesMapProps } from './LotesMap'
import { mapWorkerUrl } from './mapWorker'

const LOTES = 'srtm-lotes'
const PUNTO = 'srtm-punto'
const BRAND = '#3b5bdb'
const SELECTED = '#e8590c'

// the OpenStreetMap raster tiles: needs internet. a municipal WMS/WMTS can replace it here
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
}

// the lotes, the selected one in another colour; a point; drawing through terra-draw. one map per mount
export default function LotesMapImpl({ features, selectedId, onSelect, onBounds, draw, point, onCapture, label }: LotesMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const terra = useRef<TerraDraw | null>(null)
  const [ready, setReady] = useState(false)
  // callbacks change every render: the map's listeners read the current ones
  const latest = useRef({ onSelect, onBounds, draw, point })
  latest.current = { onSelect, onBounds, draw, point }

  useEffect(() => {
    if (!container.current) return
    const url = mapWorkerUrl()
    if (url) setWorkerUrl(url)
    const instance = new MapLibreMap({
      container: container.current,
      style: STYLE,
      center: PERENE,
      zoom: 14,
      attributionControl: { compact: true },
      // the camera button reads the canvas
      canvasContextAttributes: { preserveDrawingBuffer: true }
    })
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    instance.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    instance.on('load', () => {
      instance.addSource(LOTES, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      instance.addLayer({
        id: `${LOTES}-fill`,
        type: 'fill',
        source: LOTES,
        paint: {
          'fill-color': ['case', ['boolean', ['get', '__selected'], false], SELECTED, BRAND],
          'fill-opacity': ['case', ['boolean', ['get', '__selected'], false], 0.45, 0.18]
        }
      })
      instance.addLayer({
        id: `${LOTES}-line`,
        type: 'line',
        source: LOTES,
        paint: {
          'line-color': ['case', ['boolean', ['get', '__selected'], false], SELECTED, BRAND],
          'line-width': ['case', ['boolean', ['get', '__selected'], false], 3, 1.5]
        }
      })
      instance.addSource(PUNTO, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      instance.addLayer({
        id: PUNTO,
        type: 'circle',
        source: PUNTO,
        paint: { 'circle-radius': 7, 'circle-color': SELECTED, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }
      })
      instance.on('click', `${LOTES}-fill`, (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.__rid
        if (typeof id === 'string' && !latest.current.draw) latest.current.onSelect?.(id)
      })
      instance.on('mouseenter', `${LOTES}-fill`, () => {
        if (latest.current.onSelect) instance.getCanvas().style.cursor = 'pointer'
      })
      instance.on('mouseleave', `${LOTES}-fill`, () => {
        instance.getCanvas().style.cursor = ''
      })
      instance.on('click', (event) => {
        const p = latest.current.point
        if (p) p.onChange({ type: 'Point', coordinates: [event.lngLat.lng, event.lngLat.lat] })
      })
      const report = () => {
        const b = instance.getBounds()
        latest.current.onBounds?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
      }
      instance.on('moveend', report)
      report()
      setReady(true)
    })
    const resize = new ResizeObserver(() => instance.resize())
    resize.observe(container.current)
    map.current = instance
    onCapture?.(() => {
      try {
        return instance.getCanvas().toDataURL('image/png')
      } catch {
        return null
      }
    })
    return () => {
      resize.disconnect()
      terra.current?.stop()
      terra.current = null
      instance.remove()
      map.current = null
    }
    // one map per mount: props are read through `latest`
  }, [])

  // the lotes, the selected one marked; the view goes to the selected one, or to all of them
  const featuresKey = JSON.stringify(features?.features.map((f) => [recordIdOf(f), f.geometry]) ?? [])
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return
    const list = (features?.features ?? []).filter((f) => f.geometry)
    ;(instance.getSource(LOTES) as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: list.map((f) => {
        const rid = recordIdOf(f)
        return { type: 'Feature', geometry: f.geometry as never, properties: { ...f.properties, __rid: rid, __selected: rid === selectedId } }
      })
    })
    const focus = list.find((f) => recordIdOf(f) === selectedId)
    const bounds = boundsOf(focus ? [focus.geometry] : [])
    if (bounds) instance.fitBounds(bounds, { padding: 80, maxZoom: 18, duration: 300 })
  }, [ready, featuresKey, selectedId])

  // the point, and the view on it
  const pointKey = JSON.stringify(point?.value ?? null)
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return
    const value = point?.value
    ;(instance.getSource(PUNTO) as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: value ? [{ type: 'Feature', geometry: value as never, properties: {} }] : []
    })
    instance.getCanvas().style.cursor = point ? 'crosshair' : ''
  }, [ready, pointKey, Boolean(point)])
  useEffect(() => {
    const instance = map.current
    const value = point?.value as { coordinates?: [number, number] } | null | undefined
    if (instance && ready && value?.coordinates) instance.jumpTo({ center: value.coordinates, zoom: Math.max(instance.getZoom(), 16) })
    // only once the map is up: later points come from the clerk's own click
  }, [ready])

  // drawing: one polygon, draggable and editable once drawn
  const drawing = Boolean(draw)
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready || !drawing) return
    const td = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map: instance }),
      modes: [
        new TerraDrawPolygonMode(),
        new TerraDrawSelectMode({
          flags: { polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } } }
        })
      ]
    })
    td.start()
    const initial = latest.current.draw?.value
    if (initial?.type === 'Polygon') {
      const [added] = td.addFeatures([{ type: 'Feature', geometry: initial as never, properties: { mode: 'polygon' } }])
      td.setMode('select')
      if (added?.valid) td.selectFeature(added.id as string)
      const bounds = boundsOf([initial])
      if (bounds) instance.fitBounds(bounds, { padding: 80, maxZoom: 18, duration: 0 })
    } else {
      td.setMode('polygon')
    }
    const emit = () => {
      const polygons = td.getSnapshot().filter((f) => f.geometry.type === 'Polygon')
      // one lote per predio: a new polygon replaces the old one
      for (const old of polygons.slice(0, -1)) td.removeFeatures([old.id as string])
      latest.current.draw?.onChange((polygons.at(-1)?.geometry as Geometry | undefined) ?? null)
    }
    td.on('finish', (_id, context) => {
      emit()
      if (context.action === 'draw') td.setMode('select')
    })
    terra.current = td
    return () => {
      td.stop()
      terra.current = null
    }
  }, [ready, drawing])

  return <div ref={container} role="region" aria-label={label ?? 'Mapa de lotes'} className="h-full w-full" data-testid="lotes-map" />
}
