import { describe, expect, it } from 'vitest'
import { PERU, vistaInicial } from './geo'

// where the map opens: the organization's lotes (GET /srtm/municipalidad), never a fixed municipalidad
describe('vistaInicial', () => {
  it("opens on the extent of the organization's lotes", () => {
    expect(vistaInicial({ extension: [-75.76, -14.1, -75.7, -14.04], centro: [-75.73, -14.07] })).toEqual({
      center: [-75.73, -14.07],
      zoom: 14,
      bounds: [
        [-75.76, -14.1],
        [-75.7, -14.04]
      ]
    })
  })

  it('takes the middle of the extent when there is no centre', () => {
    expect(vistaInicial({ extension: [-76, -15, -74, -13], centro: null }).center).toEqual([-75, -14])
  })

  it('opens close on a centre without extent', () => {
    expect(vistaInicial({ extension: null, centro: [-75.22, -10.95] })).toEqual({ center: [-75.22, -10.95], zoom: 14 })
  })

  it("without the backend's place, all of Perú and no municipalidad", () => {
    expect(vistaInicial(null)).toEqual({ center: PERU, zoom: 5 })
    expect(vistaInicial(undefined)).toEqual({ center: PERU, zoom: 5 })
    expect(vistaInicial({ extension: null, centro: null })).toEqual({ center: PERU, zoom: 5 })
  })
})
