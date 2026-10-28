import { useAuth } from '@wasichai/core'
import { useSearchParams } from 'react-router'
import { currentYear } from '../../components/format'
import { usePuede } from '../../components/permisos'
import type { Tono } from '../../components/tono'
import { YearSelect } from '../../components/YearSelect'
import { useCorridasBrecha } from '../../queries'
import type { Confianza, DecisionBrecha } from '../../types'
import { CONFIANZAS } from '../BrechaPage'
import { formatInstante } from '../EmisionesPage'

// what the reportes share: the year and corrida they read (in the url, so a report opened from the tablero, or a link
// handed over, reads the same corrida), the colours of the confianzas and of catastro's decisions

// a confianza's tone (BrechaPage's) as a colour of the theme
const COLOR_TONO: Record<Tono, string> = { verde: 'var(--success)', ambar: 'var(--warning)', rojo: 'var(--danger)', '': 'var(--ink-muted)' }
export const colorConfianza = (confianza: Confianza) => COLOR_TONO[CONFIANZAS[confianza]?.tono ?? '']

// catastro's decisions (decision_brecha), in catastro-ui's order, with its hues in the theme's tokens: the same token
// BrechaPage gives the categoría of that hue (teal the success, orange the warning, blue the brand, red the danger)
export const DECISIONES: Record<DecisionBrecha, { nombre: string; color: string; tono: Tono }> = {
  PENDIENTE: { nombre: 'Pendiente', color: 'var(--success)', tono: '' },
  A_INSPECCIONAR: { nombre: 'A inspeccionar', color: 'var(--warning)', tono: 'ambar' },
  INSPECCIONADO: { nombre: 'Inspeccionado', color: 'var(--brand)', tono: 'verde' },
  A_FISCALIZAR: { nombre: 'A fiscalizar', color: 'var(--danger)', tono: 'rojo' },
  DESCARTADO: { nombre: 'Descartado', color: 'var(--ink-muted)', tono: '' }
}

// the year (this one when not given) and the corrida ('' the latest TERMINADA, the backend's pick) of the url, and a
// search string that keeps them for a link
export function useAnioYCorrida() {
  const [params, setParams] = useSearchParams()
  const anio = Number(params.get('anio')) || currentYear()
  const corrida = params.get('corrida') ?? ''
  const conservar = new URLSearchParams({ anio: String(anio), ...(corrida ? { corrida } : {}) }).toString()
  return { anio, corrida, conservar, params, setParams }
}

// the permissions come after the session, as in the brecha: until then neither "sin permiso" nor a request
export function usePermisoReportes() {
  const auth = useAuth()
  return { conPermisos: auth.permissions !== null || auth.permissionsError !== null, puedeLeer: usePuede('brecha_corrida', 'READ') }
}

const SELECT = 'h-8 max-w-full rounded-md border border-border bg-surface px-2 text-sm text-ink'

// the year and, of its TERMINADA corridas, the one read; a new year goes back to its latest one. the other keys of the
// url go, unless they are in `conservar` (the visor's view: its filters, layers and map stay)
export function SelectorCorrida({ puedeLeer, conservar = [] }: { puedeLeer: boolean; conservar?: readonly string[] }) {
  const { anio, corrida, params, setParams: poner } = useAnioYCorrida()
  const setParams = (nuevos: Record<string, string>) => {
    const p = new URLSearchParams(nuevos)
    for (const k of conservar) for (const v of params.getAll(k)) p.append(k, v)
    poner(p)
  }
  const corridas = useCorridasBrecha(anio, puedeLeer)
  const terminadas = (corridas.data ?? []).filter((c) => c.estado === 'TERMINADA')
  return (
    <div className="flex flex-wrap items-end gap-6">
      <YearSelect value={anio} onChange={(valor) => setParams({ anio: String(valor) })} />
      <label className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
        Corrida
        <select value={corrida} onChange={(e) => setParams({ anio: String(anio), ...(e.target.value ? { corrida: e.target.value } : {}) })} className={SELECT}>
          <option value="">Última terminada</option>
          {/* a corrida of the url not among the TERMINADA ones (or while they load) */}
          {corrida && !terminadas.some((c) => c.id === corrida) && <option value={corrida}>{corrida}</option>}
          {terminadas.map((c) => (
            <option key={c.id} value={c.id}>
              {[formatInstante(c.terminado), c.versionCatastro].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
