import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, renderWithProviders, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rentas, RentasError } from './api'
import { PdfDialog } from './components/PdfDialog'

// the PU and HR in PDF (wasichai/srtm-ui#61): client.request only reads JSON, so rentas.blob fetches the PDF itself,
// with the session's token, and PdfDialog shows it embedded to print or download

const original = globalThis.fetch
let fetch: FetchMock | null = null

// a PDF answer as srtm-backend gives it: inline, with its name
function pdf(filename = 'PU-01-01-0001-2026.pdf') {
  const stub = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      // a string body: jsdom's Blob is not the one fetch's Response reads
      new Response('%PDF-1.7', {
        status: 200,
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` }
      })
  )
  globalThis.fetch = stub as typeof globalThis.fetch
  return stub
}

// jsdom has no object urls
const createObjectURL = vi.fn((_blob: Blob) => 'blob:pdf-1')
const revokeObjectURL = vi.fn((_url: string) => undefined)

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('srtm.token', 'jwt-1')
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  globalThis.fetch = original
})

describe('rentas.blob', () => {
  it("sends the session's token and takes the file name from Content-Disposition", async () => {
    const stub = pdf()
    const { blob, filename } = await rentas.blob('/srtm/predios/p1/pu?anio=2026')
    expect(stub).toHaveBeenCalledTimes(1)
    const [url, init] = stub.mock.calls[0]
    expect(url).toBe('/api/srtm/predios/p1/pu?anio=2026')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt-1')
    expect(filename).toBe('PU-01-01-0001-2026.pdf')
    expect(await blob.text()).toBe('%PDF-1.7')
  })

  it('reads an RFC 5987 file name too', async () => {
    globalThis.fetch = (async () =>
      new Response('%PDF', {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': "attachment; filename*=UTF-8''HR-000123-2026.pdf" }
      })) as typeof globalThis.fetch
    expect((await rentas.blob('/srtm/contribuyentes/c1/hr?anio=2026')).filename).toBe('HR-000123-2026.pdf')
  })

  it('turns a 409 problem+json into an error with its detail and titulares', async () => {
    const titulares = [
      { id: 'c1', nombre: 'QUISPE MAMANI JUAN', documento: '20529936' },
      { id: 'c2', nombre: 'NEIRA CAMPOS ROSA', documento: '43434352' }
    ]
    fetch = mockFetch([{ path: '/srtm/predios/p1/pu', status: 409, body: { title: 'Conflict', detail: 'El predio tiene 2 titulares', titulares } }])
    const error = await rentas.blob('/srtm/predios/p1/pu?anio=2026').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RentasError)
    expect(error).toMatchObject({ status: 409, message: 'El predio tiene 2 titulares', titulares, faltan: [] })
  })

  it('turns a 422 problem+json into an error with what is missing', async () => {
    fetch = mockFetch([{ path: '/srtm/contribuyentes/c1/hr', status: 422, body: { title: 'Faltan parámetros', faltan: ['UIT 2027'] } }])
    const error = await rentas.blob('/srtm/contribuyentes/c1/hr?anio=2027').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 422, message: 'Faltan parámetros', faltan: ['UIT 2027'], titulares: [] })
  })

  it('signs out on a 401, as the client does', async () => {
    localStorage.setItem('srtm.user', JSON.stringify({ id: 'u1' }))
    fetch = mockFetch([{ path: '/srtm/contribuyentes/c1/hr', status: 401, body: { title: 'Unauthorized' } }])
    const error = await rentas.blob('/srtm/contribuyentes/c1/hr?anio=2026').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 401 })
    expect(localStorage.getItem('srtm.token')).toBeNull()
  })
})

describe('PdfDialog', () => {
  const titulo = 'PU — 01-01-0001 — 2026'

  it('says it is generating, then embeds the PDF from a blob url', async () => {
    pdf()
    renderWithProviders(<PdfDialog path="/srtm/predios/p1/pu?anio=2026" titulo={titulo} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: titulo })).toBeInTheDocument()
    expect(screen.getByText('Generando…')).toBeInTheDocument()
    const iframe = await screen.findByTitle(titulo)
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe).toHaveAttribute('src', 'blob:pdf-1')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Generando…')).not.toBeInTheDocument()
  })

  it('downloads it with its file name, and prints the embedded one', async () => {
    pdf()
    renderWithProviders(<PdfDialog path="/srtm/predios/p1/pu?anio=2026" titulo={titulo} onClose={() => undefined} />)
    const descargar = await screen.findByRole('link', { name: 'Descargar' })
    expect(descargar).toHaveAttribute('download', 'PU-01-01-0001-2026.pdf')
    expect(descargar).toHaveAttribute('href', 'blob:pdf-1')

    const iframe = screen.getByTitle(titulo) as HTMLIFrameElement
    const print = vi.fn()
    Object.defineProperty(iframe, 'contentWindow', { value: { print, focus: () => undefined }, configurable: true })
    await userEvent.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('revokes the url when it is closed', async () => {
    pdf()
    const onClose = vi.fn()
    renderWithProviders(<PdfDialog path="/srtm/predios/p1/pu?anio=2026" titulo={titulo} onClose={onClose} />)
    await screen.findByTitle(titulo)
    await userEvent.click(screen.getByText('Cerrar', { selector: 'button' }))
    expect(onClose).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1')
  })

  it('revokes the url when it is unmounted', async () => {
    pdf()
    const { unmount } = renderWithProviders(<PdfDialog path="/srtm/predios/p1/pu?anio=2026" titulo={titulo} onClose={() => undefined} />)
    await screen.findByTitle(titulo)
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1')
  })

  it("shows the error's detail", async () => {
    fetch = mockFetch([{ path: '/srtm/predios/p1/pu', status: 404, body: { title: 'Not Found', detail: 'El predio no tiene declaración vigente en 2026' } }])
    renderWithProviders(<PdfDialog path="/srtm/predios/p1/pu?anio=2026" titulo={titulo} onClose={() => undefined} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('El predio no tiene declaración vigente en 2026')
    expect(screen.queryByTitle(titulo)).not.toBeInTheDocument()
    expect(screen.queryByText('Generando…')).not.toBeInTheDocument()
  })

  it('lists what is missing on a 422', async () => {
    fetch = mockFetch([{ path: '/srtm/contribuyentes/c1/hr', status: 422, body: { title: 'Faltan parámetros', faltan: ['UIT 2027'] } }])
    renderWithProviders(<PdfDialog path="/srtm/contribuyentes/c1/hr?anio=2027" titulo="HR — 000123 — 2027" onClose={() => undefined} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Faltan parámetros: UIT 2027')
  })

  it('hands the error to its opener, who may take it (a 409 with titulares)', async () => {
    fetch = mockFetch([{ path: '/srtm/predios/p1/pu', status: 409, body: { title: 'Conflict', titulares: [{ id: 'c1', nombre: 'JUAN', documento: '1' }] } }])
    const onError = vi.fn()
    renderWithProviders(<PdfDialog path="/srtm/predios/p1/pu?anio=2026" titulo={titulo} onClose={() => undefined} onError={onError} />)
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onError.mock.calls[0][0]).toMatchObject({ status: 409, titulares: [{ id: 'c1' }] })
  })
})
