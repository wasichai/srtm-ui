import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Pagina } from '../types'
import { RecordPicker, type Picked } from './RecordPicker'

interface Persona {
  id: string
  nombre: string
}

const pagina = (content: Persona[]): Pagina<Persona> => ({ content, page: 0, size: 8, totalElements: content.length, totalPages: 1 })
const buscar = vi.fn(async (q: string) => pagina([{ id: 'c1', nombre: `ANA ${q.toUpperCase()}` }]))

// a form like Nueva acta's: the picker inside, and a button that sends the whole form
function Formulario({ onSubmit, error }: { onSubmit: () => void; error?: string }) {
  const [obligado, setObligado] = useState<Picked | null>(null)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <RecordPicker
        label="Obligado"
        placeholder="DNI, RUC o nombre"
        value={obligado}
        onChange={setObligado}
        search={buscar}
        describe={(p) => ({ id: p.id, label: p.nombre })}
        error={error}
      />
      <p>Elegido: {obligado?.label ?? 'ninguno'}</p>
      <button type="submit">Registrar acta</button>
    </form>
  )
}

function montar(props: { onSubmit: () => void; error?: string }) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Formulario {...props} />
    </QueryClientProvider>
  )
}

describe('RecordPicker', () => {
  it('does not send the form around it on enter: a pick is a click on a result', async () => {
    const onSubmit = vi.fn()
    montar({ onSubmit })
    await userEvent.type(screen.getByLabelText(/Obligado/), 'ana{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'ANA ANA' }))
    expect(screen.getByText('Elegido: ANA ANA')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar acta' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('ties its error to the search box', () => {
    montar({ onSubmit: vi.fn(), error: 'Elige el obligado' })
    const caja = screen.getByLabelText(/Obligado/)
    expect(caja).toHaveAttribute('aria-invalid', 'true')
    expect(caja).toHaveAccessibleDescription('Elige el obligado')
  })
})
