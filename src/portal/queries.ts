import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { normativa, rentas } from './api'
import { sinVigencia } from './components/EstadoBadge'
import type {
  CorridaBrecha,
  DeclaracionDetalle,
  DeterminacionMasiva,
  Emision,
  FiltrosActas,
  FiltrosBrecha,
  FiltrosCambiosBrecha,
  FiltrosAnuncios,
  FiltrosCuis,
  FiltrosAranceles,
  FiltrosNotificaciones,
  FiltrosParametros,
  FiltrosReporte,
  ParametroTributario
} from './types'
import type { Filtros as FiltrosVisor, Orden as OrdenVisor } from './pages/visor/tipos'

// the user's organization as the portal shows it (srtm-backend's GET /srtm/municipalidad): its name and escudo in the
// shell, where its lotes are for the map, and the place a new address starts on. asked once per sign-in (LoginPage
// forgets it, as another user may be of another organization); while it loads or if it fails, the portal names no
// municipalidad and places nothing
export const MUNICIPALIDAD_KEY = ['municipalidad'] as const

export function useMunicipalidad() {
  return useQuery({ queryKey: MUNICIPALIDAD_KEY, queryFn: rentas.municipalidad, staleTime: Infinity })
}

export function useCatalogos() {
  return useQuery({ queryKey: ['catalogos'], queryFn: rentas.catalogos, staleTime: Infinity })
}

export function useContribuyentes(q: string, page: number) {
  return useQuery({ queryKey: ['contribuyentes', q, page], queryFn: () => rentas.contribuyentes(q, page), placeholderData: keepPreviousData })
}

// the valuación del padrón de origen of a declaración: null when the backend has none to give
export function useValuacionOrigen(declaracion: string) {
  return useQuery({ queryKey: ['valuacion-origen', declaracion], queryFn: () => rentas.valuacionOrigen(declaracion) })
}

// a predio's declaraciones, of a year or of every year: the same query key as the ficha's lists and its titulares
export function useDeclaracionesDePredio(predio: string | null | undefined, anio?: number | null) {
  return useQuery({
    queryKey: ['predio', predio, 'declaraciones', anio ?? 'todas'],
    queryFn: () => rentas.declaracionesDePredio(predio!, anio ?? undefined),
    enabled: Boolean(predio)
  })
}

// what a new declaración of a contribuyente for anio may start from (desde): its most recent vigente one of the
// predio in another year. undefined when there is none
export function declaracionDePartida(filas: DeclaracionDetalle[] | undefined, contribuyente: string | undefined, anio: number | null | undefined) {
  const suyas = (filas ?? []).filter(({ declaracion: d, contribuyente: c }) => {
    const de = c?.id ?? d.contribuyente
    return contribuyente && de === contribuyente && !sinVigencia(d) && d.anio != null && d.anio !== anio
  })
  return suyas.map((f) => f.declaracion).sort((a, b) => b.anio! - a.anio!)[0]
}

// the autoavalúo sugerido of a declaración: asked only when the user asks (refetch), never again by itself, as each
// one is a valuation by the catastro-backend
export function useAutoavaluoSugerido(declaracion: string) {
  return useQuery({
    queryKey: ['autoavaluo-sugerido', declaracion],
    queryFn: () => rentas.autoavaluoSugerido(declaracion),
    enabled: false,
    retry: false,
    gcTime: 0
  })
}

export function usePredios(q: string, page: number) {
  return useQuery({ queryKey: ['predios', q, page], queryFn: () => rentas.predios(q, page), placeholderData: keepPreviousData })
}

// a job still to end: the backend moves it on its own, so the list is asked again. ENSAMBLANDO is still active:
// every part is done, but the final file is not built yet
export const hayActivos = (emisiones: Emision[] | undefined) =>
  (emisiones ?? []).some((e) => e.estado === 'PENDIENTE' || e.estado === 'EN_PROCESO' || e.estado === 'ENSAMBLANDO')

