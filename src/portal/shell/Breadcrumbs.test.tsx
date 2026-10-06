import { render, renderHook, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Breadcrumbs, useRuta } from './Breadcrumbs'

// the srtm's trail to a screen: the classic shell's strip over the page, the portal's title band (CabeceraBanda)

const en = (path: string) =>
  function Router({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  }

const RAIZ = ['Registro tributario y determinación', 'Registro tributario']

describe('useRuta', () => {
  it.each([
    ['/contribuyentes', 'Contribuyentes'],
    ['/contribuyentes/c1', 'Registro de contribuyente'],
    ['/contribuyentes/nuevo', 'Registro de contribuyente'],
    ['/contribuyentes/c1/declaraciones/nueva', 'Declaración jurada predial'],
    ['/declaraciones/d1', 'Declaración jurada predial'],
    ['/predios', 'Predios'],
    ['/predios/p1', 'Registro de predio'],
    ['/catastro/l1', 'Lote de catastro fiscal']
  ])('on %s ends in %s', (path, pantalla) => {
    expect(renderHook(useRuta, { wrapper: en(path) }).result.current).toEqual([...RAIZ, pantalla])
  })

  it.each(['/', '/buscar', '/arbitrios', '/infracciones/a1', '/anuncios/a1', '/emisiones'])('has no trail on %s', (path) => {
    expect(renderHook(useRuta, { wrapper: en(path) }).result.current).toEqual([])
  })
})

describe('Breadcrumbs', () => {
  it('draws the strip of the trail, its last step the current one', () => {
    render(<Breadcrumbs />, { wrapper: en('/predios/p1') })
    const ruta = screen.getByRole('navigation', { name: 'Ruta' })
    expect(ruta).toHaveClass('border-b', 'border-border', 'bg-surface', 'text-xs')
    const pasos = within(ruta).getAllByRole('listitem')
    expect(pasos.map((paso) => paso.textContent)).toEqual([...RAIZ, 'Registro de predio'])
    expect(pasos.map((paso) => paso.getAttribute('aria-current'))).toEqual([null, null, 'page'])
  })

  it('draws nothing where there is no trail', () => {
    const { container } = render(<Breadcrumbs />, { wrapper: en('/') })
    expect(container).toBeEmptyDOMElement()
  })
})
