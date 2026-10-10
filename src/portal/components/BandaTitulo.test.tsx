import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BandaTitulo, CabeceraBanda } from './BandaTitulo'

// the title band of the portal-tributario theme (#55): the form's h1 on the brand, its kind before it on the same
// line, and an optional help button. no favourites: there is no backend for them

const banda = () => screen.getByRole('heading', { level: 1 }).closest('[data-ui="banda-titulo"]') as HTMLElement

describe('BandaTitulo', () => {
  it('draws the kind and the h1 on one line, on-brand over brand, the title in 18px bold', () => {
    render(<BandaTitulo kind="Contribuyente Nº 000012" title="QUISPE MAMANI JUAN" />)
    const h1 = screen.getByRole('heading', { level: 1, name: 'QUISPE MAMANI JUAN' })
    expect(banda()).toHaveClass('bg-brand', 'text-on-brand')
    expect(h1).toHaveClass('text-[18px]', 'font-bold')
    // one flex line: the kind first, then the title
    const linea = h1.parentElement!
    expect(linea).toHaveClass('flex')
    expect(linea.firstElementChild).toHaveTextContent('Contribuyente Nº 000012')
    expect(linea.firstElementChild?.nextElementSibling).toBe(h1)
  })

  it('shows a detail after the title', () => {
    render(<BandaTitulo title="Nuevo contribuyente" detalle="Insertar contribuyente" />)
    expect(banda()).toHaveTextContent(/^Nuevo contribuyenteInsertar contribuyente$/)
  })

  it('has no button unless given a help: no favourites either', () => {
    render(<BandaTitulo kind="Predio" title="01-01-0001" />)
    expect(within(banda()).queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers "?" as the help of the form, and calls it', async () => {
    const ayuda = vi.fn()
    render(<BandaTitulo kind="Predio" title="01-01-0001" ayuda={ayuda} />)
    const boton = within(banda()).getByRole('button', { name: 'Ayuda de este formulario' })
    expect(boton).toHaveTextContent('?')
    expect(boton).toHaveAttribute('type', 'button')
    await userEvent.click(boton)
    expect(ayuda).toHaveBeenCalledOnce()
    expect(within(banda()).getAllByRole('button')).toHaveLength(1)
  })
})

// a ficha's figures on the right of the band: what the classic page shows as stat cards under its header
describe('BandaTitulo: the summary', () => {
  const resumen = [
    { label: 'Predios 2026', value: '1' },
    { label: 'Autoavalúo 2026', value: 'S/ 10,080.45' },
    { label: 'Vigente hasta', value: '—', nota: 'cesado el 01/02/2026' }
  ]
  const lista = () => banda().querySelector('dl') as HTMLElement

  it('keeps the band as it was without one', () => {
    render(<BandaTitulo kind="Predio" title="01-01-0001" />)
    expect(banda()).toHaveClass('flex items-center gap-3 rounded-sm bg-brand px-4 py-[11px] text-on-brand', { exact: true })
    expect(lista()).toBeNull()
  })

  it('draws the figures as a description list after the title, wrapping under it where narrow', () => {
    render(<BandaTitulo kind="Contribuyente Nº 000012" title="QUISPE MAMANI JUAN" resumen={resumen} />)
    expect(lista()).toHaveAttribute('data-ui', 'banda-resumen')
    expect(screen.getByRole('heading', { level: 1 }).parentElement!.nextElementSibling).toBe(lista())
    expect(banda()).toHaveClass('flex', 'flex-wrap', 'bg-brand', 'text-on-brand')
    expect(Array.from(lista().children).map((cifra) => [cifra.querySelector('dt')?.textContent, cifra.querySelector('dd')?.textContent])).toEqual([
      ['Predios 2026', '1'],
      ['Autoavalúo 2026', 'S/ 10,080.45'],
      // a stat card's note goes on, after the figure
      ['Vigente hasta', '— cesado el 01/02/2026']
    ])
  })

  it('writes each label in 12px bold capitals and each figure in 18px bold, after a line of on-brand', () => {
    render(<BandaTitulo title="QUISPE MAMANI JUAN" resumen={resumen} />)
    for (const cifra of Array.from(lista().children)) {
      expect(cifra).toHaveClass('border-l', 'border-on-brand/40')
      expect(cifra.querySelector('dt')).toHaveClass('text-xs', 'font-bold', 'tracking-wide', 'uppercase')
      expect(cifra.querySelector('dd')).toHaveClass('text-[18px]', 'font-bold')
    }
    // the note smaller, not bold
    expect(within(lista()).getByText('cesado el 01/02/2026')).toHaveClass('text-xs', 'font-normal')
  })

  it('keeps the help after the figures', () => {
    render(<BandaTitulo title="QUISPE MAMANI JUAN" resumen={resumen} ayuda={() => {}} />)
    expect(lista().nextElementSibling).toBe(within(banda()).getByRole('button', { name: 'Ayuda de este formulario' }))
  })
})

describe('CabeceraBanda', () => {
  it('puts the summary in the band, not in the row under it', () => {
    render(<CabeceraBanda kind="Predio" title="01-01-0001" resumen={[{ label: 'Titulares 2026', value: '2' }]} badges={<span>URBANO</span>} />)
    expect(within(banda()).getByText('Titulares 2026')).toBeInTheDocument()
    expect(within(banda().nextElementSibling as HTMLElement).queryByText('Titulares 2026')).not.toBeInTheDocument()
  })

  it('puts the badges on the left and the actions on the right, in a row under the band', () => {
    render(<CabeceraBanda kind="Predio" title="01-01-0001" badges={<span>URBANO</span>} aside={<button type="button">Eliminar</button>} />)
    const cabecera = banda().parentElement!
    expect(cabecera).toHaveAttribute('data-ui', 'cabecera-banda')
    const fila = banda().nextElementSibling as HTMLElement
    expect(fila).toHaveAttribute('data-ui', 'cabecera-fila')
    expect(fila.firstElementChild).toHaveTextContent('URBANO')
    expect(fila.lastElementChild).toContainElement(within(fila).getByRole('button', { name: 'Eliminar' }))
    expect(within(banda()).queryByText('URBANO')).not.toBeInTheDocument()
  })

  it('keeps the actions on the right without badges', () => {
    render(<CabeceraBanda title="Nuevo contribuyente" aside={<button type="button">Siguiente</button>} />)
    const fila = banda().nextElementSibling as HTMLElement
    expect(fila.lastElementChild).toHaveClass('ml-auto')
    expect(fila.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Siguiente' }))
  })

  it('draws the band alone when it has neither', () => {
    render(<CabeceraBanda kind="Catastro fiscal" title="Nuevo lote" />)
    expect(banda().nextElementSibling).toBeNull()
  })
})