// the emisiones masivas, newest first: asked every 2 s while one of them runs, not at all otherwise
export function useEmisiones() {
  return useQuery({ queryKey: ['emisiones'], queryFn: () => rentas.emisiones(), refetchInterval: (query) => (hayActivos(query.state.data) ? 2000 : false) })
}

// la query key y el queryFn de los parámetros de arbitrios de un año (Llaves.BASE_ARBITRIO, DIMENSIONES_ARBITRIO,
// etc.), compartidos entre el hook reactivo (useParametrosArbitrio), TasasArbitriosPage y el fetch imperativo de
// NuevaDeclaracionPage justo al presentar (wasichai/srtm-ui#94), para que nunca diverjan. anio undefined solo tiene
// sentido para deshabilitar el hook: nadie debe pedir el fetch imperativo sin año
export function parametrosArbitrioQuery(anio: number | undefined) {
  return { queryKey: ['arbitrios', 'parametros', anio ?? null] as const, queryFn: () => rentas.parametrosArbitrio(anio!) }
}

// las filas en vigor de un año: lo que la DJ predial lee para exigir frontis, área construida o la ubicación
// respecto a áreas verdes. undefined (no anio yet, the query carga, or falló): never asked, same cache key
// TasasArbitriosPage uses
export function useParametrosArbitrio(anio: number | undefined) {
  return useQuery({ ...parametrosArbitrioQuery(anio), enabled: anio !== undefined, placeholderData: keepPreviousData })
}

// las bases (BASE_ARBITRIO) de las filas en vigor: el texto de cada servicio (PREDIO, FRONTIS_ML o
// AREA_CONSTRUIDA_M2 - srtm-backend's Base), sin espacios alrededor, como lo lee el backend (Servicios.baseLeida);
// uno en blanco no cuenta. undefined (sin query o aún sin datos) cuenta como ninguna: la DJ no exige nada por ellas,
// como hoy
export function basesDeArbitrio(parametros: ParametroTributario[] | undefined): Set<string> {
  const bases = new Set<string>()
  for (const p of parametros ?? []) {
    const base = p.tipo === 'BASE_ARBITRIO' ? p.texto?.trim() : undefined
    if (base) bases.add(base)
  }
  return bases
}

// las dimensiones (DIMENSIONES_ARBITRIO) de las filas en vigor, por servicio: ZONA, USO, INFLUENCIA o AFLUENCIA
// (srtm-backend's Dimension), separadas de su texto por comas. undefined cuenta como ninguna
export function dimensionesDeArbitrio(parametros: ParametroTributario[] | undefined): Set<string> {
  const dimensiones = new Set<string>()
  for (const p of parametros ?? []) {
    if (p.tipo !== 'DIMENSIONES_ARBITRIO' || !p.texto) continue
    for (const dimension of p.texto.split(',')) {
      const nombre = dimension.trim()
      if (nombre) dimensiones.add(nombre)
    }
  }
  return dimensiones
}

// the reference data, read once (staleTime: Infinity): the model's catalogs, the INEI ubigeos and the valuation
// tables. no write of the portal changes them. a new one of the kind joins this list
const REFERENCIA = new Set<unknown>(['catalogos', 'ubigeos', 'categorias-valor', 'usos-predio', 'obras-categorias'])

// after any write: fichas, lists and totals all read from the same records, so all of them go stale. the reference
// data does not, and a save (which awaits this) does not wait for the whole INEI list again
export function useRefresh() {
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.invalidateQueries({ predicate: (query) => !REFERENCIA.has(query.queryKey[0]) }), [queryClient])
}

// the determinaciones masivas de arbitrios, newest first: asked every 2 s while one of them runs
export function useDeterminaciones() {
  return useQuery({
    queryKey: ['arbitrios', 'determinaciones'],
    queryFn: () => rentas.determinaciones(),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((d: DeterminacionMasiva) => d.estado === 'PENDIENTE' || d.estado === 'EN_PROCESO') ? 2000 : false
  })
}

