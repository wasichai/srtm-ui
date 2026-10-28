import { legendItems } from '@wasichai/gis'
import { useMemo } from 'react'
import { useVisorLotes, useVisorPanel, useVisorVias } from '../../queries'
import { useWorkspaceTab } from '../../shell/WorkspaceTabs'
import { useAnioYCorrida, usePermisoReportes } from '../reportes/comun'
import { clasesPorValor, leyendaDe, valoresDe } from './colores'
import { useEstadoVisor } from './estado'

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

  const panel = useVisorPanel(anio, corrida, permisos.puedeLeer)
  // the rows and the lotes once the corrida is there: without one the panel's 404 says so, once
  const hay = permisos.puedeLeer && panel.isSuccess
  const lotes = useVisorLotes(anio, corrida, estado.filtros, hay)
  const vias = useVisorVias(anio, hay && estado.mostrarVias)
  const clases = useMemo(() => leyendaDe(estado.colorear), [estado.colorear])
  const clasesVias = useMemo(() => clasesPorValor(valoresDe(vias.data?.features ?? [])), [vias.data])
  const leyendaVias = estado.mostrarVias && vias.data ? legendItems(clasesVias) : null
  return { anio, corrida, ...permisos, estado, panel, hay, lotes, vias, clases, clasesVias, leyendaVias }
}
