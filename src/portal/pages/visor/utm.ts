// WGS84 longitude and latitude to UTM, for the cursor of the visor's full page. Krüger's series to the fourth order
// (Karney 2011), good to well under a millimetre within a zone; no proj4 for one projection. the zone is fixed by
// the caller: the municipalities of srtm are in 18S, and a point a little outside it is still written in 18S, as the
// municipal cadastres do

const A = 6378137
const F = 1 / 298.257223563
const K0 = 0.9996
const N = F / (2 - F)
const A_RECT = (A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64)
const ALFA = [
  N / 2 - (2 / 3) * N ** 2 + (5 / 16) * N ** 3 + (41 / 180) * N ** 4,
  (13 / 48) * N ** 2 - (3 / 5) * N ** 3 + (557 / 1440) * N ** 4,
  (61 / 240) * N ** 3 - (103 / 140) * N ** 4,
  (49561 / 161280) * N ** 4
]
const E = Math.sqrt(F * (2 - F))

export interface Utm {
  zona: number
  sur: boolean
  este: number
  norte: number
}

// the central meridian of a zone: 18 → −75°
export const meridianoCentral = (zona: number) => zona * 6 - 183

export function aUtm(lat: number, lon: number, zona = 18, sur = true): Utm {
  const rad = Math.PI / 180
  const phi = lat * rad
  const lambda = (lon - meridianoCentral(zona)) * rad
  // the conformal latitude, through its tangent
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - E * Math.atanh(E * Math.sin(phi)))
  const xi = Math.atan2(t, Math.cos(lambda))
  const eta = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t))
  let x = eta
  let y = xi
  ALFA.forEach((a, i) => {
    const j = 2 * (i + 1)
    x += a * Math.cos(j * xi) * Math.sinh(j * eta)
    y += a * Math.sin(j * xi) * Math.cosh(j * eta)
  })
  return { zona, sur, este: 500000 + K0 * A_RECT * x, norte: (sur ? 10000000 : 0) + K0 * A_RECT * y }
}

const metros = (n: number) => Math.round(n).toLocaleString('es-PE', { useGrouping: false })

// «-14.065810, -75.735780» and «18S E 420563 N 8444871», as the readout and the copy write them
export const textoLatLon = (lat: number, lon: number) => `${lat.toFixed(6)}, ${lon.toFixed(6)}`
export function textoUtm(lat: number, lon: number): string {
  const u = aUtm(lat, lon)
  return `${u.zona}${u.sur ? 'S' : 'N'} E ${metros(u.este)} N ${metros(u.norte)}`
}
