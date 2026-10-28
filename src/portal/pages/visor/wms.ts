import { WMS_TILE_SIZE, wmsTileUrl } from '@wasichai/gis'
import type { RequestParameters } from 'maplibre-gl'
import { client } from '../../api'

// catastro's GeoServer layers reach the browser through srtm-backend (GET /api/srtm/visor/wms), which checks the
// GetMap and forwards it with the organization's service account: the browser holds only srtm's session

// the path of srtm's WMS forwarding, under the client's base url
export const rutaWms = () => `${client.baseUrl}/srtm/visor/wms`

// a layer's tiles: a GetMap on srtm's forwarding with the layer name; wmsTileUrl adds bbox, size, srs, format and
// transparency. absolute, on this same origin
export function teselasWms(layerName: string, origen: string = window.location.origin): string {
  const p = new URLSearchParams({ service: 'WMS', version: '1.1.1', request: 'GetMap', styles: '', layers: layerName })
  return wmsTileUrl(`${origen}${rutaWms()}?${p}`, WMS_TILE_SIZE)
}

// maplibre asks for a tile with no header of its own: srtm's Bearer goes on the WMS tiles of srtm's forwarding, read
// at each request so a new sign-in is the one sent. never on another url (the OSM basemap's, any other origin's)
export function conTokenVisor(url: string, token: string | null = client.getToken(), origen: string = window.location.origin): RequestParameters {
  let u: URL
  try {
    u = new URL(url, origen)
  } catch {
    return { url }
  }
  if (!token || u.origin !== origen || u.pathname !== rutaWms()) return { url }
  return { url, headers: { Authorization: `Bearer ${token}` } }
}
