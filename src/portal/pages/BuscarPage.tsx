import { EmptyState, QueryState } from '@wasichai/core'
import { Card, CardHeader, CardTitle } from '@wasichai/ui'
import { Link, useSearchParams } from 'react-router'
import { useContribuyentes, usePredios } from '../queries'

// the header search: both padrones at once, the first matches of each
export function BuscarPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const contribuyentes = useContribuyentes(q, 0)
  const predios = usePredios(q, 0)
  const all = (path: string, total: number) =>
    total > 0 && (
      <Link to={`${path}?q=${encodeURIComponent(q)}`} className="text-sm font-normal text-link hover:underline">
        Ver los {total.toLocaleString('es-PE')}
      </Link>
    )

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink">Resultados para “{q}”</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Contribuyentes</CardTitle>
            {all('/contribuyentes', contribuyentes.data?.totalElements ?? 0)}
          </CardHeader>
          <QueryState query={contribuyentes}>
            {(result) =>
              result.content.length === 0 ? (
                <EmptyState title="Ningún contribuyente coincide" />
              ) : (
                <ul className="divide-y divide-border">
                  {result.content.slice(0, 10).map((c) => (
                    <li key={c.id}>
                      <Link to={`/contribuyentes/${c.id}`} className="block px-5 py-3 hover:bg-surface-muted/60">
                        <p className="text-sm font-medium text-ink">{c.nombre_completo}</p>
                        <p className="text-xs text-ink-muted">
                          {c.tipo_documento} {c.numero_documento}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryState>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Predios</CardTitle>
            {all('/predios', predios.data?.totalElements ?? 0)}
          </CardHeader>
          <QueryState query={predios}>
            {(result) =>
              result.content.length === 0 ? (
                <EmptyState title="Ningún predio coincide" />
              ) : (
                <ul className="divide-y divide-border">
                  {result.content.slice(0, 10).map((p) => (
                    <li key={p.id}>
                      <Link to={`/predios/${p.id}`} className="block px-5 py-3 hover:bg-surface-muted/60">
                        <p className="text-sm font-medium text-ink">{p.codigo}</p>
                        <p className="text-xs text-ink-muted">{p.direccion}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryState>
        </Card>
      </div>
    </div>
  )
}
