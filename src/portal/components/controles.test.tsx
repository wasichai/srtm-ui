import { render, screen } from '@testing-library/react'
import { Button, Input, Textarea } from '@wasichai/ui'
import { describe, expect, it } from 'vitest'
import { NativeSelect } from './controles'

// the controls carry the hooks a theme styles them by: @wasichai/ui's data-slot (its portal-tributario sheet), and the
// portal's native select, which wears the library's select-trigger slot
describe('controles', () => {
  it("relies on the library's button slots, primary and md by default", () => {
    render(
      <>
        <Button>Guardar</Button>
        <Button variant="secondary" size="sm">
          Cancelar
        </Button>
      </>
    )
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    expect(guardar).toHaveAttribute('data-slot', 'button')
    expect(guardar).toHaveAttribute('data-variant', 'primary')
    expect(guardar).toHaveAttribute('data-size', 'md')
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    expect(cancelar).toHaveAttribute('data-variant', 'secondary')
    expect(cancelar).toHaveAttribute('data-size', 'sm')
  })

  it("relies on the library's field slots", () => {
    render(
      <>
        <Input aria-label="Nombres" />
        <Textarea aria-label="Observación" />
      </>
    )
    expect(screen.getByRole('textbox', { name: 'Nombres' })).toHaveAttribute('data-slot', 'input')
    expect(screen.getByRole('textbox', { name: 'Observación' })).toHaveAttribute('data-slot', 'textarea')
  })

  it("marks the native select as the library's select trigger, keeping aria-invalid and disabled", () => {
    render(
      <>
        <NativeSelect aria-label="Sexo" aria-invalid>
          <option value="">SELECCIONAR</option>
        </NativeSelect>
        <NativeSelect aria-label="Estado civil" disabled>
          <option value="">SELECCIONAR</option>
        </NativeSelect>
      </>
    )
    const sexo = screen.getByRole('combobox', { name: 'Sexo' })
    expect(sexo).toHaveAttribute('data-slot', 'select-trigger')
    expect(sexo).toHaveAttribute('aria-invalid', 'true')
    // selectClass, which keeps the danger border of an invalid select in every theme
    expect(sexo).toHaveClass('aria-[invalid=true]:border-danger')
    expect(screen.getByRole('combobox', { name: 'Estado civil' })).toBeDisabled()
  })
})
