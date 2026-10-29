import type { QueryClient } from '@tanstack/react-query'
import { rentas } from '../api'
import { currentYear } from '../components/format'
import type { WorkspaceTab } from './WorkspaceTabs'

// the title each ficha gives its workspace tab, and the query its page reads it from: so a tab opened without
// going to the ficha (openInBackground, the visor's links: wasichai/srtm-ui#164) has the same title the page would
// give it, and the page finds its data already read

export type FichaConTitulo = Extract<WorkspaceTab['kind'], 'predio' | 'contribuyente' | 'declaracion'>

export const tituloPredio = (p: { codigo?: string | null }) => p.codigo ?? 'Predio'
export const tituloContribuyente = (c: { numero_documento?: string | null; nombre_completo?: string | null }) =>
  `${c.numero_documento ?? ''} ${c.nombre_completo ?? ''}`.trim()
export const tituloDeclaracion = (dj: { declaracion: { numero_declaracion?: string | number | null }; predio: { codigo?: string | null } }) =>
  `DJ ${dj.declaracion.numero_declaracion ?? ''} ${dj.predio.codigo ?? ''}`.trim()

export const rutaFicha = (kind: FichaConTitulo, id: string) =>
  ({ predio: `/predios/${id}`, contribuyente: `/contribuyentes/${id}`, declaracion: `/declaraciones/${id}` })[kind]

// the page's own query (PredioPage and ContribuyentePage open on the current year): its key and its fetch
export async function tituloDeFicha(qc: QueryClient, kind: FichaConTitulo, id: string): Promise<string | null> {
  switch (kind) {
    case 'predio': {
      const d = await qc.fetchQuery({ queryKey: ['predio', id, currentYear()], queryFn: () => rentas.predio(id, currentYear()) })
      return tituloPredio(d.predio)
    }
    case 'contribuyente': {
      const d = await qc.fetchQuery({ queryKey: ['contribuyente', id, currentYear()], queryFn: () => rentas.contribuyente(id, currentYear()) })
      return tituloContribuyente(d.contribuyente) || null
    }
    case 'declaracion': {
      const d = await qc.fetchQuery({ queryKey: ['declaracion', id], queryFn: () => rentas.declaracionJurada(id) })
      return tituloDeclaracion(d)
    }
  }
}
