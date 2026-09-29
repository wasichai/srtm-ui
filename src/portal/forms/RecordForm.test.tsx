import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@wasichai/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SRTM_THEMES } from '../../themes'
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
    expect(screen.getByRole('textbox', { name: /^Nombres/ })).toHaveAttribute('data-slot', 'input')
    expect(screen.getByRole('textbox', { name: 'Observación' })).toHaveAttribute('data-slot', 'textarea')
    expect(screen.getByRole('combobox', { name: /^Sexo/ })).toHaveAttribute('data-slot', 'select-trigger')
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('data-variant', 'primary')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveAttribute('data-variant', 'secondary')
  })

  it('keeps a read-only field disabled, with its hook', () => {
    renderForm()
    const codigo = screen.getByRole('textbox', { name: 'Código' })
    expect(codigo).toBeDisabled()
    expect(codigo).toHaveAttribute('data-slot', 'input')
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

  it('shows what the backend refuses above the buttons as an error alert, in its box', async () => {
    render(
      <RecordForm
        sections={SECTIONS}
        options={{ sexo: ['HOMBRE', 'MUJER'] }}
        initial={{ codigo: '', nombres: 'JUAN', sexo: 'HOMBRE', observacion: '', documentos: '' }}
        submitLabel="Guardar"
        onSubmit={async () => {
          throw new Error('El servidor no responde')
        }}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('El servidor no responde')
    expect(alerta).toHaveAttribute('data-ui', 'alerta')
    expect(alerta).toHaveAttribute('data-tono', 'error')
    expect(alerta).toHaveClass('rounded-md', 'bg-danger/10', 'px-3', 'py-2', 'text-sm', 'text-danger')
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

// the actions' footer (#55): portal-tributario lays it out as the prototype (Cancelar on the left, then a faint note
// and the primary action on the right: banda.css); the markup is the same in every theme
describe('RecordForm: the actions footer', () => {
  const THEMED = { config: { storagePrefix: 'srtm', themes: SRTM_THEMES }, user: null }
  const renderIn = (theme: string, nota?: string) => {
    localStorage.setItem('srtm.theme', theme)
    const onSubmit = vi.fn(async () => {})
    const onCancel = vi.fn()
    renderWithProviders(
      <RecordForm
        sections={SECTIONS}
        options={{ sexo: ['HOMBRE', 'MUJER'] }}
        initial={{ codigo: '000012', nombres: 'JUAN', sexo: 'HOMBRE', observacion: '', documentos: '' }}
        submitLabel="Guardar"
        onSubmit={onSubmit}
        onCancel={onCancel}
        nota={nota}
      />,
      THEMED
    )
    return { onSubmit, onCancel }
  }
  const pie = () => screen.getByRole('button', { name: 'Guardar' }).parentElement!

  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('puts Cancelar before the primary action and the note between them, and both work as before', async () => {
    const { onSubmit, onCancel } = renderIn('portal-tributario', 'Los campos con * son obligatorios')
    expect(document.documentElement.dataset.theme).toBe('portal-tributario')
    expect(pie()).toHaveAttribute('data-ui', 'record-acciones')
    const [cancelar, nota, guardar] = Array.from(pie().children)
    expect(cancelar).toBe(screen.getByRole('button', { name: 'Cancelar' }))
    expect(nota).toHaveAttribute('data-ui', 'record-nota')
    expect(nota).toHaveTextContent('Los campos con * son obligatorios')
    expect(nota).toHaveClass('text-ink-muted')
    expect(guardar).toBe(screen.getByRole('button', { name: 'Guardar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ nombres: 'JUAN', sexo: 'HOMBRE' }))
  })

  it.each(['light', 'portal-tributario'])('keeps the two buttons alone, to the right, without a note, with %s', (theme) => {
    renderIn(theme)
    expect(pie()).toHaveClass('flex', 'justify-end', 'gap-2')
    expect(Array.from(pie().children).map((b) => b.textContent)).toEqual(['Cancelar', 'Guardar'])
    expect(document.querySelector('[data-ui="record-nota"]')).toBeNull()
  })

  it('hides the footer, note included, when the buttons are elsewhere', () => {
    localStorage.setItem('srtm.theme', 'portal-tributario')
    renderWithProviders(<RecordForm sections={SECTIONS} initial={{}} submitLabel="Guardar" onSubmit={async () => {}} hideActions nota="Una nota" />, THEMED)
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Una nota')).not.toBeInTheDocument()
  })
})
