import type { StyleSpecification } from 'maplibre-gl'

// the basemap of the portal's maps: the OpenStreetMap raster tiles, so no key is needed (needs internet). a municipal
// WMS/WMTS can replace it here
export const ESTILO_BASE: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
}
