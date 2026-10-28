import { soles } from './formato'
import { etiquetaCategoria, etiquetaConfianza, etiquetaEstado } from './colores'
import type { Asignacion, LoteVisorProps, TramoProps } from './tipos'

// the markup of the visor's popups (catastro-ui's): a bold title and one muted-key / value row per entry, in the
// light theme's tokens (maplibre's popup is white in every theme). everything is escaped
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

const siNo = (v: boolean | null | undefined) => (v === null || v === undefined ? '—' : v ? 'Sí' : 'No')

// the popup of a lote: its codes, the difference and catastro's decision. maplibre drops null properties: they
// arrive as undefined
export function popupLote(p: LoteVisorProps): string {
  return popupDeFilas(p.codigo ?? 'Sin código', [
    p.codigo_catastro ? ['Código catastral', p.codigo_catastro] : null,
    ['Categoría', etiquetaCategoria(p.categoria)],
    ['Confianza', etiquetaConfianza(p.confianza)],
    ['Diferencia de impuesto', soles(p.delta_impuesto, { signo: true })],
    ['Supera 5 UIT', siNo(p.supera_5_uit)],
    ['Estado', etiquetaEstado(p.estado)]
  ])
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
