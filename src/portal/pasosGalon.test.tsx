import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Upload } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { BarraInstruccion } from './components/BarraInstruccion'
import { PasosGalon } from './components/PasosGalon'

// the steps of a wizard as chevrons, and the bar under them that says what the current step asks for (issue #54)

const PASOS = [
  { id: 'datos', label: 'Datos del predio' },
  { id: 'ubicacion', label: 'Datos de la ubicación' },
  { id: 'transferentes', label: 'Datos del transferente' }
]

const galon = () => screen.getByRole('list', { name: 'Pasos del trámite' })
const paso = (label: string) => within(galon()).getByText(label).closest('li')!

describe('PasosGalon', () => {
  it('draws an ordered list with one item per step, the current one marked as such', () => {
    render(<PasosGalon pasos={PASOS} actual="ubicacion" />)
    expect(galon().tagName).toBe('OL')
    expect(
      within(galon())
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(PASOS.map((p) => p.label))
    expect(paso('Datos de la ubicación')).toHaveAttribute('aria-current', 'step')
    expect(paso('Datos del predio')).not.toHaveAttribute('aria-current')
    expect(paso('Datos del transferente')).not.toHaveAttribute('aria-current')
  })

  it('names the list after what it is given', () => {
    render(<PasosGalon label="Pasos de la inscripción" pasos={PASOS} actual="datos" />)
    expect(screen.getByRole('list', { name: 'Pasos de la inscripción' })).toBeInTheDocument()
  })

  it('goes to the steps it may go to, and only to those', async () => {
    const onIr = vi.fn()
    render(<PasosGalon pasos={PASOS} actual="ubicacion" onIr={onIr} puedeIr={(id) => id === 'datos'} />)
    await userEvent.click(within(paso('Datos del predio')).getByRole('button', { name: 'Datos del predio' }))
    expect(onIr).toHaveBeenCalledExactlyOnceWith('datos')

    // one it may not go to is not a button: nothing to click, nothing to focus
    expect(within(paso('Datos del transferente')).queryByRole('button')).not.toBeInTheDocument()
    await userEvent.click(within(galon()).getByText('Datos del transferente'))
    expect(onIr).toHaveBeenCalledTimes(1)
  })

  it('leaves the current step as it is: it is not a way to anywhere', () => {
    render(<PasosGalon pasos={PASOS} actual="ubicacion" onIr={() => {}} />)
    expect(within(paso('Datos de la ubicación')).queryByRole('button')).not.toBeInTheDocument()
    // with no puedeIr, every other step can be gone to
    expect(
      within(galon())
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Datos del predio', 'Datos del transferente'])
  })

  it('has no buttons without onIr', () => {
    render(<PasosGalon pasos={PASOS} actual="datos" />)
    expect(within(galon()).queryAllByRole('button')).toEqual([])
  })

  it('walks the steps it may go to with the tab key, skipping the rest', async () => {
    render(
      <>
        <button type="button">antes</button>
        <PasosGalon pasos={PASOS} actual="datos" onIr={() => {}} puedeIr={(id) => id === 'transferentes'} />
      </>
    )
    await userEvent.click(screen.getByRole('button', { name: 'antes' }))
    await userEvent.tab()
    expect(within(galon()).getByRole('button', { name: 'Datos del transferente' })).toHaveFocus()
    await userEvent.tab()
    expect(document.body).toHaveFocus()
  })

  it('draws the current step in the brand and the others muted, with tokens', () => {
    render(<PasosGalon pasos={PASOS} actual="ubicacion" />)
    expect(paso('Datos de la ubicación')).toHaveClass('bg-brand', 'text-on-brand')
    expect(paso('Datos del predio')).toHaveClass('bg-surface-muted', 'text-ink-muted')
    expect(paso('Datos del predio')).not.toHaveClass('bg-brand')
  })

  // the theme's hooks (pasos.css): the list, and each step
  it('marks its parts for the theme', () => {
    render(<PasosGalon pasos={PASOS} actual="datos" />)
    expect(galon()).toHaveAttribute('data-ui', 'pasos-galon')
    for (const li of within(galon()).getAllByRole('listitem')) expect(li).toHaveAttribute('data-ui', 'paso')
  })

  // on a narrow screen the steps scroll sideways instead of wrapping or stretching the page
  it('scrolls sideways, each step on one line', () => {
    render(<PasosGalon pasos={PASOS} actual="datos" />)
    expect(galon()).toHaveClass('flex', 'overflow-x-auto')
    for (const li of within(galon()).getAllByRole('listitem')) expect(li).toHaveClass('shrink-0', 'whitespace-nowrap')
  })
})

describe('BarraInstruccion', () => {
  it('says the step in bold before its instruction', () => {
    render(<BarraInstruccion paso="Paso 2:">complete la ubicación y pulse Siguiente.</BarraInstruccion>)
    const texto = screen.getByText(/complete la ubicación/)
    expect(texto).toHaveTextContent('Paso 2: complete la ubicación y pulse Siguiente.')
    expect(within(texto).getByText('Paso 2:').tagName).toBe('STRONG')
  })

  it('reads the instruction out when it changes', () => {
    render(<BarraInstruccion paso="Paso 1:">complete los datos.</BarraInstruccion>)
    expect(screen.getByText(/complete los datos/)).toHaveAttribute('aria-live', 'polite')
  })

  it('draws the instruction alone, with no step', () => {
    render(<BarraInstruccion>los datos que se muestran son los del padrón.</BarraInstruccion>)
    expect(screen.getByText(/los datos que se muestran/).querySelector('strong')).toBeNull()
  })

  it('has no tools unless it is given some', () => {
    render(<BarraInstruccion paso="Paso 1:">complete los datos.</BarraInstruccion>)
    expect(screen.queryAllByRole('button')).toEqual([])
  })

  // the portal's primary Button (controles.tsx), so the theme knows it as one
  it('draws its tools as primary buttons, each with its icon and label', async () => {
    const importar = vi.fn()
    render(
      <BarraInstruccion paso="Paso 1:" herramientas={[{ label: 'Importar', icon: Upload, onClick: importar }]}>
        complete los datos.
      </BarraInstruccion>
    )
    const boton = screen.getByRole('button', { name: 'Importar' })
    expect(boton).toHaveAttribute('data-slot', 'button')
    expect(boton).toHaveAttribute('data-variant', 'primary')
    expect(boton).toHaveClass('bg-brand', 'text-on-brand')
    expect(boton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(boton)
    expect(importar).toHaveBeenCalledOnce()
  })

  it('draws the prototype bar with tokens and marks it for the theme', () => {
    const { container } = render(<BarraInstruccion paso="Paso 1:">complete los datos.</BarraInstruccion>)
    const barra = container.firstElementChild!
    expect(barra).toHaveAttribute('data-ui', 'barra-instruccion')
    expect(barra).toHaveClass('bg-surface-muted', 'border-line', 'text-ink')
  })
})
