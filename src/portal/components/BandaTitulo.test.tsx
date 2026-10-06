import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { BandaTitulo, CabeceraBanda } from './BandaTitulo'

// the title band of the portal-tributario theme (#55): the form's h1 on the brand, its kind before it on the same
// line, the form's name or the trail to the page on the right, and an optional help button. no favourites: there is
// no backend for them

const banda = () => screen.getByRole('heading', { level: 1 }).closest('[data-ui="banda-titulo"]') as HTMLElement
// CabeceraBanda reads the trail of the page it is on
const enRuta = (ui: ReactElement, path = '/') => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>)

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

  // the classic shell's strip has no place in the portal: its last two steps go where the detail goes
  it('shows the last two steps of a trail in the place of the detail, as a nav', () => {
    render(<BandaTitulo kind="Predio" title="01-01-0001" ruta={['Registro tributario y determinación', 'Registro tributario', 'Registro de predio']} />)
    const ruta = within(banda()).getByRole('navigation', { name: 'Ruta' })
    expect(ruta).toHaveTextContent(/^Registro tributario › Registro de predio$/)
    expect(ruta).toHaveClass('ml-auto', 'text-xs', 'font-semibold', 'uppercase', 'italic')
    expect(ruta.previousElementSibling).toBe(screen.getByRole('heading', { level: 1 }))
  })

  it('keeps the detail over a trail, and draws nothing for an empty one', () => {
    const { unmount } = render(<BandaTitulo title="Nuevo contribuyente" detalle="Insertar contribuyente" ruta={['Registro tributario', 'Contribuyentes']} />)
    expect(within(banda()).queryByRole('navigation')).not.toBeInTheDocument()
    expect(banda()).toHaveTextContent(/^Nuevo contribuyenteInsertar contribuyente$/)
    unmount()
    render(<BandaTitulo title="Nuevo lote" ruta={[]} />)
    expect(within(banda()).queryByRole('navigation')).not.toBeInTheDocument()
    expect(banda()).toHaveTextContent(/^Nuevo lote$/)
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

describe('CabeceraBanda', () => {
  it('puts the badges on the left and the actions on the right, in a row under the band', () => {
    enRuta(<CabeceraBanda kind="Predio" title="01-01-0001" badges={<span>URBANO</span>} aside={<button type="button">Eliminar</button>} />)
    const cabecera = banda().parentElement!
    expect(cabecera).toHaveAttribute('data-ui', 'cabecera-banda')
    const fila = banda().nextElementSibling as HTMLElement
    expect(fila).toHaveAttribute('data-ui', 'cabecera-fila')
    expect(fila.firstElementChild).toHaveTextContent('URBANO')
    expect(fila.lastElementChild).toContainElement(within(fila).getByRole('button', { name: 'Eliminar' }))
    expect(within(banda()).queryByText('URBANO')).not.toBeInTheDocument()
  })

  it('keeps the actions on the right without badges', () => {
    enRuta(<CabeceraBanda title="Nuevo contribuyente" aside={<button type="button">Siguiente</button>} />)
    const fila = banda().nextElementSibling as HTMLElement
    expect(fila.lastElementChild).toHaveClass('ml-auto')
    expect(fila.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Siguiente' }))
  })

  it('draws the band alone when it has neither', () => {
    enRuta(<CabeceraBanda kind="Catastro fiscal" title="Nuevo lote" />)
    expect(banda().nextElementSibling).toBeNull()
  })

  it('shows the trail of its page in the band', () => {
    enRuta(<CabeceraBanda kind="Contribuyente Nº 000012" title="QUISPE MAMANI JUAN" />, '/contribuyentes/c1')
    expect(within(banda()).getByRole('navigation', { name: 'Ruta' })).toHaveTextContent(/^Registro tributario › Registro de contribuyente$/)
  })

  it("keeps a page's own detail, and shows no trail where its page has none", () => {
    const { unmount } = enRuta(<CabeceraBanda title="Nuevo contribuyente" detalle="Insertar contribuyente" />, '/contribuyentes/nuevo')
    expect(within(banda()).queryByRole('navigation')).not.toBeInTheDocument()
    expect(within(banda()).getByText('Insertar contribuyente')).toBeInTheDocument()
    unmount()
    enRuta(<CabeceraBanda kind="Anuncio" title="A-0001" />, '/anuncios/a1')
    expect(within(banda()).queryByRole('navigation')).not.toBeInTheDocument()
  })
})