// the infracciones administrativas' query keys: all under ['infracciones'], so an act invalidates every list, ficha
// and panel that reads them at once (queryKey: claves.infracciones)
export const claves = {
  infracciones: ['infracciones'] as const,
  cuis: ({ vigentes_a, materia, q }: FiltrosCuis) => ['infracciones', 'cuis', vigentes_a ?? null, materia ?? null, q ?? null] as const,
  notificaciones: ({ numero, q, contribuyente, desde, hasta, vencidas_a }: FiltrosNotificaciones, page: number) =>
    ['infracciones', 'notificaciones', numero ?? null, contribuyente ?? null, desde ?? null, hasta ?? null, vencidas_a ?? null, page, q ?? null] as const,
  actas: ({ numero, administrado, codigo, fase, desde, hasta }: FiltrosActas, page: number) =>
    ['infracciones', 'actas', numero ?? null, administrado ?? null, codigo ?? null, fase ?? null, desde ?? null, hasta ?? null, page] as const,
  acta: (id: string) => ['infracciones', 'acta', id] as const,
  panel: (anio: number) => ['infracciones', 'panel', anio] as const,
  plazos: (anio: number) => ['infracciones', 'plazos', anio] as const,
  vencidas: (corte: string, page: number) => ['infracciones', 'vencidas', corte, page] as const,
  notificacionesDe: (contribuyente: string, page: number) => ['infracciones', 'notificaciones-de', contribuyente, page] as const,
  infraccionesDe: (de: 'contribuyentes' | 'predios', id: string) => ['infracciones', 'de', de, id] as const,
  // the anuncios' ones, all under ['anuncios']: an act invalidates the padrón, the ficha and the fichas' tabs at once
  anuncios: ['anuncios'] as const,
  padronAnuncios: ({ contribuyente, clase, estado, vigentes_a, q }: FiltrosAnuncios, page: number) =>
    ['anuncios', 'padron', contribuyente ?? null, clase ?? null, estado ?? null, vigentes_a ?? null, q ?? null, page] as const,
  anuncio: (id: string) => ['anuncios', 'ficha', id] as const,
  tasasAnuncios: (anio: number) => ['anuncios', 'tasas', anio] as const,
  anunciosDe: (de: 'contribuyentes' | 'predios', id: string) => ['anuncios', de, id] as const
}

// the CUIS in force on a day, with each code's multa at that day's UIT (the backend's, never computed here)
export function useCuis(filtros: FiltrosCuis) {
  return useQuery({ queryKey: claves.cuis(filtros), queryFn: () => rentas.catalogoCuis(filtros), placeholderData: keepPreviousData })
}

// a page of the notificaciones previas, vencida or not at vencidas_a as the backend says (never computed here)
export function useNotificaciones(filtros: FiltrosNotificaciones, page: number) {
  return useQuery({ queryKey: claves.notificaciones(filtros, page), queryFn: () => rentas.notificaciones(filtros, page), placeholderData: keepPreviousData })
}

// a page of the expedientes, each with its fase at fase_al_dia and its estado de la deuda (the backend's)
export function useActas(filtros: FiltrosActas, page: number) {
  return useQuery({ queryKey: claves.actas(filtros, page), queryFn: () => rentas.actas(filtros, page), placeholderData: keepPreviousData })
}

// an expediente's ficha: its acta and acts in legal order, and what the legal order allows now
export function useExpediente(id: string) {
  return useQuery({ queryKey: claves.acta(id), queryFn: () => rentas.expediente(id) })
}

// a year's panel: actas, resoluciones, notificadas and what falls due this week, at al_dia (the backend's figures)
export function usePanelInfracciones(anio: number) {
  return useQuery({ queryKey: claves.panel(anio), queryFn: () => rentas.panelInfracciones(anio), placeholderData: keepPreviousData })
}

