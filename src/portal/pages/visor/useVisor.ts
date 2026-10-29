import { legendItems } from '@wasichai/gis'
import { useMemo } from 'react'
import { useVisorCapas, useVisorLotes, useVisorPanel, useVisorVias } from '../../queries'
import { useWorkspaceTab } from '../../shell/WorkspaceTabs'
import { useAnioYCorrida, usePermisoReportes } from '../reportes/comun'
import { clasesPorValor, leyendaDe, valoresDe } from './colores'
import { capasPorDefecto, useEstadoVisor } from './estado'

// the path of the visor's workspace tab: the full page is the same tab, so it comes back to the visor in the shell
export const RUTA_VISOR = '/brecha/visor'
export const RUTA_PANTALLA = '/brecha/visor/mapa'

// what the visor and its full page share: the corrida of the url, the state of the url, the panel, the lotes and the
// vías, the legend, and the visor's workspace tab, kept on the url it was left on
export function useVisor() {
  const { anio, corrida } = useAnioYCorrida()
  const permisos = usePermisoReportes()
  const estado = useEstadoVisor()
  useWorkspaceTab(permisos.puedeLeer ? { path: RUTA_VISOR, label: 'Visor de brechas', kind: 'visor', search: estado.search } : null)

  const panel = useVisorPanel(anio, corrida, estado.filtros.prico, permisos.puedeLeer)
  // the rows and the lotes once the corrida is there: without one the panel's 404 says so, once
  const hay = permisos.puedeLeer && panel.isSuccess
  // a backend that knows the PRICOs gives their KPI (srtm-backend#273): an older one has no «Solo PRICOs», so a url
  // that asks for it is not applied (nothing would say so, nor take it off)
  const conPricos = panel.data?.kpis.pricos != null
  const filtros = useMemo(() => (conPricos || !estado.filtros.prico ? estado.filtros : { ...estado.filtros, prico: false }), [conPricos, estado.filtros])
  // the layers of the url, or catastro's predios when it says nothing of them
  const capas = useVisorCapas(permisos.puedeLeer)
  const wms = useMemo(() => estado.wms ?? capasPorDefecto(capas.data ?? []), [estado.wms, capas.data])
  const lotes = useVisorLotes(anio, corrida, filtros, hay)
  const vias = useVisorVias(anio, hay && estado.mostrarVias)
  const clases = useMemo(() => leyendaDe(estado.colorear), [estado.colorear])
  const clasesVias = useMemo(() => clasesPorValor(valoresDe(vias.data?.features ?? [])), [vias.data])
  const leyendaVias = estado.mostrarVias && vias.data ? legendItems(clasesVias) : null
  return { anio, corrida, ...permisos, estado, filtros, conPricos, wms, panel, hay, lotes, vias, clases, clasesVias, leyendaVias }
}
