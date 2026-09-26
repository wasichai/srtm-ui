import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { AdminApp } from './AdminApp'

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/admin')
})
afterEach(() => fetch?.restore())

// mounts the real App and signs in through its login form. anything else gets the mock's 404 problem
async function signIn() {
  fetch = mockFetch([
    { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: admin } },
    { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
    { path: '/objects', body: [] }
  ])
  render(<AdminApp />)
  const email = await screen.findByLabelText('Correo')
  await userEvent.clear(email)
  await userEvent.type(email, 'admin@wasichai.local')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'admin')
  await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
}

describe('admin', () => {
  it('signs the seeded admin in', async () => {
    await signIn()
    expect(screen.getAllByText('Rentas municipales').length).toBeGreaterThan(0)
    expect(localStorage.getItem('srtm.token')).toBe('t')
  })

  it('adds the screens of the backend modules, and only those', async () => {
    await signIn()
    for (const label of ['Workflows', 'Páginas', 'Vistas', 'Formularios', 'Documentos']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Mapas', 'Capas', 'Reglas', 'Asistente']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
  })
})
