import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecordForm } from './RecordForm'
import type { SectionSpec } from './specs'

// the hooks a theme styles the form by (portal-tributario's partials); light and dark only get the attributes

const SECTIONS: SectionSpec[] = [
  {
    title: 'Datos personales',
    number: 3,
    fields: [
      { name: 'codigo', label: 'Código', readOnly: true },
      { name: 'nombres', label: 'Nombres', required: true },
      { name: 'sexo', label: 'Sexo', kind: 'enum', required: true },
      { name: 'observacion', label: 'Observación', kind: 'longtext' },
      { name: 'documentos', label: 'Documentos', kind: 'multi', choices: ['MINUTA', 'ESCRITURA PUBLICA'] }
    ]
  }
]

function renderForm() {
  const onSubmit = vi.fn(async () => {})
  render(
    <RecordForm
      sections={SECTIONS}
      options={{ sexo: ['HOMBRE', 'MUJER'] }}
      initial={{ codigo: '000012', nombres: '', sexo: '', observacion: '', documentos: '' }}
      submitLabel="Guardar"
      onSubmit={onSubmit}
      onCancel={() => {}}
    />
  )
  return { onSubmit }
}

describe('RecordForm: the theme hooks', () => {
  it('marks its inputs, text areas, selects and buttons', () => {
    renderForm()
    expect(screen.getByRole('textbox', { name: /^Nombres/ })).toHaveAttribute('data-ui', 'input')
    expect(screen.getByRole('textbox', { name: 'Observación' })).toHaveAttribute('data-ui', 'textarea')
    expect(screen.getByRole('combobox', { name: /^Sexo/ })).toHaveAttribute('data-ui', 'select')
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('data-variant', 'primary')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveAttribute('data-variant', 'secondary')
  })

  it('keeps a read-only field disabled, with its hook', () => {
    renderForm()
    const codigo = screen.getByRole('textbox', { name: 'Código' })
    expect(codigo).toBeDisabled()
    expect(codigo).toHaveAttribute('data-ui', 'input')
  })

  it('marks each section as a fieldset whose legend has the number, the title and the action', () => {
    render(
      <RecordForm
        sections={[{ ...SECTIONS[0], action: () => <button type="button">Buscar predios</button> }]}
        options={{ sexo: ['HOMBRE', 'MUJER'] }}
        initial={{ codigo: '', nombres: '', sexo: '', observacion: '', documentos: '' }}
        submitLabel="Guardar"
        onSubmit={async () => {}}
      />
    )
    const fieldset = screen.getByRole('group', { name: /Datos personales/ })
    expect(fieldset).toHaveAttribute('data-ui', 'record-fieldset')
    const legend = fieldset.querySelector('legend')
    expect(legend).toHaveAttribute('data-ui', 'record-legend')
    expect(legend?.querySelector('[data-ui="record-number"]')).toHaveTextContent('3')
    expect(legend?.querySelector('[data-ui="record-title"]')).toHaveTextContent('Datos personales')
    expect(legend?.querySelector('[data-ui="record-action"]')).toContainElement(screen.getByRole('button', { name: 'Buscar predios' }))
  })

  it('keeps aria-invalid on the fields it refuses', async () => {
    const { onSubmit } = renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findAllByText('Este dato es obligatorio')).toHaveLength(2)
    expect(screen.getByRole('textbox', { name: /^Nombres/ })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('combobox', { name: /^Sexo/ })).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
