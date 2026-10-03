import { screen } from '@testing-library/react'
import { mockFetch, renderWithProviders, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SRTM_THEMES } from '../themes'
import { rentas, RentasError, send } from './api'
import { BadgeDeMapa } from './components/BadgeDeMapa'
import { FaseBadge } from './components/FaseBadge'

// la base común de las infracciones administrativas (PR U1): `send` lanza un RentasError que conserva `faltan`,
// `errors` y `detail` del problem+json (el cliente de core descarta `faltan`) y acepta cabeceras propias (el
// Idempotency-Key de los anuncios); la fase con su mapa explícito, nunca con las suposiciones de tonoDeEstado

const original = globalThis.fetch
let fetch: FetchMock | null = null

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('srtm.token', 'jwt-1')
  delete document.documentElement.dataset.theme
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  globalThis.fetch = original
})

describe('send', () => {
  it('keeps what is missing, the field errors and the detail of a 422', async () => {
    const problema = {
      title: 'Unprocessable Content',
      detail: 'No se puede cifrar la multa',
      faltan: ['UIT 2099', 'CUIS X-001 porcentaje_uit_segunda'],
      errors: [{ field: 'vigencia_desde', message: 'debe ser posterior a la vigente' }]
    }
    fetch = mockFetch([{ method: 'POST', path: '/srtm/infracciones/cuis', status: 422, body: problema }])
    const error = await rentas
      .crearVersionCuis({ codigo: 'X-001', descripcion: 'd', porcentaje_uit: 1, base_legal: 'b', vigencia_desde: '2099-01-01', observacion: 'ficticia' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RentasError)
    expect(error).toMatchObject({
      status: 422,
      message: 'No se puede cifrar la multa',
      detail: 'No se puede cifrar la multa',
      faltan: ['UIT 2099', 'CUIS X-001 porcentaje_uit_segunda'],
      errors: [{ field: 'vigencia_desde', message: 'debe ser posterior a la vigente' }],
      violations: [{ field: 'vigencia_desde', message: 'debe ser posterior a la vigente' }]
    })
  })

  it('says the title when there is no detail, and nothing when there is neither (as core does)', async () => {
    fetch = mockFetch([
      { method: 'POST', path: '/a', status: 409, body: { title: 'Conflict' } },
      { method: 'POST', path: '/b', status: 403, body: {} }
    ])
    expect(await send('POST', '/a', {}).catch((e: unknown) => e)).toMatchObject({ status: 409, message: 'Conflict', detail: null, faltan: [] })
    expect(await send('POST', '/b', {}).catch((e: unknown) => e)).toMatchObject({ status: 403, message: '' })
  })

  it("sends the session's token, JSON and its own headers, and reads the answer", async () => {
    const stub = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ id: 'a1' }), { status: 201 }))
    globalThis.fetch = stub as typeof globalThis.fetch
    expect(await send('POST', '/srtm/anuncios', { area: 1 }, { 'Idempotency-Key': 'clave-1' })).toEqual({ id: 'a1' })
    const [url, init] = stub.mock.calls[0]
    expect(url).toBe('/api/srtm/anuncios')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"area":1}')
    const headers = new Headers(init?.headers)
    expect(headers.get('Idempotency-Key')).toBe('clave-1')
    expect(headers.get('Authorization')).toBe('Bearer jwt-1')
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('answers undefined on a 204', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof globalThis.fetch
    expect(await send('PUT', '/x', {})).toBeUndefined()
  })

  it('signs out on a 401, as the client does', async () => {
    fetch = mockFetch([{ method: 'POST', path: '/x', status: 401, body: { title: 'Unauthorized' } }])
    expect(await send('POST', '/x', {}).catch((e: unknown) => e)).toMatchObject({ status: 401 })
    expect(localStorage.getItem('srtm.token')).toBeNull()
  })
})

const conTema = (ui: React.ReactElement, theme: string) => {
  localStorage.setItem('srtm.theme', theme)
  return renderWithProviders(ui, { config: { storagePrefix: 'srtm', themes: SRTM_THEMES }, user: null })
}

describe('FaseBadge', () => {
  it.each(['light', 'portal-tributario'])('names each fase from its own map with %s', (theme) => {
    conTema(
      <>
        <FaseBadge fase="PREVENTIVA" />
        <FaseBadge fase="CONSTATADA" />
        <FaseBadge fase="SANCIONADA" />
      </>,
      theme
    )
    expect(screen.getByText('Preventiva')).toHaveAttribute('data-tono', 'ambar')
    expect(screen.getByText('Constatada')).toHaveAttribute('data-tono', 'ambar')
    expect(screen.getByText('Sancionada')).toHaveAttribute('data-tono', 'rojo')
  })

  it('shows a dash for no fase, never the nearest one', () => {
    const { container } = conTema(<FaseBadge fase={null} />, 'light')
    expect(container).toHaveTextContent(/^—$/)
  })

  it('shows a value out of its map as it came, untoned, never "Inactivo"', () => {
    conTema(<BadgeDeMapa valor="VENCIDA" mapa={{}} />, 'portal-tributario')
    expect(screen.getByText('VENCIDA')).toHaveAttribute('data-tono', '')
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument()
  })
})
