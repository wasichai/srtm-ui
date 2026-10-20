import type { ReactNode } from 'react'
import { formatMoney, formatNumber, formatText } from '../components/format'
import { celda } from '../forms/etiquetas'
import type { DeclaracionOrigen, NivelConstruccion, NivelOrigen, PredioOrigen } from '../types'

// the valuación del padrón de origen (srtm-backend#132): what an external padrón (Ica) brought, to compare with it.
// read-only, never sent back, and only what has a value: a declaración of the srtm's own shows nothing of it

const NOTA = 'Solo lectura, para cotejar con el padrón de origen. No cambia el impuesto, que sale del autoavalúo.'

// once the declaración is edited (srtm-backend#150's modificada), the valuación no longer describes it
export const AVISO_MODIFICADA = 'La declaración cambió después de la importación: la valuación de origen corresponde a la versión importada.'

// each field with its own formatter, checked against the field's type
type Campo<T> = { [K in keyof T]-?: { campo: K; termino: string; formato: (valor: T[K]) => string } }[keyof T]

const PREDIO: Campo<PredioOrigen>[] = [
  { campo: 'codigo_via', termino: 'Código de vía', formato: formatText },
  { campo: 'codigo_unidad_urbana', termino: 'Código de unidad urbana', formato: formatText },
  { campo: 'codigo_hu_armonizacion', termino: 'Código HU (armonización)', formato: formatText },
  { campo: 'codigo_via_armonizacion', termino: 'Código de vía (armonización)', formato: formatText }
]

const DECLARACION: Campo<DeclaracionOrigen>[] = [
  { campo: 'arancel', termino: 'Arancel (por m²)', formato: formatMoney },
  { campo: 'valor_terreno', termino: 'Valor del terreno', formato: formatMoney },
  { campo: 'valor_construccion', termino: 'Valor de la construcción', formato: formatMoney },
  { campo: 'valor_otras_instalaciones', termino: 'Valor de otras instalaciones', formato: formatMoney }
]

// a value: neither absent nor blank (the backend leaves both out already)
const conValor = (valor: unknown) => valor !== undefined && valor !== null && valor !== ''

function Bloque<T extends object>({
  titulo,
  campos,
  valores,
  modificada
}: {
  titulo: string
  campos: Campo<T>[]
  valores: T | null | undefined
  modificada?: boolean
}) {
  if (!valores) return null
  const datos = campos.filter((c) => conValor(valores[c.campo]))
  if (datos.length === 0) return null
  return (
    <section aria-label={titulo} className="mt-6 space-y-2 rounded-md border border-border bg-surface-muted px-4 py-3">
      <h3 className="text-sm font-medium text-ink">{titulo}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {datos.map((c) => (
          <Dato key={String(c.campo)} termino={c.termino}>
            {c.formato(valores[c.campo])}
          </Dato>
        ))}
      </dl>
      {modificada && <p className="text-xs font-medium text-warning">{AVISO_MODIFICADA}</p>}
      <p className="text-xs text-ink-muted">{NOTA}</p>
    </section>
  )
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{termino}</dt>
      <dd className="text-ink tabular-nums">{children}</dd>
    </>
  )
}

// the declaración's valuation, in datos del predio
export function ValuacionDeLaDeclaracion({ valores, modificada }: { valores: DeclaracionOrigen | null | undefined; modificada?: boolean }) {
  return <Bloque titulo="Valuación del padrón de origen" campos={DECLARACION} valores={valores} modificada={modificada} />
}

// the predio's codes in the source catastro and the armonización, in the ubicación (the DJ's and the predio's)
export function CodigosDelPredio({ valores }: { valores: PredioOrigen | null | undefined }) {
  return <Bloque titulo="Códigos del padrón de origen" campos={PREDIO} valores={valores} />
}

// a nivel's columns, after the srtm's: a dash where the nivel has none. none at all when no nivel has any
export function columnasDeOrigen(niveles: Record<string, NivelOrigen> | null | undefined) {
  if (!niveles || Object.keys(niveles).length === 0) return []
  const de = (n: NivelConstruccion) => (n.id ? niveles[n.id] : undefined)
  return [
    { label: 'Clasificación (origen)', render: (n: NivelConstruccion) => celda('clasificacion', de(n)?.clasificacion) },
    { label: 'V. unitario (origen)', render: (n: NivelConstruccion) => formatMoney(de(n)?.valor_unitario), numeric: true },
    { label: 'Incremento por m² (origen)', render: (n: NivelConstruccion) => formatMoney(de(n)?.incremento), numeric: true },
    { label: '% depreciación (origen)', render: (n: NivelConstruccion) => formatNumber(de(n)?.porcentaje_depreciacion), numeric: true },
    { label: 'V. total (origen)', render: (n: NivelConstruccion) => formatMoney(de(n)?.valor_total), numeric: true }
  ]
}

export const AVISO_NIVELES = 'Las columnas del padrón de origen son de solo lectura, para cotejar con él: no cambian el impuesto.'
