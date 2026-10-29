import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { CategoriaBrecha, Confianza, DecisionBrecha } from '../../types'
import { COLOREAR, type Colorear } from './colores'
import { CATEGORIAS_VISOR, CONFIANZAS_VISOR, ESTADOS_VISOR, type CapaVisor, type CapaWmsActiva, type Filtros, type Orden } from './tipos'

// what the visor shows lives in its url (wasichai/srtm-ui#157): the filters, the colouring, the layers and the view
// of the map. so the visor's workspace tab comes back to it as it was left, the full page opens on the same view, and
// «Compartir vista» is the url itself. only what differs from the defaults is written

export type MapaBase = 'osm' | 'ninguno'

// the centre (lon, lat) and zoom of the map
export interface Camara {
  center: [number, number]
  zoom: number
}

export interface EstadoVisor {
  filtros: Filtros
  orden: Orden
  colorear: Colorear
  mostrarVias: boolean
  // null: the url says nothing of the layers, and the visor's default is on (capasPorDefecto); [] they are all off
  wms: CapaWmsActiva[] | null
  // the opacity of the lotes and of the vías, 0 to 1
  opacidadLotes: number
  opacidadVias: number
  base: MapaBase
  camara: Camara | null
}

export const OPACIDAD_LOTES = 0.6
export const OPACIDAD_VIAS = 1

// the keys of the visor's state in the url: SelectorCorrida keeps them when the year or the corrida changes
export const CLAVES_VISOR = [
  'categoria',
  'confianza',
  'estado',
  'sector',
  'supera_5_uit',
  'min_delta',
  'prico',
  'orden',
  'colorear',
  'vias',
  'wms',
  'ol',
  'ov',
  'base',
  'c',
  'z'
] as const

const lista = <T extends string>(valor: string | null, validos: readonly T[]): T[] =>
  (valor ?? '').split(',').filter((v): v is T => (validos as readonly string[]).includes(v))

const fraccion = (valor: string | null, porDefecto: number) => {
  const n = Number(valor)
  return valor !== null && valor !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : porDefecto
}

const ORDENES: readonly Orden[] = ['delta_desc', 'delta_asc', 'codigo']

// «capa@70,otra@35»: a GeoServer name may carry a «:» (workspace:layer), never an «@»
function leerWms(valor: string | null): CapaWmsActiva[] | null {
  if (valor === null) return null
  if (!valor) return []
  return valor.split(',').flatMap((parte) => {
    const arroba = parte.lastIndexOf('@')
    const layerName = arroba > 0 ? parte.slice(0, arroba) : parte
    return layerName ? [{ layerName, opacity: fraccion(arroba > 0 ? parte.slice(arroba + 1) : null, OPACIDAD_WMS) }] : []
  })
}

