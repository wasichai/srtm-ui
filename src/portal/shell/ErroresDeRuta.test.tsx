import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorDeRuta, PaginaNoEncontrada } from './ErroresDeRuta'

// a screen that throws while it renders, until what broke it is mended (react itself renders it again once before
// giving up, so it must keep failing)
let roto = true
function Pantalla() {
  if (roto) throw new Error('dato inesperado')
  return <h1>Pantalla</h1>
}

// the portal's shape: a frame (the shell) around a pathless route that catches its screens' failures
function montar(pantalla: ReactNode, path = '/contribuyentes/c1') {
  const router = createMemoryRouter(
    [
      {
        element: (
          <div>
            <nav aria-label="Secciones">menú</nav>
            <Outlet />
          </div>
        ),
        errorElement: <ErrorDeRuta completa />,
        children: [
          {
            errorElement: <ErrorDeRuta />,
            children: [
              { index: true, element: <h1>Inicio</h1> },
              { path: 'contribuyentes/:id', element: pantalla },
              { path: '*', element: <PaginaNoEncontrada /> }
            ]
          }
        ]
      }
    ],
    { initialEntries: [path] }
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  roto = true
  // react and the router log the caught error: expected here
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorDeRuta', () => {
  it("shows a screen's failure in the content, keeping the shell, and never the error itself", async () => {
    montar(<Pantalla />)
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudo mostrar esta página')
    expect(alerta).not.toHaveTextContent('dato inesperado')
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument()
  })

  it('draws the screen anew on trying again', async () => {
    montar(<Pantalla />)
    const otraVez = await screen.findByRole('button', { name: 'Volver a intentar' })
    roto = false
    await userEvent.click(otraVez)
    expect(await screen.findByRole('heading', { name: 'Pantalla' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('takes home', async () => {
    const router = montar(<Pantalla />)
    await userEvent.click(await screen.findByRole('link', { name: 'Ir al inicio' }))
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('PaginaNoEncontrada', () => {
  it('says the page does not exist, with the way home', async () => {
    montar(<Pantalla />, '/no/existe')
    expect(await screen.findByText('Esta página no existe')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Ir al inicio' }))
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })
})