// the plazos and feriados loaded for a year, and what is missing (the backend's)
export function usePlazosInfracciones(anio: number) {
  return useQuery({ queryKey: claves.plazos(anio), queryFn: () => rentas.plazosInfracciones(anio), placeholderData: keepPreviousData })
}

// the notificaciones previas vencidas at corte that led to no acta, as the backend says (never computed here)
export function useVencidas(corte: string, page: number) {
  return useQuery({ queryKey: claves.vencidas(corte, page), queryFn: () => rentas.notificacionesVencidas(corte, page), placeholderData: keepPreviousData })
}

// a contribuyente's notificaciones previas; asked only once one is chosen
export function useNotificacionesDe(contribuyente: string | undefined, page: number) {
  return useQuery({
    queryKey: claves.notificacionesDe(contribuyente ?? '', page),
    queryFn: () => rentas.notificacionesDe(contribuyente!, page),
    enabled: Boolean(contribuyente)
  })
}

// the infracciones tab of a contribuyente's or a predio's ficha
export function useInfraccionesDe(de: 'contribuyentes' | 'predios', id: string) {
  return useQuery({ queryKey: claves.infraccionesDe(de, id), queryFn: () => rentas.infraccionesDe(de, id) })
}

// the padrón of anuncios with their estado at vigentes_a (the backend's)
export function useAnuncios(filtros: FiltrosAnuncios, page: number) {
  return useQuery({ queryKey: claves.padronAnuncios(filtros, page), queryFn: () => rentas.anuncios(filtros, page), placeholderData: keepPreviousData })
}

export function useAnuncio(id: string) {
  return useQuery({ queryKey: claves.anuncio(id), queryFn: () => rentas.anuncio(id) })
}

export function useTasasAnuncios(anio: number) {
  return useQuery({ queryKey: claves.tasasAnuncios(anio), queryFn: () => rentas.tasasAnuncios(anio), placeholderData: keepPreviousData })
}

export function useAnunciosDe(de: 'contribuyentes' | 'predios', id: string) {
  return useQuery({ queryKey: claves.anunciosDe(de, id), queryFn: () => rentas.anunciosDe(de, id) })
}

// the brecha de recaudación's query keys: all under ['brecha'], so a new corrida invalidates its list and whatever
// reads its rows at once. the rows are keyed by the corrida they come from: a newer one reads them anew
export const clavesBrecha = {
  brecha: ['brecha'] as const,
  corridas: (anio: number) => ['brecha', 'corridas', anio] as const,
  panel: (anio: number, corrida: string) => ['brecha', 'panel', anio, corrida] as const,
  predios: (anio: number, corrida: string, { categoria, sector, confianza }: FiltrosBrecha, page: number) =>
    ['brecha', 'predios', anio, corrida, categoria ?? null, sector ?? null, confianza ?? null, page] as const,
  lotes: (anio: number, corrida: string) => ['brecha', 'lotes', anio, corrida] as const,
  cambios: (anio: number, { desde, marca, objeto }: FiltrosCambiosBrecha, page: number) =>
    ['brecha', 'cambios', anio, desde ?? null, marca ?? null, objeto ?? null, page] as const
}

// a corrida still to end: the backend moves it on its own
export const corridaActiva = (corrida: CorridaBrecha | undefined) => corrida?.estado === 'PENDIENTE' || corrida?.estado === 'EN_CURSO'

// a year's corridas de brecha, newest first: asked every 2 s while one of them runs, not at all otherwise
export function useCorridasBrecha(anio: number, enabled = true) {
  return useQuery({
    queryKey: clavesBrecha.corridas(anio),
    queryFn: () => rentas.corridasBrecha(anio),
    enabled,
    refetchInterval: (query) => ((query.state.data ?? []).some(corridaActiva) ? 2000 : false)
  })
}

// what a TERMINADA corrida measured: asked only once there is one
export function usePanelBrecha(anio: number, corrida: string | undefined) {
  return useQuery({ queryKey: clavesBrecha.panel(anio, corrida ?? ''), queryFn: () => rentas.panelBrecha(anio, corrida), enabled: Boolean(corrida) })
}