function leerCamara(c: string | null, z: string | null): Camara | null {
  const [lon, lat] = (c ?? '').split(',').map(Number)
  const zoom = Number(z)
  if (!c || !z || ![lon, lat, zoom].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { center: [lon, lat], zoom }
}

export function leerEstado(params: URLSearchParams): EstadoVisor {
  const colorear = params.get('colorear')
  const orden = params.get('orden')
  const supera = params.get('supera_5_uit')
  return {
    filtros: {
      categoria: lista<CategoriaBrecha>(params.get('categoria'), CATEGORIAS_VISOR),
      confianza: lista<Confianza>(params.get('confianza'), CONFIANZAS_VISOR),
      estado: lista<DecisionBrecha>(params.get('estado'), ESTADOS_VISOR),
      sector: params.get('sector') ?? '',
      supera_5_uit: supera === 'true' || supera === 'false' ? supera : '',
      min_delta: params.get('min_delta') ?? '',
      prico: params.get('prico') === 'true'
    },
    orden: ORDENES.includes(orden as Orden) ? (orden as Orden) : 'delta_desc',
    colorear: colorear && colorear in COLOREAR ? (colorear as Colorear) : 'categoria',
    mostrarVias: params.get('vias') === '1',
    wms: leerWms(params.get('wms')),
    opacidadLotes: fraccion(params.get('ol'), OPACIDAD_LOTES),
    opacidadVias: fraccion(params.get('ov'), OPACIDAD_VIAS),
    base: params.get('base') === 'ninguno' ? 'ninguno' : 'osm',
    camara: leerCamara(params.get('c'), params.get('z'))
  }
}

// the layers on when the url says nothing of them: catastro's predios, by their GeoServer name and not by their label
// (predio_catastral__<hash>__lote_geom), at the opacity a layer starts with
export const PREFIJO_PREDIOS = 'predio_catastral__'
export const OPACIDAD_WMS = 0.7
export const capasPorDefecto = (capas: readonly CapaVisor[]): CapaWmsActiva[] =>
  capas.filter((c) => c.layerName.startsWith(PREFIJO_PREDIOS)).map((c) => ({ layerName: c.layerName, opacity: OPACIDAD_WMS }))

const porciento = (f: number) => String(Math.round(f * 100))

// the state written over `params`: the visor's own keys replaced, every other one (anio, corrida) kept
export function escribirEstado(params: URLSearchParams, e: EstadoVisor): URLSearchParams {
  const p = new URLSearchParams(params)
  for (const k of CLAVES_VISOR) p.delete(k)
  const poner = (k: string, v: string, si = v !== '') => si && p.set(k, v)
  poner('categoria', e.filtros.categoria.join(','))
  poner('confianza', e.filtros.confianza.join(','))
  poner('estado', e.filtros.estado.join(','))
  poner('sector', e.filtros.sector)
  poner('supera_5_uit', e.filtros.supera_5_uit)
  poner('min_delta', e.filtros.min_delta)
  poner('prico', 'true', e.filtros.prico)
  poner('orden', e.orden, e.orden !== 'delta_desc')
  poner('colorear', e.colorear, e.colorear !== 'categoria')
  poner('vias', '1', e.mostrarVias)
  // «wms=» says they are off, so a link with the layers off keeps them off
  poner('wms', (e.wms ?? []).map((c) => `${c.layerName}@${porciento(c.opacity)}`).join(','), e.wms !== null)
  poner('ol', porciento(e.opacidadLotes), Math.abs(e.opacidadLotes - OPACIDAD_LOTES) > 0.001)
  poner('ov', porciento(e.opacidadVias), Math.abs(e.opacidadVias - OPACIDAD_VIAS) > 0.001)
  poner('base', e.base, e.base !== 'osm')
  if (e.camara) {
    p.set('c', `${e.camara.center[0].toFixed(6)},${e.camara.center[1].toFixed(6)}`)
    p.set('z', String(Math.round(e.camara.zoom * 100) / 100))
  }
  return p
}

// the visor's state, read from the url and written back to it in place (replace: no history entry per pan or
// toggle). the router commits a navigation in a transition, a moment later: until it does, the screen shows the
// query just written (a checkbox does not flick back), and a second change in a row (a pan and a toggle) is made
// over the first. any navigation the router commits, this one's or another's (a tab, the year), is the url again
export function useEstadoVisor() {
  const { search: enUrl } = useLocation()
  const navigate = useNavigate()
  const [escrito, setEscrito] = useState<string | null>(null)
  const pendiente = useRef<string | null>(null)
  useEffect(() => {
    pendiente.current = null
    setEscrito(null)
  }, [enUrl])
  const search = escrito ?? enUrl
  // a part that did not change keeps its object, so a pan does not hand the map new filters nor new layers
  const previo = useRef<EstadoVisor | null>(null)
  const estado = useMemo(() => {
    const nuevo = leerEstado(new URLSearchParams(search))
    const antes = previo.current
    if (antes)
      for (const k of Object.keys(nuevo) as (keyof EstadoVisor)[])
        if (JSON.stringify(antes[k]) === JSON.stringify(nuevo[k])) Object.assign(nuevo, { [k]: antes[k] })
    previo.current = nuevo
    return nuevo
  }, [search])
  const cambiar = useCallback(
    (cambios: Partial<EstadoVisor>) => {
      const actual = new URLSearchParams(pendiente.current ?? window.location.search)
      const nuevo = escribirEstado(actual, { ...leerEstado(actual), ...cambios }).toString()
      if (nuevo === actual.toString()) return
      const consulta = nuevo ? `?${nuevo}` : ''
      pendiente.current = consulta
      setEscrito(consulta)
      navigate({ search: consulta }, { replace: true, preventScrollReset: true })
    },
    [navigate]
  )
  return { ...estado, search, cambiar }
}
