import { describe, expect, it } from 'vitest'
import { aUtm, meridianoCentral, textoLatLon, textoUtm } from './pages/visor/utm'

// WGS84 → UTM 18S of the visor's cursor (wasichai/srtm-ui#157), against PROJ's cs2cs EPSG:4326 → EPSG:32718
describe('la conversión a UTM 18S', () => {
  it.each([
    // Ica
    [-14.06581, -75.73578, 420563.27, 8444871.447],
    // Lima, west of the central meridian
    [-12.046374, -77.042793, 277618.194, 8667490.779],
    // well east of the zone, still written in 18S
    [-16.4, -72.0, 820452.29, 8184447.784],
    // the central meridian on the equator
    [0, -75, 500000, 10000000]
  ])('takes %f, %f to E %f, N %f to the millimetre', (lat, lon, este, norte) => {
    const u = aUtm(lat, lon)
    expect(u.zona).toBe(18)
    expect(u.sur).toBe(true)
    expect(Math.abs(u.este - este)).toBeLessThan(0.002)
    expect(Math.abs(u.norte - norte)).toBeLessThan(0.002)
  })

  it('centres zone 18 on −75°', () => {
    expect(meridianoCentral(18)).toBe(-75)
  })

  it('writes the readout in 6 decimals and whole metres', () => {
    expect(textoLatLon(-14.06581, -75.73578)).toBe('-14.065810, -75.735780')
    expect(textoUtm(-14.06581, -75.73578)).toBe('18S E 420563 N 8444871')
  })
})
