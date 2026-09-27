import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Table, Td, Th } from '@wasichai/ui'
import { FileText, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { rentas } from '../api'
import { formatMoney, formatNumber, formatText } from '../components/format'
import { EmptyState, QueryState } from '../components/QueryState'
import { DeclaracionDialog, describeContribuyente, describePredio, type Side } from '../forms/DeclaracionDialog'
import type { Declaracion, DeclaracionDetalle } from '../types'

// the declarations of a ficha. side is the ficha's own kind; each row shows the other side

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
        <Link to={`/predios/${p.id}`} className="font-medium text-brand hover:underline">
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
      <Link to={`/contribuyentes/${c.id}`} className="font-medium text-brand hover:underline">
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
                <Th className="text-right">% condominio</Th>
                <Th>Uso</Th>
                <Th className="text-right">Autoavalúo</Th>
                <Th className="text-right">Valor afecto</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.declaracion.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <OtherSide side={side} detalle={row} />
                  </Td>
                  <Td>{row.declaracion.condicion_propiedad ? <Badge>{row.declaracion.condicion_propiedad}</Badge> : '—'}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(row.declaracion.porcentaje_condominio)}</Td>
                  <Td>{formatText(row.declaracion.uso)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(row.declaracion.valor_autoavaluo)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(row.declaracion.valor_afecto)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <Td colSpan={4}>Total {anio}</Td>
                <Td className="text-right tabular-nums">{formatMoney(totales?.autoavaluo)}</Td>
                <Td className="text-right tabular-nums">{formatMoney(totales?.valor_afecto)}</Td>
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
  const [editing, setEditing] = useState<{ declaracion: Declaracion | null; otherLabel?: string } | null>(null)
  const navigate = useNavigate()
  const otherTitle = side === 'contribuyente' ? 'Predio' : 'Contribuyente'
  // from a contribuyente, a new declaration is the srtm's declaración jurada (with its predio); from a predio, the
  // short form, whose contribuyente is picked
  const nueva = () => (side === 'contribuyente' ? navigate(`/contribuyentes/${id}/declaraciones/nueva`) : setEditing({ declaracion: null }))

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
                  <Th>Estado</Th>
                  <Th className="text-right">Autoavalúo</Th>
                  <Th className="text-right">Valor afecto</Th>
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
                      <Link to={`/declaraciones/${row.declaracion.id}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                        <FileText className="size-3.5" />
                        {row.declaracion.numero_declaracion ?? 'Abrir'}
                      </Link>
                    </Td>
                    <Td>
                      <OtherSide side={side} detalle={row} />
                    </Td>
                    <Td>{formatText(row.declaracion.secuencia_uso)}</Td>
                    <Td>{formatText(row.declaracion.uso)}</Td>
                    <Td>{formatText(row.declaracion.estado_construccion)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(row.declaracion.valor_autoavaluo)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(row.declaracion.valor_afecto)}</Td>
                    <Td className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar declaración ${row.declaracion.anio}`}
                        onClick={() => setEditing({ declaracion: row.declaracion, otherLabel: otherLabel(side, row) })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>
      {editing && (
        <DeclaracionDialog side={side} sideId={id} declaracion={editing.declaracion} otherLabel={editing.otherLabel} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function otherLabel(side: Side, row: DeclaracionDetalle): string | undefined {
  if (side === 'contribuyente') return row.predio ? describePredio(row.predio).label : undefined
  return row.contribuyente ? describeContribuyente(row.contribuyente).label : undefined
}
