import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Table, Td, Th } from '@wasichai/ui'
import { FileText, Pencil, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { rentas } from '../api'
import { anulada, MarcaAnulada } from '../components/EstadoBadge'
import { formatMoney, formatNumber, formatText } from '../components/format'
import { EmptyState, QueryState } from '../components/QueryState'
import { NUMERICA } from '../components/tabla'
import type { Declaracion, DeclaracionDetalle } from '../types'
import { PuDeFila } from './VerPdf'

// the declarations of a ficha. side is the ficha's own kind; each row shows the other side.
// a declaration is created and edited only in the full declaración jurada (/declaraciones/:id)
export type Side = 'contribuyente' | 'predio'

// the most precise of its clase, sub clase and uso: one of the padrón may have its clase alone (srtm-backend#31)
const usoDe = (d: Declaracion) => d.uso || d.sub_clase_uso || d.clase_uso

function useDeclaraciones(side: Side, id: string, anio?: number) {
  return useQuery({
    queryKey: [side, id, 'declaraciones', anio ?? 'todas'],
    queryFn: () => (side === 'contribuyente' ? rentas.declaracionesDeContribuyente(id, anio) : rentas.declaracionesDePredio(id, anio))
  })
}

// the year's totals are the ficha's (same query as the ficha page): the backend counts a predio held in condominio
// once, and each condómino its own part, where summing the rows' autoavalúo would count it once per condómino
function useTotales(side: Side, id: string, anio: number) {
  return useQuery({
    queryKey: [side, id, anio],
    queryFn: async () => (side === 'contribuyente' ? await rentas.contribuyente(id, anio) : await rentas.predio(id, anio)),
    select: (ficha) => ficha.totales
  })
}

function OtherSide({ side, detalle }: { side: Side; detalle: DeclaracionDetalle }) {
  if (side === 'contribuyente') {
    const p = detalle.predio
    if (!p) return <span className="text-ink-muted">—</span>
    return (
      <div>
        <Link to={`/predios/${p.id}`} className="font-medium text-link hover:underline">
          {p.codigo}
        </Link>
        <p className="text-xs text-ink-muted">{p.direccion}</p>
      </div>
    )
  }
  const c = detalle.contribuyente
  if (!c) return <span className="text-ink-muted">—</span>
  return (
    <div>
      <Link to={`/contribuyentes/${c.id}`} className="font-medium text-link hover:underline">
        {c.nombre_completo}
      </Link>
      <p className="text-xs text-ink-muted">
        {c.tipo_documento} {c.numero_documento}
      </p>
    </div>
  )
}

// one year: the predios of a contribuyente, or the titulares of a predio, with the year's totals
export function DeclaracionesDelAnio({ side, id, anio }: { side: Side; id: string; anio: number }) {
  const query = useDeclaraciones(side, id, anio)
  const totales = useTotales(side, id, anio).data
  const otherTitle = side === 'contribuyente' ? 'Predio' : 'Titular'
  return (
    <QueryState query={query}>
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState title={`Sin declaraciones en ${anio}`}>
            <p>Registra una en la pestaña Declaraciones.</p>
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{otherTitle}</Th>
                <Th>Condición</Th>
                <Th {...NUMERICA}>% condominio</Th>
                <Th>Uso</Th>
                <Th {...NUMERICA}>Autoavalúo</Th>
                <Th {...NUMERICA}>Valor afecto</Th>
                <Th>DJ</Th>
                {/* the PU of each predio, as this contribuyente's (wasichai/srtm-ui#61) */}
                {side === 'contribuyente' && <Th>PU</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.declaracion.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <OtherSide side={side} detalle={row} />
                  </Td>
                  <Td>
                    {row.declaracion.condicion_propiedad ? <Badge>{row.declaracion.condicion_propiedad}</Badge> : '—'}
                    <MarcaAnulada declaracion={row.declaracion} />
                  </Td>
                  <Td {...NUMERICA}>{formatNumber(row.declaracion.porcentaje_condominio)}</Td>
                  <Td>{formatText(usoDe(row.declaracion))}</Td>
                  <Td {...NUMERICA}>{formatMoney(row.declaracion.valor_autoavaluo)}</Td>
                  <Td {...NUMERICA}>{formatMoney(row.declaracion.valor_afecto)}</Td>
                  <Td>
                    {/* straight to what is declared of the predio: características, niveles and obras */}
                    <Link to={`/declaraciones/${row.declaracion.id}?tab=caracteristicas`} className="inline-flex items-center gap-1 text-link hover:underline">
                      <FileText className="size-3.5" />
                      {row.declaracion.numero_declaracion ?? 'Abrir'}
                    </Link>
                  </Td>
                  {side === 'contribuyente' && (
                    <Td>
                      {row.predio?.id && !anulada(row.declaracion) && (
                        <PuDeFila predio={row.predio.id} codigo={row.predio.codigo ?? row.predio.id} contribuyente={id} anio={anio} />
                      )}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <Td colSpan={4}>Total {anio}</Td>
                <Td {...NUMERICA}>{formatMoney(totales?.autoavaluo)}</Td>
                <Td {...NUMERICA}>{formatMoney(totales?.valor_afecto)}</Td>
                <Td />
                {side === 'contribuyente' && <Td />}
              </tr>
            </tfoot>
          </Table>
        )
      }
    </QueryState>
  )
}

// every year, newest first, with new and edit
export function HistorialDeclaraciones({ side, id }: { side: Side; id: string }) {
  const query = useDeclaraciones(side, id)
  const navigate = useNavigate()
  const otherTitle = side === 'contribuyente' ? 'Predio' : 'Contribuyente'
  // the srtm's declaración jurada: from a contribuyente, with its predio picked or registered in it; from a predio, on
  // that predio, with the contribuyente looked up in it
  const nueva = () => navigate(side === 'contribuyente' ? `/contribuyentes/${id}/declaraciones/nueva` : `/declaraciones/nueva?predio=${id}`)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={nueva}>
          <Plus className="size-4" />
          Nueva declaración
        </Button>
      </div>
      <QueryState query={query}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="Aún no hay declaraciones" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Año</Th>
                  <Th>DJ</Th>
                  <Th>{otherTitle}</Th>
                  <Th>Sec.</Th>
                  <Th>Uso</Th>
                  <Th {...NUMERICA}>Autoavalúo</Th>
                  <Th {...NUMERICA}>Valor afecto</Th>
                  {/* relative: the sr-only text is absolute and would otherwise widen the page past the table's scroll */}
                  <Th className="relative">
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.declaracion.id} className="hover:bg-surface-muted/60">
                    <Td className="font-medium">{row.declaracion.anio}</Td>
                    <Td>
                      <Link to={`/declaraciones/${row.declaracion.id}`} className="inline-flex items-center gap-1 text-link hover:underline">
                        <FileText className="size-3.5" />
                        {row.declaracion.numero_declaracion ?? 'Abrir'}
                      </Link>
                      <MarcaAnulada declaracion={row.declaracion} />
                    </Td>
                    <Td>
                      <OtherSide side={side} detalle={row} />
                    </Td>
                    <Td>{formatText(row.declaracion.secuencia_uso)}</Td>
                    <Td>{formatText(usoDe(row.declaracion))}</Td>
                    <Td {...NUMERICA}>{formatMoney(row.declaracion.valor_autoavaluo)}</Td>
                    <Td {...NUMERICA}>{formatMoney(row.declaracion.valor_afecto)}</Td>
                    <Td className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link to={`/declaraciones/${row.declaracion.id}`} aria-label={`Editar declaración ${row.declaracion.anio}`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>
    </div>
  )
}
