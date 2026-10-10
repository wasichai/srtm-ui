import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBrowserRouter, Link, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useVolver } from './useVolver'

function Formulario() {
  const volver = useVolver('/lista')
  return (
    <button type="button" onClick={volver}>
      Cancelar
    </button>
  )
}

// a browser router: the entries it numbers live in window.history, as in the portal
function abrirEn(path: string) {
  window.history.pushState({}, '', path)
  const router = createBrowserRouter([
    { path: '/inicio', element: <Link to="/formulario">Nuevo</Link> },
    { path: '/lista', element: <h1>Lista</h1> },
    { path: '/formulario', element: <Formulario /> }
  ])
  render(<RouterProvider router={router} />)
  return router
}

describe('useVolver', () => {
  it('goes back to the screen the clerk came from', async () => {
    const router = abrirEn('/inicio')
    await userEvent.click(screen.getByRole('link', { name: 'Nuevo' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('link', { name: 'Nuevo' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/inicio')
  })

  it('goes to its alternative when the screen was where the portal opened (another browser tab, a link)', async () => {
    const router = abrirEn('/formulario')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/lista')
  })
})
