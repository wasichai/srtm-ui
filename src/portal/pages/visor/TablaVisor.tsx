import { Badge, Button, Input, PageSizePagination, Table, Td, Th } from '@wasichai/ui'
import { MapPinOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CategoriaBrecha, Confianza, DecisionBrecha } from '../../types'
import { CONTROL, SoloPricos } from './CapasVisor'
import {
  COLOR_CATEGORIA,
  COLOR_CONFIANZA,
  COLOR_ESTADO,
  ETIQUETA_CATEGORIA,
  ETIQUETA_CONFIANZA,
  ETIQUETA_ESTADO,
  colorConfianza,
  etiquetaCategoria,
  etiquetaConfianza,
  etiquetaEstado
} from './colores'
import { ChipPrico } from './ChipPrico'
import { nombreDeFila } from './DetalleNiveles'
import { EnlaceFicha } from './enlaces'
import { soles } from './formato'
import { CATEGORIAS_VISOR, CONFIANZAS_VISOR, ESTADOS_VISOR, type FilaVisor, type Filtros, type Orden, type PaginaVisor } from './tipos'

export const TAMANIOS = [25, 50, 100] as const

const ORDENES: Record<Orden, string> = {
  delta_desc: 'Diferencia de impuesto, de mayor a menor',
  delta_asc: 'Diferencia de impuesto, de menor a mayor',
  codigo: 'Código catastral'
}

