import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button, Input, NativeSelect, Textarea } from './controles'

// the portal's controls carry the hooks a theme styles them by (portal-tributario's controls.css)
describe('controles', () => {
  it('marks a button with its variant and size, primary and md by default', () => {
    render(
      <>
        <Button>Guardar</Button>
        <Button variant="secondary" size="sm">
          Cancelar
        </Button>
      </>
    )
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    expect(guardar).toHaveAttribute('data-ui', 'button')
    expect(guardar).toHaveAttribute('data-variant', 'primary')
    expect(guardar).toHaveAttribute('data-size', 'md')
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    expect(cancelar).toHaveAttribute('data-variant', 'secondary')
    expect(cancelar).toHaveAttribute('data-size', 'sm')
  })

  it('passes the hooks to the link a button renders as', () => {
    render(
      <Button asChild variant="secondary">
        <a href="/predios">Predios</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Predios' })
    expect(link).toHaveAttribute('data-ui', 'button')
    expect(link).toHaveAttribute('data-variant', 'secondary')
  })

  it('keeps a disabled button disabled', () => {
    render(<Button disabled>Siguiente</Button>)
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('offers a round icon button', () => {
    render(
      <Button variant="round" aria-label="Ayuda">
        ?
      </Button>
    )
    const ayuda = screen.getByRole('button', { name: 'Ayuda' })
    expect(ayuda).toHaveAttribute('data-variant', 'round')
    expect(ayuda).toHaveAttribute('data-size', 'icon')
    expect(ayuda).toHaveClass('rounded-full')
  })

  it('marks inputs, text areas and selects, keeping aria-invalid and disabled', () => {
    render(
      <>
        <Input aria-label="Nombres" aria-invalid />
        <Input aria-label="Código" disabled />
        <Textarea aria-label="Observación" />
        <NativeSelect aria-label="Sexo" aria-invalid>
          <option value="">SELECCIONAR</option>
        </NativeSelect>
      </>
    )
    const nombres = screen.getByRole('textbox', { name: 'Nombres' })
    expect(nombres).toHaveAttribute('data-ui', 'input')
    expect(nombres).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'Código' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Observación' })).toHaveAttribute('data-ui', 'textarea')
    const sexo = screen.getByRole('combobox', { name: 'Sexo' })
    expect(sexo).toHaveAttribute('data-ui', 'select')
    expect(sexo).toHaveAttribute('aria-invalid', 'true')
    // selectClass, which keeps the danger border of an invalid select in every theme
    expect(sexo).toHaveClass('aria-[invalid=true]:border-danger')
  })
})
