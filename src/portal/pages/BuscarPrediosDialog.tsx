import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { EmptyState } from '@wasichai/core'
import { Button, cn, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Label, PageSizePagination, Table, Td, Th } from '@wasichai/ui'
import { Camera, FileText, Pencil, Plus, RotateCcw, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { NativeSelect } from '../../kit/forms/NativeSelect'
import { SuggestInput } from '../../kit/forms/SuggestInput'
import { rentas } from '../api'
import { Alerta } from '../components/Alerta'
import { formatText } from '../components/format'
import type { Bbox, Feature, FeatureCollection } from '../components/geo'
import { recordIdOf } from '../components/geo'
import { LotesMap } from '../components/LotesMap'
import { nombres } from '../forms/bloques'
import { etiqueta } from '../forms/etiquetas'
import type { Elegido } from '../forms/ubicacion'
import { useCatalogos } from '../queries'
import type { CatastroFiscal, FiltrosPredio, Pagina, Predio } from '../types'

type Donde = 'tributario' | 'catastro'

interface BuscarPrediosDialogProps {
  onClose: () => void
  onPick: (elegido: Elegido) => void | Promise<void>
  // which tab opens first; `solo` hides the other one
  inicial?: Donde
  solo?: Donde
  // over a form being filled: the lote editor opens in another browser tab, so nothing typed is lost
  lotesAparte?: boolean
}

// a code, a CPU or a partida identify a predio by themselves; otherwise the srtm asks for the vía
const identifica = (f: FiltrosPredio) => Boolean(f.codigo || f.codigo_cpu || f.partida_registral)

// the srtm's "buscar predios" (page 13): the same filters over the padrón (tributario) and over the catastro fiscal,
// a paged table, and the lotes on a map under it. the row picked is the lote highlighted, and a lote clicked picks
// its row. it opens on the padrón: the catastro fiscal may still be empty
export function BuscarPrediosDialog({ onClose, onPick, inicial = 'tributario', solo, lotesAparte = false }: BuscarPrediosDialogProps) {
  const [donde, setDonde] = useState<Donde>(solo ?? inicial)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogTitle className="text-lg font-semibold uppercase">Buscar predios</DialogTitle>
        <DialogDescription className="sr-only">Busca un predio en el padrón tributario o un lote del catastro fiscal</DialogDescription>
        {!solo && (
          <div role="tablist" aria-label="Dónde buscar" className="mt-3 flex gap-1 border-b border-border">
            {(
              [
                ['tributario', 'Buscar en Tributario'],
                ['catastro', 'Buscar en Catastro Fiscal']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={donde === id}
                onClick={() => setDonde(id)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium',
                  donde === id ? 'border-brand text-brand-strong' : 'border-transparent text-ink-muted hover:text-ink'
                )}
              >
                <FileText className="size-4" />
                {label}
              </button>
            ))}
          </div>
        )}
        {/* keyed: each tab keeps its own filters and page */}
        <Busqueda key={donde} donde={donde} onPick={onPick} onClose={onClose} lotesAparte={lotesAparte} />
      </DialogContent>
    </Dialog>
  )
}