// a text the user types: the query waits until they stop, so each key does not ask the API again
function useDiferido(valor: string, ms = 300): string {
  const [diferido, setDiferido] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setDiferido(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return diferido
}

function Opciones<K extends string>({
  titulo,
  claves,
  etiquetas,
  colores,
  elegidas,
  onCambio
}: {
  titulo: string
  claves: readonly K[]
  etiquetas: Record<K, string>
  colores: Record<K, string>
  elegidas: K[]
  onCambio: (k: K[]) => void
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1">
      <legend className="sr-only">{titulo}</legend>
      <span aria-hidden className="mr-1 text-xs text-ink-muted">
        {titulo}
      </span>
      {claves.map((k) => {
        const activa = elegidas.includes(k)
        return (
          <button
            key={k}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambio(activa ? elegidas.filter((e) => e !== k) : [...elegidas, k])}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${activa ? 'border-ink bg-surface-muted text-ink' : 'border-border text-ink-muted'}`}
          >
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: colores[k] }} />
            {etiquetas[k]}
          </button>
        )
      })}
    </fieldset>
  )
}

// the filters of the table, which the map and the CSV follow too. sector and the minimum difference wait for the
// user to stop typing
export function FiltrosVisor({
  filtros,
  onCambio,
  conPricos = false,
  orden,
  onOrden
}: {
  filtros: Filtros
  onCambio: (f: Filtros) => void
  // the backend knows the PRICOs (srtm-backend#273): an older one has no «Solo PRICOs»
  conPricos?: boolean
  orden: Orden
  onOrden: (o: Orden) => void
}) {
  const [sector, setSector] = useState(filtros.sector)
  const [minDelta, setMinDelta] = useState(filtros.min_delta)
  const sectorDiferido = useDiferido(sector)
  const minDeltaDiferido = useDiferido(minDelta)
  const ultimo = useRef({ filtros, onCambio })
  ultimo.current = { filtros, onCambio }
  useEffect(() => {
    const { filtros: f, onCambio: cambiar } = ultimo.current
    if (f.sector !== sectorDiferido || f.min_delta !== minDeltaDiferido) cambiar({ ...f, sector: sectorDiferido, min_delta: minDeltaDiferido })
  }, [sectorDiferido, minDeltaDiferido])

  return (
    <div role="search" aria-label="Filtros de los predios" className="space-y-2">
      <Opciones<CategoriaBrecha>
        titulo="Categoría"
        claves={CATEGORIAS_VISOR}
        etiquetas={ETIQUETA_CATEGORIA}
        colores={COLOR_CATEGORIA}
        elegidas={filtros.categoria}
        onCambio={(categoria) => onCambio({ ...filtros, categoria })}
      />
      <Opciones<Confianza>
        titulo="Confianza"
        claves={CONFIANZAS_VISOR}
        etiquetas={ETIQUETA_CONFIANZA}
        colores={COLOR_CONFIANZA}
        elegidas={filtros.confianza}
        onCambio={(confianza) => onCambio({ ...filtros, confianza })}
      />
      <Opciones<DecisionBrecha>
        titulo="Estado"
        claves={ESTADOS_VISOR}
        etiquetas={ETIQUETA_ESTADO}
        colores={COLOR_ESTADO}
        elegidas={filtros.estado}
        onCambio={(estado) => onCambio({ ...filtros, estado })}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Sector
          <Input value={sector} onChange={(e) => setSector(e.target.value)} className="h-8 w-24" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Supera 5 UIT
          <select
            value={filtros.supera_5_uit}
            onChange={(e) => onCambio({ ...filtros, supera_5_uit: e.target.value as Filtros['supera_5_uit'] })}
            className={CONTROL}
          >
            <option value="">Todos</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Diferencia mínima, en valor absoluto (S/)
          <Input
            type="number"
            min={0}
            step="any"
            value={minDelta}
            onChange={(e) => setMinDelta(e.target.value.startsWith('-') ? '' : e.target.value)}
            className="h-8 w-28"
          />
        </label>
        {conPricos && (
          <div className="flex h-8 items-center">
            <SoloPricos valor={filtros.prico} onCambio={(prico) => onCambio({ ...filtros, prico })} />
          </div>
        )}
        <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-muted">
          Orden
          <select value={orden} onChange={(e) => onOrden(e.target.value as Orden)} className={CONTROL}>
            {Object.entries(ORDENES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

const SIN_GEOMETRIA = 'Sin geometría: el lote no aparece en el mapa'

const ubicacion = (f: FilaVisor) => [f.sector, f.manzana, f.lote].map((x) => x ?? '—').join('-')

const siNo = (v: boolean | null | undefined) => (v === null || v === undefined ? '—' : v ? 'Sí' : 'No')

export interface TablaVisorProps {
  pagina: PaginaVisor<FilaVisor> | undefined
  page: number
  size: number
  onPage: (p: number) => void
  onSize: (s: number) => void
  // opens the niveles of a row
  onNiveles: (fila: FilaVisor) => void
}

// the rows of the corrida, a page at a time, with catastro's decision on each, read only. the código opens srtm's
// predio, the contribuyente its ficha, and the DJ the declaración it was compared with, each in its workspace tab
export function TablaVisor({ pagina, page, size, onPage, onSize, onNiveles }: TablaVisorProps) {
  const filas = pagina?.content ?? []
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <Table aria-label="Predios de la brecha">
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Código catastral</Th>
              <Th>Sector-Mz-Lote</Th>
              <Th>Contribuyente</Th>
              <Th>Uso</Th>
              <Th>Categoría</Th>
              <Th>Confianza</Th>
              <Th className="text-right">Impuesto declarado</Th>
              <Th className="text-right">Impuesto catastro</Th>
              <Th className="text-right">Diferencia de impuesto</Th>
              <Th className="text-right">Diferencia de arbitrios</Th>
              <Th>Supera 5 UIT</Th>
              <Th>Estado</Th>
              <Th>DJ</Th>
              {/* relative: sr-only is absolute, and without a positioned ancestor it widens the page */}
              <Th className="relative">
                <span className="sr-only">Niveles</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <Td colSpan={15} className="text-center text-ink-muted">
                  {pagina ? 'Ningún predio cumple los filtros.' : 'Cargando…'}
                </Td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.id}>
                <Td className="font-mono text-xs whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {f.predio ? (
                      <EnlaceFicha ficha="predio" id={f.predio} titulo={f.codigo_predio ?? 'Predio'} className="text-link hover:underline">
                        {f.codigo_predio ?? 'Ver predio'}
                      </EnlaceFicha>
                    ) : (
                      (f.codigo_predio ?? '—')
                    )}
                    {f.prico && <ChipPrico />}
                  </span>
                </Td>
                <Td className="font-mono text-xs">
                  <span className="inline-flex items-center gap-1">
                    {f.codigo_catastro ?? '—'}
                    {f.con_geometria === false && (
                      <span title={SIN_GEOMETRIA}>
                        <MapPinOff role="img" aria-label={SIN_GEOMETRIA} className="h-3.5 w-3.5 text-ink-muted" />
                      </span>
                    )}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">{ubicacion(f)}</Td>
                <Td className="min-w-40">
                  {/* the router's link, as in the popup: it opens or focuses the contribuyente's tab. no name: the user may
                      not read contribuyentes */}
                  {f.contribuyente ? (
                    <EnlaceFicha
                      ficha="contribuyente"
                      id={f.contribuyente}
                      titulo={f.contribuyente_nombre ?? 'Contribuyente'}
                      className="text-link hover:underline"
                      aria-label={f.contribuyente_nombre ? undefined : `Contribuyente de ${nombreDeFila(f)}`}
                    >
                      {f.contribuyente_nombre ?? 'Contribuyente'}
                    </EnlaceFicha>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>{f.uso ?? '—'}</Td>
                <Td>
                  <Badge className="gap-1 whitespace-nowrap" title={f.motivo ?? undefined}>
                    <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_CATEGORIA[f.categoria] }} />
                    {etiquetaCategoria(f.categoria)}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap" title={f.confianza_motivo ?? undefined}>
                  <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: colorConfianza(f.confianza) }} />
                  {etiquetaConfianza(f.confianza)}
                </Td>
                <Td className="text-right tabular-nums whitespace-nowrap">{soles(f.impuesto_declarado)}</Td>
                <Td className="text-right tabular-nums whitespace-nowrap">{soles(f.impuesto_catastro)}</Td>
                <Td className="text-right font-medium tabular-nums whitespace-nowrap">
                  {soles(f.delta_impuesto, { signo: true })}
                  {f.estimado && (
                    <span title={f.motivo ?? 'Calculado con datos estimados'} className="ml-1 text-xs font-normal text-ink-muted">
                      (estimado)
                    </span>
                  )}
                </Td>
                <Td className="text-right tabular-nums whitespace-nowrap">{soles(f.delta_arbitrios, { signo: true })}</Td>
                <Td>{siNo(f.supera_5_uit)}</Td>
                <Td className="whitespace-nowrap">{etiquetaEstado(f.estado)}</Td>
                <Td>
                  {f.declaracion ? (
                    <EnlaceFicha
                      ficha="declaracion"
                      id={f.declaracion}
                      titulo={`DJ ${f.codigo_predio ?? ''}`.trim()}
                      className="text-link hover:underline"
                      aria-label={`Declaración de ${nombreDeFila(f)}`}
                    >
                      Ver DJ
                    </EnlaceFicha>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  <Button variant="ghost" size="sm" aria-label={`Ver los niveles de ${nombreDeFila(f)}`} onClick={() => onNiveles(f)}>
                    Niveles
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <PageSizePagination page={page} size={size} total={pagina?.totalElements ?? 0} onPage={onPage} onSize={onSize} sizes={TAMANIOS} />
    </div>
  )
}
