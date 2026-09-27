import { useQuery } from '@tanstack/react-query'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Th } from '@wasichai/ui'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { HijosApi } from '../api'
import { EstadoBadge } from '../components/EstadoBadge'
import { EmptyState, QueryState } from '../components/QueryState'
import { RecordForm } from '../forms/RecordForm'
import type { FormValues, SectionSpec } from '../forms/specs'
import { useCatalogos, useRefresh } from '../queries'
import type { CatalogKey } from '../types'

export interface Columna<T> {
  label: string
  render: (row: T, index: number) => ReactNode
  className?: string
}

interface HijosPanelProps<T> {
  // the record the list hangs from: a contribuyente, a declaración
  parent: string
  api: HijosApi<T>
  queryKey: string
  // "domicilios": the list's heading. "domicilio": the dialogs'
  plural: string
  singular: string
  sections: SectionSpec[]
  catalog: CatalogKey
  columns: Columna<T>[]
  // a new one's starting values, knowing the rows already there (the first domicilio is the fiscal one)
  nuevo: (rows: T[]) => T
  aviso?: (rows: T[]) => ReactNode
  footer?: (values: FormValues) => ReactNode
  wide?: boolean
}

type Hijo = { id?: string; estado?: string | null }

// one of the lists of a contribuyente (domicilios, relacionados...) or a declaración (transferentes, niveles...),
// as the srtm draws them: a heading with "+", the table with its state, and a dialog to add or change a row
export function HijosPanel<T extends Hijo>({
  parent,
  api,
  queryKey,
  plural,
  singular,
  sections,
  catalog,
  columns,
  nuevo,
  aviso,
  footer,
  wide
}: HijosPanelProps<T>) {
  const query = useQuery({ queryKey: [queryKey, parent], queryFn: () => api.listar(parent) })
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  const [editing, setEditing] = useState<T | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<T | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const rows = query.data ?? []

  const close = () => {
    setEditing(null)
    setAdding(false)
  }
  const save = async (values: T) => {
    if (editing?.id) await api.actualizar(editing.id, values)
    else await api.agregar(parent, values)
    await refresh()
    close()
  }
  const remove = async () => {
    if (!removing?.id) return
    setRemoveError(null)
    try {
      await api.borrar(removing.id)
      await refresh()
      setRemoving(null)
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }
  const open = adding || editing !== null

  return (
    <div className="space-y-4">
      {query.data && aviso?.(query.data)}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold tracking-wide text-ink uppercase">Listado de {plural}</h3>
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)} aria-label={`Agregar ${singular}`}>
          <Plus className="size-4 text-brand" />
          Agregar
        </Button>
      </div>
      <QueryState query={query}>
        {() =>
          rows.length === 0 ? (
            <EmptyState title="No se encontraron resultados" />
          ) : (
            <Table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <Th key={c.label} className={c.className}>
                      {c.label}
                    </Th>
                  ))}
                  <Th>Estado</Th>
                  {/* relative: the sr-only text is absolute and would otherwise widen the page past the table's scroll */}
                  <Th className="relative">
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-surface-muted/60">
                    {columns.map((c) => (
                      <Td key={c.label} className={c.className}>
                        {c.render(row, index)}
                      </Td>
                    ))}
                    <Td>
                      <EstadoBadge estado={row.estado} />
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" aria-label={`Editar ${singular} ${index + 1}`} onClick={() => setEditing(row)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Eliminar ${singular} ${index + 1}`} onClick={() => setRemoving(row)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>

      {open && (
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent className={wide ? 'max-h-[90vh] max-w-5xl overflow-y-auto' : 'max-h-[90vh] overflow-y-auto'}>
            <DialogTitle className="text-lg font-semibold uppercase">{editing ? `Editar ${singular}` : `Nuevo ${singular}`}</DialogTitle>
            <DialogDescription className="sr-only">Datos del {singular}</DialogDescription>
            <div className="mt-4">
              <RecordForm
                sections={sections}
                options={catalogos.data?.[catalog]}
                initial={editing ?? nuevo(rows)}
                submitLabel="Grabar"
                onSubmit={save}
                onCancel={close}
                footer={footer}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {removing && (
        <Dialog open onOpenChange={(o) => !o && setRemoving(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle className="text-lg font-semibold">¿Eliminar este {singular}?</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-ink-muted">Se quita de la ficha. El historial del registro lo conserva.</DialogDescription>
            {removeError && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {removeError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => void remove()}>
                Eliminar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
