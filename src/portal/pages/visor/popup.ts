import { soles } from './formato'
import type { Asignacion, TramoProps } from './tipos'

// the markup of the visor's vía popups (catastro-ui's; a lote's is PopupLote, with its predios): a bold title and one
// muted-key / value row per entry, in the light theme's tokens (maplibre's popup is white in every theme). everything
// is escaped
export const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function popupDeFilas(titulo: string, filas: ([string, string] | null)[]): string {
  const fila = ([k, v]: [string, string]) =>
    `<div style="display:flex;gap:8px"><span style="color:var(--ink-muted)">${escapar(k)}</span><span>${escapar(v)}</span></div>`
  return (
    `<div data-theme="light" style="color:var(--ink);font:12px/1.5 ui-sans-serif,system-ui">` +
    `<div style="font-weight:600">${escapar(titulo)}</div>` +
    filas.flatMap((f) => (f ? [fila(f)] : [])).join('') +
    `</div>`
  )
}

const ASIGNACION: Record<Asignacion, string> = {
  NOMBRE_UNICO: 'Por nombre de la vía',
  CERCANIA: 'Por cercanía',
  LOTES: 'Por los lotes de la urbanización (revisar)',
  SIN_ARANCEL: 'Sin asignar'
}

const LADO = { AMBOS: 'Ambos lados', IZQUIERDO: 'Izquierdo', DERECHO: 'Derecho' } as const

const nombreDeVia = (p: Pick<TramoProps, 'tip_via' | 'nom_via'>) => [p.tip_via, p.nom_via].filter(Boolean).join(' ')

function valorEnTexto(p: Pick<TramoProps, 'valor_m2' | 'id_aranc' | 'asignacion' | 'anio'>): string {
  if (typeof p.valor_m2 === 'number') return `${soles(p.valor_m2, { minimo: 0, maximo: 2 })} por m²`
  return p.asignacion === 'SIN_ARANCEL' || !p.id_aranc ? 'Sin asignar' : `Sin arancel ${p.anio}`
}

// the popup of a tramo: name, SAT code (id_aranc), value per m², and how the arancel was assigned
export function popupTramo(p: TramoProps): string {
  return popupDeFilas(nombreDeVia(p) || 'Vía sin nombre', [
    p.cuadra ? ['Cuadra', p.cuadra] : null,
    ['Lado', LADO[p.lado] ?? p.lado],
    ['Código SAT', p.id_aranc ?? '—'],
    [`Valor ${p.anio}`, valorEnTexto(p)],
    ['Asignación', ASIGNACION[p.asignacion] ?? p.asignacion]
  ])
}
