import { ApiError } from '@wasichai/core'
import { Alert, cn } from '@wasichai/ui'
import { ArrowLeft, Check, Copy, Layers, Maximize, Minimize, Search, Share2, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ThemeMenu } from '../../shell/ThemeMenu'
import { formatInstante } from '../EmisionesPage'
import { CapasVisor, CONTROL, Leyenda, sinCatastro } from './CapasVisor'
import type { Camara, MapaBase } from './estado'
import { MapaVisor } from './MapaVisor'
import { usePantallaAncha } from './pantalla'
import { RUTA_VISOR, useVisor } from './useVisor'
import { textoLatLon, textoUtm } from './utm'
import type { ControlMapa } from './VisorMapa'

// a floating card over the map: rounded, with a soft shadow, in the theme's surface
const TARJETA = 'pointer-events-auto rounded-xl border border-border bg-surface/95 text-ink shadow-lg backdrop-blur-sm'
const BOTON =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand'

// what was copied, for a moment
function useAviso(): [string | null, (texto: string) => void] {
  const [aviso, setAviso] = useState<string | null>(null)
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(reloj.current), [])
  return [
    aviso,
    (texto) => {
      setAviso(texto)
      clearTimeout(reloj.current)
      reloj.current = setTimeout(() => setAviso(null), 2500)
    }
  ]
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

// the browser's own full screen, where it has one (not on an iPhone)
const conPantallaCompleta = () => typeof document !== 'undefined' && document.fullscreenEnabled === true
function useEnPantallaCompleta(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      document.addEventListener('fullscreenchange', avisar)
      return () => document.removeEventListener('fullscreenchange', avisar)
    },
    () => document.fullscreenElement !== null && document.fullscreenElement !== undefined,
    () => false
  )
}

function Buscador({ onBuscar }: { onBuscar: (codigo: string) => boolean }) {
  const [codigo, setCodigo] = useState('')
  const [sinLote, setSinLote] = useState(false)
  return (
    <form
      role="search"
      aria-label="Buscar en el mapa"
      className={cn(TARJETA, 'relative order-1 flex min-w-0 flex-1 basis-48 items-center gap-1 p-1 md:max-w-xs')}
      onSubmit={(e) => {
        e.preventDefault()
        setSinLote(!onBuscar(codigo))
      }}
    >
      <input
        type="search"
        value={codigo}
        onChange={(e) => (setCodigo(e.target.value), setSinLote(false))}
        aria-label="Buscar código de predio"
        placeholder="Buscar código de predio"
        aria-invalid={sinLote || undefined}
        aria-describedby={sinLote ? 'visor-sin-lote' : undefined}
        className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      <button type="submit" aria-label="Buscar" className={BOTON}>
        <Search aria-hidden className="size-4" />
      </button>
      {sinLote && (
        <p id="visor-sin-lote" role="alert" className="absolute top-full mt-1 rounded-lg bg-surface px-2 py-1 text-xs text-danger shadow">
          No hay un lote con ese código en el mapa.
        </p>
      )}
    </form>
  )
}

