import { ApiError } from '@wasichai/core'
import { Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { useVisorPrediosDeLote } from '../../queries'
import { COLOR_CATEGORIA, GRIS, etiquetaCategoria, etiquetaConfianza, etiquetaEstado } from './colores'
import { soles } from './formato'
import type { LoteVisorProps, PredioDeLote } from './tipos'

const siNo = (v: boolean | null | undefined) => (v === null || v === undefined ? '—' : v ? 'Sí' : 'No')

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-ink-muted">{k}</span>
      <span>{v}</span>
    </div>
  )
}

const ENLACE = 'font-medium text-link hover:underline'

// a predio of the lote: its code, its category chip and Δ, and the two fichas it opens in a workspace tab (the
// router's links: no reload, and the visor keeps its tab with its url)
function Predio({ p }: { p: PredioDeLote }) {
  const codigo = p.codigo_predio ?? 'Sin código'
  return (
    <li aria-label={codigo} className="space-y-0.5 border-t border-border pt-1.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-medium">{codigo}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 text-[11px] leading-4">
          <span aria-hidden className="size-2 rounded-full" style={{ background: COLOR_CATEGORIA[p.categoria] ?? GRIS }} />
          {etiquetaCategoria(p.categoria)}
        </span>
        <span className="tabular-nums">{soles(p.delta_impuesto, { signo: true })}</span>
      </div>
      {/* null: the user may not read contribuyentes */}
      {p.contribuyente_nombre && <div className="truncate text-ink-muted">{p.contribuyente_nombre}</div>}
      <div className="flex flex-wrap gap-x-3">
        {p.predio && (
          <Link to={`/predios/${encodeURIComponent(p.predio)}`} className={ENLACE} aria-label={`Ver predio ${codigo}`}>
            Ver predio
          </Link>
        )}
        {p.contribuyente && (
          <Link to={`/contribuyentes/${encodeURIComponent(p.contribuyente)}`} className={ENLACE} aria-label={`Ver contribuyente de ${codigo}`}>
            {p.contribuyente_nombre ? 'Ver contribuyente' : 'Contribuyente'}
          </Link>
        )}
      </div>
    </li>
  )
}

function PrediosDelLote({ codigo, anio, corrida }: { codigo: string; anio: number; corrida: string }) {
  const q = useVisorPrediosDeLote(codigo, anio, corrida)
  if (q.isPending)
    return (
      <p role="status" className="flex items-center gap-1 text-ink-muted">
        <Loader2 aria-hidden className="size-3 animate-spin" />
        Cargando predios…
      </p>
    )
  if (q.isError)
    return (
      <p role="alert" className="text-danger">
        {q.error instanceof ApiError && q.error.status === 404 ? 'El lote no está en esta corrida.' : 'No se pudieron leer los predios del lote.'}
      </p>
    )
  if (!q.data.length) return <p className="text-ink-muted">El lote no tiene predios en rentas.</p>
  return (
    <ul aria-label="Predios del lote" className="max-h-48 space-y-1.5 overflow-y-auto">
      {q.data.map((p) => (
        <Predio key={p.id} p={p} />
      ))}
    </ul>
  )
}

// the popup of a lote: its codes, the difference and catastro's decision, and its predios, read when it opens. in
// the light theme's tokens: maplibre's popup is white in every theme
export function PopupLote({ lote, anio, corrida }: { lote: LoteVisorProps; anio: number; corrida: string }) {
  return (
    <div data-theme="light" className="space-y-2 text-xs leading-normal text-ink" data-testid="popup-lote">
      <div>
        <div className="font-semibold">{lote.codigo ?? 'Sin código'}</div>
        {lote.codigo_catastro && <Fila k="Código catastral" v={lote.codigo_catastro} />}
        <Fila k="Categoría" v={etiquetaCategoria(lote.categoria)} />
        <Fila k="Confianza" v={etiquetaConfianza(lote.confianza)} />
        <Fila k="Diferencia de impuesto" v={soles(lote.delta_impuesto, { signo: true })} />
        <Fila k="Supera 5 UIT" v={siNo(lote.supera_5_uit)} />
        <Fila k="Estado" v={etiquetaEstado(lote.estado)} />
      </div>
      {lote.codigo && (
        <section aria-label="Predios" className="space-y-1">
          <div className="font-semibold">Predios</div>
          <PrediosDelLote codigo={lote.codigo} anio={anio} corrida={corrida} />
        </section>
      )}
    </div>
  )
}