export function usePrediosBrecha(anio: number, corrida: string | undefined, filtros: FiltrosBrecha, page: number) {
  return useQuery({
    queryKey: clavesBrecha.predios(anio, corrida ?? '', filtros, page),
    queryFn: () => rentas.prediosBrecha(anio, filtros, page, corrida),
    enabled: Boolean(corrida),
    placeholderData: keepPreviousData
  })
}

// the predios catastro changed, against the year's latest corrida (the backend picks it)
export function useCambiosBrecha(anio: number, filtros: FiltrosCambiosBrecha, page: number, enabled = true) {
  return useQuery({
    queryKey: clavesBrecha.cambios(anio, filtros, page),
    queryFn: () => rentas.cambiosBrecha(anio, filtros, page),
    enabled,
    placeholderData: keepPreviousData
  })
}

export function useLotesBrecha(anio: number, corrida: string | undefined) {
  return useQuery({ queryKey: clavesBrecha.lotes(anio, corrida ?? ''), queryFn: () => rentas.lotesBrecha(anio, corrida), enabled: Boolean(corrida) })
}

// the reportes de brechas (srtm-backend#248): keyed by year and corrida ('' the latest TERMINADA, the backend's pick)
export const clavesReportes = {
  resumen: (anio: number, corrida: string) => ['reportes', 'resumen', anio, corrida] as const,
  catalogo: (anio: number, corrida: string) => ['reportes', 'catalogo', anio, corrida] as const,
  reporte: (clave: string, anio: number, corrida: string, filtros: FiltrosReporte, page: number, size: number) =>
    ['reportes', clave, anio, corrida, filtros, page, size] as const
}

export function useResumenReportes(anio: number, corrida: string, enabled = true) {
  return useQuery({ queryKey: clavesReportes.resumen(anio, corrida), queryFn: () => rentas.resumenReportes(anio, corrida), enabled })
}

export function useCatalogoReportes(anio: number, corrida: string, enabled = true) {
  return useQuery({ queryKey: clavesReportes.catalogo(anio, corrida), queryFn: () => rentas.reportes(anio, corrida), enabled })
}

export function useReporte<T>(clave: string, anio: number, corrida: string, filtros: FiltrosReporte, page: number, size: number, enabled = true) {
  return useQuery({
    queryKey: clavesReportes.reporte(clave, anio, corrida, filtros, page, size),
    queryFn: () => rentas.reporte<T>(clave, anio, corrida, filtros, page, size),
    enabled,
    placeholderData: keepPreviousData
  })
}

// the visor de brechas (wasichai/srtm-ui#154): keyed by year and corrida ('' the latest TERMINADA, the backend's
// pick), as the reportes. the rows and the lotes keep the last data on screen while the next filter loads, but only
// within the same year and corrida
export const clavesVisor = {
  todo: ['visor'] as const,
  panel: (anio: number, corrida: string, prico = false) => ['visor', 'panel', anio, corrida, prico] as const,
  predios: (anio: number, corrida: string, filtros: FiltrosVisor, orden: OrdenVisor, page: number, size: number) =>
    ['visor', 'predios', anio, corrida, filtros, orden, page, size] as const,
  niveles: (id: string) => ['visor', 'niveles', id] as const,
  prediosDeLote: (codigo: string, anio: number, corrida: string) => ['visor', 'lote', codigo, anio, corrida] as const,
  lotes: (anio: number, corrida: string, filtros: FiltrosVisor) => ['visor', 'lotes', anio, corrida, filtros] as const,
  vias: (anio: number) => ['visor', 'vias', anio] as const,
  capas: ['visor', 'capas'] as const
}

const deLaMismaCorrida =
  <T>(anio: number, corrida: string) =>
  (anterior: T | undefined, consulta: { queryKey: readonly unknown[] } | undefined) =>
    consulta?.queryKey[2] === anio && consulta?.queryKey[3] === corrida ? anterior : undefined