// the cursor's place in lat/lon and UTM 18S, with a button to copy it; without a cursor (a phone), the centre's
function Coordenadas({ cursor, camara }: { cursor: { lng: number; lat: number } | null; camara: Camara | null }) {
  const [aviso, avisar] = useAviso()
  const punto = cursor ?? (camara ? { lng: camara.center[0], lat: camara.center[1] } : null)
  if (!punto) return null
  const latlon = textoLatLon(punto.lat, punto.lng)
  const utm = textoUtm(punto.lat, punto.lng)
  return (
    <section aria-label="Coordenadas" className={cn(TARJETA, 'absolute right-2 bottom-2 flex items-center gap-2 px-2.5 py-1.5 text-xs')}>
      <div className="min-w-0 font-mono leading-tight tabular-nums">
        <div>
          <span className="text-ink-muted">{cursor ? 'Lat/Lon ' : 'Centro '}</span>
          <output aria-label="Latitud y longitud">{latlon}</output>
        </div>
        <div>
          <span className="text-ink-muted">UTM </span>
          <output aria-label="UTM">{utm}</output>
        </div>
      </div>
      <button
        type="button"
        aria-label="Copiar coordenadas"
        title={aviso ?? 'Copiar coordenadas'}
        onClick={() => void copiar(`${latlon} · UTM ${utm}`).then((ok) => avisar(ok ? 'Coordenadas copiadas' : 'No se pudo copiar'))}
        className={cn(BOTON, 'h-8 px-2')}
      >
        {aviso === 'Coordenadas copiadas' ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      </button>
      <span role="status" className="sr-only">
        {aviso ?? ''}
      </span>
    </section>
  )
}

function Herramientas({ base, onBase }: { base: MapaBase; onBase: (b: MapaBase) => void }) {
  const [aviso, avisar] = useAviso()
  return (
    <div
      role="toolbar"
      aria-label="Herramientas del mapa"
      className={cn(
        TARJETA,
        'order-3 flex items-center gap-1 rounded-full px-2 py-1 max-md:basis-full max-md:justify-center md:absolute md:top-0 md:left-1/2 md:-translate-x-1/2'
      )}
    >
      <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-muted">
        <span className="max-md:sr-only">Mapa base</span>
        <select value={base} onChange={(e) => onBase(e.target.value as MapaBase)} className={cn(CONTROL, 'h-7 rounded-full')}>
          <option value="osm">OpenStreetMap</option>
          <option value="ninguno">Sin mapa base</option>
        </select>
      </label>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <button
        type="button"
        aria-label="Compartir vista"
        className={cn(BOTON, 'h-7 rounded-full whitespace-nowrap')}
        onClick={() => void copiar(window.location.href).then((ok) => avisar(ok ? 'Enlace copiado' : 'No se pudo copiar el enlace'))}
      >
        {aviso === 'Enlace copiado' ? <Check aria-hidden className="size-4" /> : <Share2 aria-hidden className="size-4" />}
        <span className="max-md:hidden">Compartir vista</span>
        <span className="md:hidden">Compartir</span>
      </button>
      <span role="status" className="sr-only">
        {aviso ?? ''}
      </span>
    </div>
  )
}

function Cabecera({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 text-ink">
      <h1 className="truncate text-sm font-semibold">Visor de brechas</h1>
      <div className="min-w-0 flex-1 truncate text-xs text-ink-muted">{children}</div>
      <ThemeMenu />
    </header>
  )
}

// the visor's map on the whole page (wasichai/srtm-ui#157), as a municipal cadastral viewer: the map takes it all and
// the controls float over it. the same map, layers and legend as the visor, over the same url: the visor's tab
// keeps it, «Compartir vista» copies it, «Volver al visor» takes it back
export function VisorPantallaPage() {
  const { anio, corrida, conPermisos, puedeLeer, estado, panel, lotes, vias, clases, clasesVias, leyendaVias } = useVisor()
  const { colorear, mostrarVias, wms, cambiar } = estado
  const ancha = usePantallaAncha()
  // the panel of layers starts open on a wide screen, folded on a phone
  const [capasAbiertas, setCapasAbiertas] = useState(ancha)
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null)
  const control = useRef<ControlMapa>(null)
  const enPantalla = useEnPantallaCompleta()
  const volver = { pathname: RUTA_VISOR, search: estado.search }

  const alternarPantalla = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }

  const corridaLeida = panel.data ? `Corrida del ${formatInstante(panel.data.corrida.terminado ?? null)}` : null

  if (conPermisos && !puedeLeer)
    return (
      <div className="flex h-full flex-col bg-surface">
        <Cabecera />
        <div className="p-4">
          <Alert tone="notice">Sin permiso para ver el visor: pide lectura sobre las corridas de brecha.</Alert>
        </div>
      </div>
    )

  return (
    <div className="flex h-full flex-col bg-surface">
      <Cabecera>{corridaLeida}</Cabecera>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-muted [&_.maplibregl-ctrl-bottom-right]:bottom-14!">
        <MapaVisor
          ref={control}
          pantallaCompleta
          clave={`${anio}|${corrida}`}
          anio={anio}
          corrida={corrida}
          lotes={lotes.data}
          colorear={colorear}
          vias={vias.data}
          mostrarVias={mostrarVias}
          clasesVias={clasesVias}
          wms={wms}
          opacidadLotes={estado.opacidadLotes}
          opacidadVias={estado.opacidadVias}
          base={estado.base}
          camara={estado.camara}
          onCamara={(c) => cambiar({ camara: c })}
          onCursor={setCursor}
        />

        <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start gap-2">
          <Buscador onBuscar={(codigo) => control.current?.irA(codigo) ?? false} />
          <Herramientas base={estado.base} onBase={(b) => cambiar({ base: b })} />
          <div className="pointer-events-none relative z-10 order-2 ml-auto flex flex-col items-end gap-2">
            <div className={cn(TARJETA, 'flex items-center gap-0.5 p-1')}>
              <button
                type="button"
                aria-expanded={capasAbiertas}
                aria-controls="visor-panel-capas"
                onClick={() => setCapasAbiertas((a) => !a)}
                className={cn(BOTON, capasAbiertas && 'bg-surface-muted')}
              >
                <Layers aria-hidden className="size-4" />
                <span className="max-sm:sr-only">Capas</span>
              </button>
              {conPantallaCompleta() && (
                <button
                  type="button"
                  onClick={alternarPantalla}
                  aria-label={enPantalla ? 'Salir de la pantalla completa' : 'Pantalla completa del navegador'}
                  title={enPantalla ? 'Salir de la pantalla completa' : 'Pantalla completa del navegador'}
                  className={BOTON}
                >
                  {enPantalla ? <Minimize aria-hidden className="size-4" /> : <Maximize aria-hidden className="size-4" />}
                </button>
              )}
              <Link to={volver} className={BOTON} aria-label="Volver al visor" title="Volver al visor">
                <ArrowLeft aria-hidden className="size-4" />
                <span className="max-sm:hidden">Volver al visor</span>
              </Link>
            </div>
            <section
              id="visor-panel-capas"
              aria-label="Capas"
              hidden={!capasAbiertas}
              className={cn(TARJETA, 'absolute top-full right-0 mt-2 max-h-[min(70vh,36rem)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto p-3')}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Capas</h2>
                <button type="button" aria-label="Cerrar capas" onClick={() => setCapasAbiertas(false)} className={cn(BOTON, 'h-7 px-1.5')}>
                  <X aria-hidden className="size-4" />
                </button>
              </div>
              <CapasVisor
                colorear={colorear}
                onColorear={(c) => cambiar({ colorear: c })}
                mostrarVias={mostrarVias}
                onMostrarVias={(v) => cambiar({ mostrarVias: v })}
                anio={anio}
                errorVias={vias.isError ? sinCatastro(vias.error, 'las vías') : null}
                wms={wms}
                onWms={(w) => cambiar({ wms: w })}
                opacidadLotes={estado.opacidadLotes}
                onOpacidadLotes={(o) => cambiar({ opacidadLotes: o })}
                opacidadVias={estado.opacidadVias}
                onOpacidadVias={(o) => cambiar({ opacidadVias: o })}
              />
            </section>
          </div>
        </div>

        {(panel.isError || lotes.isError) && (
          <Alert
            tone={panel.error instanceof ApiError && panel.error.status === 404 ? 'notice' : 'danger'}
            className="absolute inset-x-2 top-28 mx-auto max-w-md"
          >
            {panel.error instanceof ApiError && panel.error.status === 404
              ? `Aún no se ha calculado la brecha de ${anio}.`
              : panel.isError
                ? 'No se pudo leer el panel del visor.'
                : 'No se pudieron cargar los lotes del mapa.'}
          </Alert>
        )}

        <Leyenda colorear={colorear} clases={clases} vias={leyendaVias} anio={anio} />
        <Coordenadas cursor={cursor} camara={estado.camara} />
      </div>
    </div>
  )
}
