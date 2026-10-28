import { MapLegend, type LegendItem } from '@wasichai/gis'
import { ApiError } from '@wasichai/core'
import { useVisorCapas } from '../../queries'
import { COLOREAR, type Colorear } from './colores'
import type { CapaVisor, CapaWmsActiva } from './tipos'

export const CONTROL = 'h-8 max-w-full rounded-md border border-border bg-surface px-2 text-sm text-ink'

export const OPACIDAD_INICIAL = 0.7

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
}

// why catastro's layers are not offered: catastro not configured for the organization, or not answering
export function sinCatastro(error: unknown, que: string): string {
  if (error instanceof ApiError && error.status === 409) return 'Catastro no está configurado para esta municipalidad.'
  return `No se pudieron leer ${que} de catastro.`
}

// what the map draws: the colouring of the lotes, the vías with their arancel and the layers catastro publishes
export function CapasVisor({ colorear, onColorear, mostrarVias, onMostrarVias, anio, errorVias, wms, onWms }: CapasVisorProps) {
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
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-ink-muted">Capas</legend>
        <label className="flex items-center gap-2 text-ink">
          <input type="checkbox" checked={mostrarVias} onChange={(e) => onMostrarVias(e.target.checked)} />
          Vías con arancel
          <span className="text-xs text-ink-muted">({anio})</span>
        </label>
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
              const opacidad = Math.round((on?.opacity ?? OPACIDAD_INICIAL) * 100)
              return (
                <li key={c.layerName} className="space-y-1">
                  <label className="flex min-w-0 items-center gap-2 text-ink">
                    <input
                      type="checkbox"
                      checked={!!on}
                      onChange={(e) =>
                        onWms(
                          e.target.checked ? [...wms, { layerName: c.layerName, opacity: OPACIDAD_INICIAL }] : wms.filter((w) => w.layerName !== c.layerName)
                        )
                      }
                    />
                    <span className="truncate" title={c.layerName}>
                      {nombre(c)}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    aria-label={`Opacidad de ${nombre(c)}`}
                    disabled={!on}
                    value={opacidad}
                    aria-valuetext={`${opacidad} %`}
                    onChange={(e) => onWms(wms.map((w) => (w.layerName === c.layerName ? { ...w, opacity: Number(e.target.value) / 100 } : w)))}
                    className="w-full"
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

// the legend of the lotes (and of the vías when they are on), with the colours the map paints
export function Leyenda({ colorear, clases, vias, anio }: { colorear: Colorear; clases: LegendItem[]; vias: LegendItem[] | null; anio: number }) {
  return (
    <section
      aria-label="Leyenda"
      className="absolute bottom-8 left-2 max-h-[70%] max-w-[calc(100%-1rem)] space-y-2 overflow-y-auto rounded-md border border-border bg-surface/95 p-2 text-xs text-ink shadow"
    >
      <MapLegend title={COLOREAR[colorear]} items={clases} showOther={false} className="text-xs" />
      {vias && <MapLegend title={`Vías: valor por m² (${anio})`} items={vias} showOther={false} className="text-xs" />}
    </section>
  )
}