function Busqueda({
  donde,
  onPick,
  onClose,
  lotesAparte
}: {
  donde: Donde
  onPick: BuscarPrediosDialogProps['onPick']
  onClose: () => void
  lotesAparte: boolean
}) {
  const catalogos = useCatalogos()
  const [filtros, setFiltros] = useState<FiltrosPredio>({ tipo_predio: 'PREDIO URBANO' })
  const [aplicados, setAplicados] = useState<FiltrosPredio | null>(null)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(5)
  const [selected, setSelected] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [bbox, setBbox] = useState<Bbox | null>(null)
  const [busy, setBusy] = useState(false)
  const capture = useRef<(() => string | null) | null>(null)

  const resultados = useQuery<Pagina<Predio | CatastroFiscal>>({
    queryKey: ['buscar-predios', donde, aplicados, page, size],
    queryFn: () => (donde === 'catastro' ? rentas.buscarCatastro(aplicados!, page, size) : rentas.buscarPredios(aplicados!, page, size)),
    enabled: aplicados !== null,
    placeholderData: keepPreviousData
  })
  // the lotes around what is on screen, besides the results: the neighbours of the one picked
  const vecinos = useQuery({
    queryKey: ['lotes', donde, bbox],
    queryFn: () => rentas.lotes(donde === 'catastro' ? 'catastro_fiscal' : 'predio', bbox!),
    enabled: bbox !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })

  const filas: (Predio | CatastroFiscal)[] = resultados.data?.content ?? []
  const features = useMemo<FeatureCollection>(() => {
    const byId = new Map<string, Feature>()
    for (const f of vecinos.data?.features ?? []) byId.set(recordIdOf(f), f)
    for (const row of filas) {
      if (row.id && row.lote_geom) byId.set(row.id, { type: 'Feature', geometry: row.lote_geom, properties: { __id: row.id } })
    }
    return { type: 'FeatureCollection', features: [...byId.values()] }
  }, [vecinos.data, filas])

  const set = (name: keyof FiltrosPredio, value: string) => setFiltros((f) => ({ ...f, [name]: value }))
  const buscar = () => {
    if (!filtros.via && !identifica(filtros)) {
      setAviso('Escribe la descripción de la vía, o un código, un código CPU o una partida registral')
      return
    }
    setAviso(null)
    setSelected(null)
    setPage(0)
    setAplicados({ ...filtros })
  }
  const limpiar = () => {
    setFiltros({ tipo_predio: 'PREDIO URBANO' })
    setAplicados(null)
    setSelected(null)
    setAviso(null)
  }
  const elegir = async () => {
    const row = filas.find((r) => r.id === selected)
    if (!row) return
    setBusy(true)
    try {
      if (donde === 'tributario') {
        await onPick({ kind: 'predio', predio: row as Predio })
      } else {
        const lote = row as CatastroFiscal
        // the lote may already be a predio of the padrón: its municipal code says which
        const codigo = lote.codigo_predio_municipal
        const predio = codigo ? ((await rentas.buscarPredios({ codigo }, 0, 5)).content.find((p) => p.codigo === codigo) ?? null) : null
        await onPick({ kind: 'catastro', lote, predio })
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }
  // in this browser tab the dialog goes with the page it was over
  const abrirLote = lotesAparte ? { target: '_blank', rel: 'noreferrer' } : { onClick: onClose }
  const descargar = () => {
    const url = capture.current?.()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `mapa-${donde}.png`
    a.click()
  }

  const opcionesPredio = catalogos.data?.predio ?? {}
  const campo = (name: keyof FiltrosPredio, label: string, span = '') => (
    <div className={cn('space-y-1', span)}>
      <Label htmlFor={`filtro-${name}`} className="block truncate text-xs">
        {label}
      </Label>
      <Input id={`filtro-${name}`} value={filtros[name] ?? ''} onChange={(e) => set(name, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()} />
    </div>
  )
  const lista = (name: keyof FiltrosPredio, label: string, options: string[]) => (
    <div className="space-y-1">
      <Label htmlFor={`filtro-${name}`} className="block truncate text-xs">
        {label}
      </Label>
      <NativeSelect id={`filtro-${name}`} value={filtros[name] ?? ''} onChange={(e) => set(name, e.target.value)}>
        <option value="">SELECCIONAR</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {etiqueta(name, o)}
          </option>
        ))}
      </NativeSelect>
    </div>
  )

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
        {lista('tipo_predio', 'Tipo predio', ['PREDIO URBANO', 'PREDIO RUSTICO'])}
        {campo('codigo', 'Código de predio municipal')}
        {campo('codigo_cpu', 'Código CPU')}
        {campo('partida_registral', 'Partida registral')}
        <div className="hidden lg:block lg:col-span-2" />
        {lista('tipo_via', 'Tipo de vía', opcionesPredio.tipo_via ?? [])}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="filtro-via" className="block truncate text-xs">
            Descripción de la vía<span className="text-danger"> *</span>
          </Label>
          <SuggestInput
            id="filtro-via"
            value={filtros.via ?? ''}
            onChange={(e) => set('via', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            queryKey={['filtro-via', filtros.tipo_via]}
            fetch={async (q) => nombres((await rentas.vias(q, filtros.tipo_via)).content)}
          />
        </div>
        {lista('tipo_zona', 'Zona', opcionesPredio.tipo_zona ?? [])}
        {campo('zona', 'Descripción de la zona', 'sm:col-span-2')}
        {campo('numero', 'Número principal')}
        {campo('manzana', 'Manzana')}
        {campo('lote', 'Lote')}
        {campo('kilometro', 'Kilómetro')}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {aviso && (
          <Alerta tono="error" className="mr-auto">
            {aviso}
          </Alerta>
        )}
        <Button variant="secondary" onClick={limpiar}>
          <RotateCcw className="size-4" />
          Limpiar
        </Button>
        <Button onClick={buscar}>
          <Search className="size-4" />
          Buscar
        </Button>
        <Button variant="secondary" size="icon" aria-label="Descargar imagen del mapa" title="Descargar imagen del mapa" onClick={descargar}>
          <Camera className="size-4" />
        </Button>
      </div>

      {aplicados &&
        (filas.length === 0 && !resultados.isPending ? (
          <EmptyState title="No se encontraron resultados" />
        ) : (
          <div className="rounded-md border border-border">
            <Table aria-label="Resultados">
              <thead>
                {donde === 'catastro' ? (
                  <tr>
                    <Th>Código CPU</Th>
                    <Th>Dirección de catastro fiscal</Th>
                    <Th>Cód. predio municipal</Th>
                  </tr>
                ) : (
                  <tr>
                    <Th>Código</Th>
                    <Th>Dirección</Th>
                    <Th>Sector / Manzana</Th>
                    <Th>Condición</Th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filas.map((row) => {
                  const picked = row.id === selected
                  const cls = cn('cursor-pointer', picked ? 'bg-brand-soft text-brand-strong' : 'hover:bg-surface-muted/60')
                  if (donde === 'catastro') {
                    const lote = row as CatastroFiscal
                    return (
                      <tr key={lote.id} className={cls} aria-selected={picked} onClick={() => setSelected(lote.id!)} onDoubleClick={() => void elegir()}>
                        <Td className="whitespace-nowrap">{formatText(lote.codigo_cpu)}</Td>
                        <Td>{formatText(lote.direccion ?? [lote.tipo_via, lote.via, lote.numero].filter(Boolean).join(' '))}</Td>
                        <Td>{formatText(lote.codigo_predio_municipal)}</Td>
                      </tr>
                    )
                  }
                  const predio = row as Predio
                  return (
                    <tr key={predio.id} className={cls} aria-selected={picked} onClick={() => setSelected(predio.id!)} onDoubleClick={() => void elegir()}>
                      <Td className="whitespace-nowrap">{formatText(predio.codigo)}</Td>
                      <Td>{formatText(predio.direccion)}</Td>
                      <Td className="whitespace-nowrap">
                        {formatText(predio.sector_catastral)} / {formatText(predio.manzana_catastral)}
                      </Td>
                      <Td>{formatText(predio.tipo_predio)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            {resultados.data && (
              <PageSizePagination
                page={resultados.data.page}
                size={size}
                total={resultados.data.totalElements}
                onPage={setPage}
                onSize={(next) => {
                  setSize(next)
                  setPage(0)
                }}
              />
            )}
          </div>
        ))}

      <LotesMap
        className="h-80"
        label={donde === 'catastro' ? 'Mapa del catastro fiscal' : 'Mapa de predios'}
        features={features}
        selectedId={selected}
        onSelect={(id) => {
          if (filas.some((r) => r.id === id)) setSelected(id)
        }}
        onBounds={setBbox}
        onCapture={(fn) => {
          capture.current = fn
        }}
      />

      <div className="flex flex-wrap justify-end gap-2">
        {/* the catastro fiscal is kept here too: a lote missing or wrong is added or fixed in the lote editor */}
        {donde === 'catastro' && (
          <div className="mr-auto flex gap-2">
            <Button asChild variant="secondary">
              <Link to="/catastro/nuevo" {...abrirLote}>
                <Plus className="size-4" />
                Nuevo lote
              </Link>
            </Button>
            {selected && (
              <Button asChild variant="secondary">
                <Link to={`/catastro/${selected}`} {...abrirLote}>
                  <Pencil className="size-4" />
                  Editar lote
                </Link>
              </Button>
            )}
          </div>
        )}
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => void elegir()} disabled={!selected || busy}>
          {busy ? 'Eligiendo…' : 'Elegir'}
        </Button>
      </div>
    </div>
  )
}
