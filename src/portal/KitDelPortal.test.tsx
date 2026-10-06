import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RecordForm } from '../kit/forms/RecordForm'
import type { SectionSpec } from '../kit/forms/spec'
import { KitDelPortal } from './KitDelPortal'

// the kit's forms as the portal sets them up (their labels: etiquetas.test.tsx)

const SECTIONS: SectionSpec[] = [{ id: 'datos-personales', title: 'Datos personales', fields: [{ name: 'nombres', label: 'Nombres', required: true }] }]

describe('the kit as the portal sets it up', () => {
  it("shows what the backend refuses above a form's buttons as an error alert, in its box", async () => {
    render(
      <KitDelPortal>
        <RecordForm
          sections={SECTIONS}
          initial={{ nombres: 'JUAN' }}
          submitLabel="Guardar"
          onSubmit={async () => {
            throw new Error('El servidor no responde')
          }}
        />
      </KitDelPortal>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('El servidor no responde')
    expect(alerta).toHaveAttribute('data-slot', 'alert')
    expect(alerta).toHaveAttribute('data-tone', 'danger')
    expect(alerta).toHaveClass('rounded-md', 'bg-danger/10', 'px-3', 'py-2', 'text-sm', 'text-danger')
  })
})
