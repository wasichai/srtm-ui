import { MapLegend, type LegendItem } from '@wasichai/gis'
import { ApiError } from '@wasichai/core'
import { Layers } from 'lucide-react'
import { useId, useState } from 'react'
import { useVisorCapas } from '../../queries'
import { COLOREAR, type Colorear } from './colores'
import { OPACIDAD_WMS } from './estado'
import { usePantallaAncha } from './pantalla'
import type { CapaVisor, CapaWmsActiva } from './tipos'

export const CONTROL = 'h-8 max-w-full rounded-md border border-border bg-surface px-2 text-sm text-ink'

export interface CapasVisorProps {
  colorear: Colorear
  onColorear: (c: Colorear) => void
  mostrarVias: boolean
  onMostrarVias: (v: boolean) => void
  anio: number
  // the vías could not be read (catastro not configured, or not answering)
  errorVias?: string | null
  wms: CapaWmsActiva[]
  onWms: (capas: CapaWmsActiva[]) => void
  // the opacity of the lotes and of the vías, 0 to 1: a slider each when it is handed its change
  opacidadLotes?: number
  onOpacidadLotes?: (o: number) => void
  opacidadVias?: number
  onOpacidadVias?: (o: number) => void
  // «Solo PRICOs», when it is handed its change: the full page has no filters of the table (an older backend, none)
  soloPricos?: boolean
  onSoloPricos?: (v: boolean) => void
}

// an opacity in steps of 5 %
function Opacidad({ nombre, valor, onCambio, disabled }: { nombre: string; valor: number; onCambio: (o: number) => void; disabled?: boolean }) {
  const porciento = Math.round(valor * 100)
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={5}
      aria-label={`Opacidad de ${nombre}`}
      disabled={disabled}
      value={porciento}
      aria-valuetext={`${porciento} %`}
      onChange={(e) => onCambio(Number(e.target.value) / 100)}
      className="w-full"
    />
  )
}

// «Solo PRICOs»: only the predios of principales contribuyentes, on the map, in the table and in the CSV
export function SoloPricos({ valor, onCambio }: { valor: boolean; onCambio: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm whitespace-nowrap text-ink">
      <input type="checkbox" role="switch" checked={valor} onChange={(e) => onCambio(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative inline-block h-5 w-9 shrink-0 rounded-full border border-border-control bg-surface-muted transition-colors peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:bg-ink-muted after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-on-brand"
      />
      Solo PRICOs
    </label>
  )
}

// why catastro's layers are not offered: catastro not configured for the organization, or not answering
export function sinCatastro(error: unknown, que: string): string {
  if (error instanceof ApiError && error.status === 409) return 'Catastro no está configurado para esta municipalidad.'
  return `No se pudieron leer ${que} de catastro.`
}

// what the map draws: the colouring of the lotes, the vías with their arancel and the layers catastro publishes
export function CapasVisor({
  colorear,
  onColorear,
  mostrarVias,
  onMostrarVias,
  anio,
  errorVias,
  wms,
  onWms,
  opacidadLotes,
  onOpacidadLotes,
  opacidadVias,
  onOpacidadVias,
  soloPricos,
  onSoloPricos
}: CapasVisorProps) {
  const capas = useVisorCapas()
  const prendida = (layerName: string) => wms.find((c) => c.layerName === layerName)
  const nombre = (c: CapaVisor) => c.label || c.layerName
  return (
    <div className="min-w-0 space-y-3 text-sm">
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Colorear lotes por
        <select value={colorear} onChange={(e) => onColorear(e.target.value as Colorear)} className={CONTROL}>
          {Object.entries(COLOREAR).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {onSoloPricos && <SoloPricos valor={Boolean(soloPricos)} onCambio={onSoloPricos} />}
      {onOpacidadLotes && (
        <div className="space-y-1">
          <span aria-hidden className="text-xs text-ink-muted">
            Opacidad de los lotes
          </span>
          <Opacidad nombre="los lotes" valor={opacidadLotes ?? 0.6} onCambio={onOpacidadLotes} />
        </div>
      )}
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-ink-muted">Capas</legend>
        <label className="flex items-center gap-2 text-ink">
          <input type="checkbox" checked={mostrarVias} onChange={(e) => onMostrarVias(e.target.checked)} />
          Vías con arancel
          <span className="text-xs text-ink-muted">({anio})</span>
        </label>
        {onOpacidadVias && <Opacidad nombre="las vías" valor={opacidadVias ?? 1} onCambio={onOpacidadVias} disabled={!mostrarVias} />}
        {mostrarVias && errorVias && <p className="text-xs text-danger">{errorVias}</p>}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-ink-muted">Catastro (WMS)</legend>
        {capas.isPending ? (
          <p className="text-xs text-ink-muted">Cargando…</p>
        ) : capas.isError ? (
          <p className="text-xs text-danger">{sinCatastro(capas.error, 'las capas')}</p>
        ) : capas.data.length === 0 ? (
          <p className="text-xs text-ink-muted">No hay capas publicadas.</p>
        ) : (
          <ul aria-label="Capas WMS" className="space-y-2">
            {capas.data.map((c) => {
              const on = prendida(c.layerName)
              return (
                <li key={c.layerName} className="space-y-1">
                  <label className="flex min-w-0 items-center gap-2 text-ink">
                    <input
                      type="checkbox"
                      checked={!!on}
                      onChange={(e) =>
                        onWms(e.target.checked ? [...wms, { layerName: c.layerName, opacity: OPACIDAD_WMS }] : wms.filter((w) => w.layerName !== c.layerName))
                      }
                    />
                    <span className="truncate" title={c.layerName}>
                      {nombre(c)}
                    </span>
                  </label>
                  <Opacidad
                    nombre={nombre(c)}
                    valor={on?.opacity ?? OPACIDAD_WMS}
                    disabled={!on}
                    onCambio={(o) => onWms(wms.map((w) => (w.layerName === c.layerName ? { ...w, opacity: o } : w)))}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </fieldset>
    </div>
  )
}

// the legend of the lotes (and of the vías when they are on), with the colours the map paints. on a wide screen it is
// always open; below md it would cover half the map, so it folds behind a «Leyenda» button, closed at first
export function Leyenda({ colorear, clases, vias, anio }: { colorear: Colorear; clases: LegendItem[]; vias: LegendItem[] | null; anio: number }) {
  const ancha = usePantallaAncha()
  const [abierta, setAbierta] = useState(false)
  const id = useId()
  const visible = ancha || abierta
  return (
    <>
      {!ancha && (
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={id}
          onClick={() => setAbierta((a) => !a)}
          className="absolute bottom-8 left-2 flex items-center gap-1 rounded-md border border-border bg-surface/95 px-2 py-1 text-xs font-medium text-ink shadow"
        >
          <Layers aria-hidden className="size-3.5" />
          Leyenda
        </button>
      )}
      <section
        id={id}
        aria-label="Leyenda"
        hidden={!visible}
        className={`absolute left-2 max-h-[70%] max-w-[calc(100%-1rem)] space-y-2 overflow-y-auto rounded-md border border-border bg-surface/95 p-2 text-xs text-ink shadow ${ancha ? 'bottom-8' : 'bottom-16 max-h-[60%]'}`}
      >
        <MapLegend title={COLOREAR[colorear]} items={clases} showOther={false} className="text-xs" />
        {vias && <MapLegend title={`Vías: valor por m² (${anio})`} items={vias} showOther={false} className="text-xs" />}
      </section>
    </>
  )
}
