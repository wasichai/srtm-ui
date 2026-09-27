import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Th } from '@wasichai/ui'
import { FileText, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { rentas } from '../api'
import { anulada } from '../components/EstadoBadge'
import { currentYear, formatMoney, formatNumber, formatText } from '../components/format'
import { EmptyState, QueryState } from '../components/QueryState'
import { NUMERICA } from '../components/tabla'
import { RecordForm } from '../forms/RecordForm'
import { RecordPicker, type Picked } from '../forms/RecordPicker'
import type { SectionSpec } from '../forms/specs'
import { useRefresh } from '../queries'
import type { Contribuyente, Declaracion, DeclaracionDetalle, Predio } from '../types'

// "datos de los condóminos": the titulares of the declaración's predio, year and secuencia de uso. each declares its
// own %; condición, valor de condominio and valor afecto are the backend's (srtm-backend#4), shown here read-only.
// an annulled declaración is out of the condominio (srtm-backend#7)

const PORCENTAJE: SectionSpec[] = [
  { title: 'Condómino', fields: [{ name: 'porcentaje_condominio', label: '% de propiedad', kind: 'decimal', required: true, span: 2 }] }
]

const describir = (c: Contribuyente): Picked => ({ id: c.id!, label: `${c.numero_documento ?? 's/d'} · ${c.nombre_completo ?? ''}` })
const nombre = (row: DeclaracionDetalle) => row.contribuyente?.nombre_completo ?? 'el condómino'

export function CondominosPanel({ declaracion, predio, readOnly }: { declaracion: Declaracion; predio: Predio; readOnly?: boolean }) {
  const anio = declaracion.anio ?? currentYear()
  const refresh = useRefresh()
  // same queries as the predio's titulares and totals
  const query = useQuery({
    queryKey: ['predio', predio.id, 'declaraciones', anio],
    queryFn: () => rentas.declaracionesDePredio(predio.id!, anio),
    select: (rows) => rows.filter((row) => row.declaracion.secuencia_uso === declaracion.secuencia_uso && !anulada(row.declaracion))
  })
  const totales = useQuery({ queryKey: ['predio', predio.id, anio], queryFn: () => rentas.predio(predio.id!, anio), select: (ficha) => ficha.totales }).data
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState<DeclaracionDetalle | null>(null)
  const rows = query.data ?? []
  const suma = rows.reduce((total, row) => total + (row.declaracion.porcentaje_condominio ?? 0), 0)

  const agregar = async (contribuyente: string, values: Declaracion) => {
    await rentas.agregarCondomino(declaracion.id!, { contribuyente, porcentaje_condominio: values.porcentaje_condominio })
    await refresh()
    setAgregando(false)
  }
  // over the declaración as it is now: core's update replaces every field
  const cambiar = async (row: DeclaracionDetalle, values: Declaracion) => {
    const latest = await rentas.declaracionJurada(row.declaracion.id!)
    await rentas.actualizarDeclaracion(row.declaracion.id!, { ...latest.declaracion, porcentaje_condominio: values.porcentaje_condominio })
    await refresh()
    setEditando(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-ink uppercase">Listado de condóminos</h3>
          {query.data && (
            <p className="text-xs text-ink-muted">
              Año {anio} · secuencia de uso {formatText(declaracion.secuencia_uso)} · suman {formatNumber(suma)} % de propiedad
            </p>
          )}
        </div>
        {!readOnly && (
          <Button variant="secondary" size="sm" onClick={() => setAgregando(true)} aria-label="Agregar condómino">
            <Plus className="size-4 text-brand" />
            Agregar
          </Button>
        )}
      </div>
      <QueryState query={query}>
        {() =>
          rows.length === 0 ? (
            <EmptyState title="No se encontraron resultados" />
          ) : (
            <Table data-ui="table">
              <thead>
                <tr>
                  <Th>Titular</Th>
                  <Th>Condición</Th>
                  <Th {...NUMERICA}>Autoavalúo</Th>
                  <Th {...NUMERICA}>% de propiedad</Th>
                  <Th {...NUMERICA}>Valor condominio</Th>
                  <Th {...NUMERICA}>Deducción</Th>
                  <Th {...NUMERICA}>Valor afecto</Th>
                  <Th>DJ</Th>
                  {/* relative: the sr-only text is absolute and would otherwise widen the page past the table's scroll */}
                  <Th className="relative">
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.declaracion.id} className="hover:bg-surface-muted/60">
                    <Td>
                      {row.contribuyente ? (
                        <div>
                          <Link to={`/contribuyentes/${row.contribuyente.id}`} className="font-medium text-link hover:underline">
                            {row.contribuyente.nombre_completo}
                          </Link>
                          <p className="text-xs text-ink-muted">
                            {row.contribuyente.tipo_documento} {row.contribuyente.numero_documento}
                          </p>
                        </div>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>{row.declaracion.condicion_propiedad ? <Badge>{row.declaracion.condicion_propiedad}</Badge> : '—'}</Td>
                    <Td {...NUMERICA}>{formatMoney(row.declaracion.valor_autoavaluo)}</Td>
                    <Td {...NUMERICA}>{formatNumber(row.declaracion.porcentaje_condominio)}</Td>
                    <Td {...NUMERICA}>{formatMoney(row.declaracion.valor_condominio)}</Td>
                    <Td {...NUMERICA}>{formatMoney(row.declaracion.deduccion)}</Td>
                    <Td {...NUMERICA}>{formatMoney(row.declaracion.valor_afecto)}</Td>
                    <Td>
                      <Link to={`/declaraciones/${row.declaracion.id}`} className="inline-flex items-center gap-1 text-link hover:underline">
                        <FileText className="size-3.5" />
                        {row.declaracion.numero_declaracion ?? 'Abrir'}
                      </Link>
                    </Td>
                    <Td className="text-right">
                      {/* a sole titular holds 100 %: there is nothing to change until a condómino joins */}
                      {rows.length > 1 && !readOnly && (
                        <Button variant="ghost" size="icon" aria-label={`Editar % de propiedad de ${nombre(row)}`} onClick={() => setEditando(row)}>
                          <Pencil className="size-4" />
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
              {/* the predio's year, as its ficha counts it: its autoavalúo once, each titular's afecto */}
              <tfoot>
                <tr className="font-semibold">
                  <Td colSpan={2}>Total {anio}</Td>
                  <Td {...NUMERICA}>{formatMoney(totales?.autoavaluo)}</Td>
                  <Td colSpan={3} />
                  <Td {...NUMERICA}>{formatMoney(totales?.valor_afecto)}</Td>
                  <Td colSpan={2} />
                </tr>
              </tfoot>
            </Table>
          )
        }
      </QueryState>

      {agregando && <AgregarCondominoDialog onSave={agregar} onClose={() => setAgregando(false)} />}
      {editando && (
        <Dialog open onOpenChange={(open) => !open && setEditando(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle className="text-lg font-semibold">% de propiedad de {nombre(editando)}</DialogTitle>
            <DialogDescription className="mb-4 text-sm text-ink-muted">Los % de los condóminos no pueden sumar más de 100.</DialogDescription>
            <RecordForm
              sections={PORCENTAJE}
              initial={{ porcentaje_condominio: editando.declaracion.porcentaje_condominio } as Declaracion}
              submitLabel="Grabar"
              onSubmit={(values) => cambiar(editando, values)}
              onCancel={() => setEditando(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function AgregarCondominoDialog({ onSave, onClose }: { onSave: (contribuyente: string, values: Declaracion) => Promise<void>; onClose: () => void }) {
  const [picked, setPicked] = useState<Picked | null>(null)
  const [pickError, setPickError] = useState<string | undefined>()
  const save = async (values: Declaracion) => {
    if (!picked) {
      setPickError('Elige un contribuyente')
      throw new Error('Falta elegir el contribuyente')
    }
    await onSave(picked.id, values)
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold">Agregar condómino</DialogTitle>
        <DialogDescription className="mb-4 text-sm text-ink-muted">
          Su declaración jurada del mismo predio, año y secuencia de uso, con las características de esta. Con un solo titular, su % sale del de ese titular;
          con más, los % no pueden sumar más de 100.
        </DialogDescription>
        <RecordForm sections={PORCENTAJE} initial={{ porcentaje_condominio: null } as Declaracion} submitLabel="Grabar" onSubmit={save} onCancel={onClose}>
          <RecordPicker
            label="Contribuyente"
            placeholder="DNI, RUC o nombre"
            value={picked}
            onChange={(p) => {
              setPicked(p)
              setPickError(undefined)
            }}
            search={(q) => rentas.contribuyentes(q, 0, 8)}
            describe={describir}
            error={pickError}
          />
        </RecordForm>
      </DialogContent>
    </Dialog>
  )
}