// «Solo PRICOs» asks it again: the last figures stay on screen meanwhile, so the visor still knows the backend has PRICOs
export function useVisorPanel(anio: number, corrida: string, prico: boolean, enabled = true) {
  return useQuery({
    queryKey: clavesVisor.panel(anio, corrida, prico),
    queryFn: () => rentas.visorPanel(anio, corrida, prico),
    enabled,
    placeholderData: deLaMismaCorrida(anio, corrida)
  })
}

export function useVisorPredios(anio: number, corrida: string, filtros: FiltrosVisor, orden: OrdenVisor, page: number, size: number, enabled = true) {
  return useQuery({
    queryKey: clavesVisor.predios(anio, corrida, filtros, orden, page, size),
    queryFn: () => rentas.visorPredios(anio, corrida, filtros, orden, page, size),
    enabled,
    placeholderData: deLaMismaCorrida(anio, corrida)
  })
}

// a filter seen before comes from the cache: the lotes of a corrida do not change
export function useVisorLotes(anio: number, corrida: string, filtros: FiltrosVisor, enabled = true) {
  return useQuery({
    queryKey: clavesVisor.lotes(anio, corrida, filtros),
    queryFn: () => rentas.visorLotes(anio, corrida, filtros),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: deLaMismaCorrida(anio, corrida)
  })
}

export function useVisorNiveles(id: string | null) {
  return useQuery({ queryKey: clavesVisor.niveles(id ?? ''), queryFn: () => rentas.visorNiveles(id!), enabled: Boolean(id) })
}

// the predios of the lote clicked, asked when its popup opens. a 404 (the lote is not in the corrida) will not change
export function useVisorPrediosDeLote(codigo: string | null, anio: number, corrida: string) {
  return useQuery({
    queryKey: clavesVisor.prediosDeLote(codigo ?? '', anio, corrida),
    queryFn: () => rentas.visorPrediosDeLote(codigo!, anio, corrida),
    enabled: Boolean(codigo),
    staleTime: 5 * 60_000
  })
}

// what comes from catastro through srtm fails at once (502 when catastro does not answer, 409 when it is not
// configured): the rest of the visor does not wait for it. the map keeps the last year's vías while the new one loads
export function useVisorVias(anio: number, enabled: boolean) {
  return useQuery({ queryKey: clavesVisor.vias(anio), queryFn: () => rentas.visorVias(anio), enabled, placeholderData: keepPreviousData, retry: false })
}

export function useVisorCapas(enabled = true) {
  return useQuery({ queryKey: clavesVisor.capas, queryFn: rentas.visorCapas, enabled, staleTime: 10 * 60_000, retry: false })
}

// Normativa (srtm-backend#186): every write asks the whole of it again (queryKey: clavesNormativa.todo); the DJ's
// combobox of aranceles reads the same aranceles
export const clavesNormativa = {
  todo: ['normativa'] as const,
  tipos: ['normativa', 'tipos'] as const,
  parametros: (filtros: FiltrosParametros) => ['normativa', 'parametros', filtros] as const,
  aranceles: (filtros: FiltrosAranceles, page: number) => ['normativa', 'aranceles', filtros, page] as const
}

export function useTiposDeParametro(enabled = true) {
  return useQuery({ queryKey: clavesNormativa.tipos, queryFn: normativa.tipos, staleTime: Infinity, enabled })
}

export function useParametros(filtros: FiltrosParametros) {
  return useQuery({ queryKey: clavesNormativa.parametros(filtros), queryFn: () => normativa.parametros(filtros), placeholderData: keepPreviousData })
}

export function useAranceles(filtros: FiltrosAranceles, page: number, enabled = true) {
  return useQuery({
    queryKey: clavesNormativa.aranceles(filtros, page),
    queryFn: () => normativa.aranceles(filtros, page),
    placeholderData: keepPreviousData,
    enabled
  })
}
