import { EmptyState, QueryState } from '@wasichai/core'
import { Badge, Button, Card, Pagination, Table, Td, Th } from '@wasichai/ui'
import { Plus, Search } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { formatText } from '../components/format'
import { SearchBox } from '../components/SearchBox'
import type { Elegido } from '../forms/ubicacion'
import { useContribuyentes, usePredios } from '../queries'
import { BuscarPrediosDialog } from './BuscarPrediosDialog'

// search text and page live in the url: back, reload and a shared link all land on the same list
function useListParams() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)
  const setQ = useCallback((next: string) => setParams(next ? { q: next } : {}, { replace: true }), [setParams])
  const setPage = (next: number) => setParams({ ...(q ? { q } : {}), ...(next ? { page: String(next) } : {}) })
  return { q, page, setQ, setPage }
}

function ListHeader({ title, subtitle, newPath, newLabel, extra }: { title: string; subtitle: string; newPath: string; newLabel: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-ink-muted">{subtitle}</p>
      </div>
      <div className="flex gap-2">
        {extra}
        <Button asChild>
          <Link to={newPath}>
            <Plus className="size-4" />
            {newLabel}
          </Link>
        </Button>
      </div>
    </div>
  )
}

export function ContribuyentesPage() {
  const { q, page, setQ, setPage } = useListParams()
  const query = useContribuyentes(q, page)
  const navigate = useNavigate()

  return (
    <div className="space-y-5">
      <ListHeader title="Contribuyentes" subtitle="Personas naturales, jurídicas y sucesiones" newPath="/contribuyentes/nuevo" newLabel="Nuevo contribuyente" />
      <SearchBox label="Buscar contribuyentes" value={q} onChange={setQ} placeholder="DNI, RUC, nombre o razón social" />
      <Card>
        <QueryState query={query}>
          {(result) =>
            result.content.length === 0 ? (
              <EmptyState title={q ? `Nada coincide con “${q}”` : 'Aún no hay contribuyentes'} />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Documento</Th>
                      <Th>Nombre</Th>
                      <Th>Tipo</Th>
                      <Th>Domicilio fiscal</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.content.map((c) => (
                      <tr key={c.id} className="cursor-pointer hover:bg-surface-muted/60" onClick={() => navigate(`/contribuyentes/${c.id}`)}>
                        <Td className="whitespace-nowrap">
                          <span className="text-xs text-ink-muted">{c.tipo_documento}</span>
                          <br />
                          <Link to={`/contribuyentes/${c.id}`} className="font-medium text-link hover:underline" onClick={(e) => e.stopPropagation()}>
                            {formatText(c.numero_documento)}
                          </Link>
                        </Td>
                        <Td className="font-medium">{formatText(c.nombre_completo)}</Td>
                        <Td>{c.tipo_persona && <Badge>{c.tipo_persona}</Badge>}</Td>
                        <Td className="text-ink-muted">{formatText(c.domicilio_fiscal)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={result.page} totalPages={result.totalPages} totalElements={result.totalElements} onPage={setPage} />
              </>
            )
          }
        </QueryState>
      </Card>
    </div>
  )
}

export function PrediosPage() {
  const { q, page, setQ, setPage } = useListParams()
  const query = usePredios(q, page)
  const navigate = useNavigate()
  const [buscando, setBuscando] = useState(false)
  // a predio of the padrón opens its ficha; a lote of the catastro, its predio or a new one already located
  const elegido = (e: Elegido) => {
    const predio = e.kind === 'predio' ? e.predio : e.predio
    if (predio) navigate(`/predios/${predio.id}`)
    else if (e.kind === 'catastro') navigate('/predios/nuevo', { state: { lote: e.lote } })
  }

  return (
    <div className="space-y-5">
      <ListHeader
        title="Predios"
        subtitle="Padrón de predios urbanos y rústicos"
        newPath="/predios/nuevo"
        newLabel="Nuevo predio"
        extra={
          <Button variant="secondary" onClick={() => setBuscando(true)}>
            <Search className="size-4 text-brand" />
            Buscar predios
          </Button>
        }
      />
      {buscando && <BuscarPrediosDialog onClose={() => setBuscando(false)} onPick={elegido} />}
      <SearchBox label="Buscar predios" value={q} onChange={setQ} placeholder="Código, dirección o habilitación urbana" />
      <Card>
        <QueryState query={query}>
          {(result) =>
            result.content.length === 0 ? (
              <EmptyState title={q ? `Nada coincide con “${q}”` : 'Aún no hay predios'} />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Código</Th>
                      <Th>Dirección</Th>
                      <Th>Sector / Manzana</Th>
                      <Th>Condición</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.content.map((p) => (
                      <tr key={p.id} className="cursor-pointer hover:bg-surface-muted/60" onClick={() => navigate(`/predios/${p.id}`)}>
                        <Td className="whitespace-nowrap">
                          <Link to={`/predios/${p.id}`} className="font-medium text-link hover:underline" onClick={(e) => e.stopPropagation()}>
                            {formatText(p.codigo)}
                          </Link>
                        </Td>
                        <Td>{formatText(p.direccion)}</Td>
                        <Td className="whitespace-nowrap text-ink-muted">
                          {formatText(p.sector_catastral)} / {formatText(p.manzana_catastral)}
                        </Td>
                        <Td>{p.tipo_predio && <Badge>{p.tipo_predio}</Badge>}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={result.page} totalPages={result.totalPages} totalElements={result.totalElements} onPage={setPage} />
              </>
            )
          }
        </QueryState>
      </Card>
    </div>
  )
}
