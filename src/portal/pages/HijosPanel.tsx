import { useQuery } from '@tanstack/react-query'
import { EmptyState, QueryState } from '@wasichai/core'
import { Button, cn, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle, PageSizePagination, Table, Td, Th } from '@wasichai/ui'
import { Box, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { RecordForm } from '../../kit/forms/RecordForm'
import type { FormValues, SectionSpec } from '../../kit/forms/spec'
import { errorMessage } from '../../kit/ui/errorMessage'
import type { HijosApi } from '../api'
import { EstadoBadge } from '../components/EstadoBadge'
import { NUMERICA } from '../components/tabla'
import { useCatalogos, useRefresh } from '../queries'
import type { CatalogKey } from '../types'

export interface Columna<T> {
  label: string
  render: (row: T) => ReactNode
  className?: string
  // figures (areas, amounts, %): right aligned with digits of one width, and marked for the theme
  numeric?: boolean
}

interface HijosPanelProps<T> {
  // the record the list hangs from: a contribuyente, a declaración
  parent: string
  api: HijosApi<T>
  queryKey: string
  // "domicilios": the list's heading. "domicilio": the dialogs'
  plural: string
  singular: string
  // the dialog's form; a function when it depends on the rows (the only fiscal domicilio keeps its tipo)
  sections: SectionSpec[] | ((rows: T[], editing: T | null) => SectionSpec[])
  catalog: CatalogKey
  columns: Columna<T>[]
  // a new one's starting values, knowing the rows already there (the first domicilio is the fiscal one)
  nuevo: (rows: T[]) => T
  aviso?: (rows: T[]) => ReactNode
  // why a row cannot be removed (the only fiscal domicilio): the delete button is disabled while it is selected
  fijo?: (row: T, rows: T[]) => string | null
  footer?: (values: FormValues, form: UseFormReturn<FormValues>) => ReactNode
  wide?: boolean
  // an annulled declaración's: listed, never changed
  readOnly?: boolean
  // the srtm's niveles, obras and otros frentes list no estado (pages 17, 20 and 21)
  sinEstado?: boolean
}

type Hijo = { id?: string; estado?: string | null }

// one of the lists of a contribuyente (domicilios, relacionados...) or a declaración (transferentes, niveles...),
// as the srtm draws them: a heading with "+", pencil and bin acting on the selected row, the table with its state,
// and a dialog to add or change a row
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
  fijo,
  footer,
  wide,
  readOnly,
  sinEstado
}: HijosPanelProps<T>) {
  const query = useQuery({ queryKey: [queryKey, parent], queryFn: () => api.listar(parent) })
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  const [editing, setEditing] = useState<T | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<T | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  // the row the pencil and the bin act on: one of the page shown, so a removed row or another page drops it
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // the srtm pages its lists: "Filas 10", "1 a 10 de 23 registros"
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const rows = query.data ?? []
  const last = Math.max(0, Math.ceil(rows.length / size) - 1)
  const shown = rows.slice(Math.min(page, last) * size, (Math.min(page, last) + 1) * size)
  const selected = shown.find((r) => r.id === selectedId) ?? null
  const motivo = selected ? (fijo?.(selected, rows) ?? undefined) : undefined

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
      setSelectedId(null)
    } catch (e) {
      setRemoveError(errorMessage(e, 'No se pudo eliminar'))
    }
  }
  const open = adding || editing !== null
  const edit = (row: T) => {
    if (!readOnly) setEditing(row)
  }
  // the grid's keys: the arrows move the selection (focusing a row selects it), Enter edits it
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    const next = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.key === 'ArrowUp' ? e.currentTarget.previousElementSibling : null
    if (next instanceof HTMLElement) {
      e.preventDefault()
      next.focus()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      edit(row)
    }
  }

  return (
    <div className="space-y-4">
      {query.data && aviso?.(query.data)}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold tracking-wide text-ink uppercase">Listado de {plural}</h3>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" className="border-brand text-brand" onClick={() => setAdding(true)} aria-label={`Agregar ${singular}`}>
              <Plus className="size-4" />
            </Button>
            <Button variant="secondary" size="icon" disabled={!selected} onClick={() => setEditing(selected)} aria-label={`Editar ${singular}`}>
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              disabled={!selected || motivo !== undefined}
              title={motivo}
              onClick={() => setRemoving(selected)}
              aria-label={`Eliminar ${singular}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <QueryState query={query}>
        {() =>
          rows.length === 0 ? (
            <EmptyState title="No se encontraron resultados!" icon={Box} />
          ) : (
            <Table role="grid" aria-label={`Listado de ${plural}`}>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <Th key={c.label} data-numeric={c.numeric || undefined} className={cn(c.numeric && NUMERICA.className, c.className)}>
                      {c.label}
                    </Th>
                  ))}
                  {!sinEstado && <Th>Estado</Th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, index) => {
                  const isSelected = row === selected
                  return (
                    <tr
                      key={row.id}
                      aria-selected={isSelected}
                      // one stop for Tab: the selected row, or the first while none is
                      tabIndex={isSelected || (selected === null && index === 0) ? 0 : -1}
                      onClick={() => setSelectedId(row.id ?? null)}
                      onFocus={() => setSelectedId(row.id ?? null)}
                      onDoubleClick={() => edit(row)}
                      onKeyDown={(e) => onKey(e, row)}
                      className={cn(
                        'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
                        isSelected ? 'bg-brand-soft' : 'hover:bg-surface-muted/60'
                      )}
                    >
                      {columns.map((c) => (
                        <Td
                          key={c.label}
                          data-numeric={c.numeric || undefined}
                          className={cn(c.numeric && NUMERICA.className, c.className, isSelected && 'text-brand-strong')}
                        >
                          {c.render(row)}
                        </Td>
                      ))}
                      {!sinEstado && (
                        <Td>
                          <EstadoBadge estado={row.estado} />
                        </Td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )
        }
      </QueryState>
      {rows.length > 0 && (
        <PageSizePagination
          page={Math.min(page, last)}
          size={size}
          total={rows.length}
          onPage={setPage}
          onSize={(next) => {
            setSize(next)
            setPage(0)
          }}
        />
      )}

      {open && (
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent className={wide ? 'max-h-[90vh] max-w-5xl overflow-y-auto' : 'max-h-[90vh] overflow-y-auto'}>
            <DialogTitle className="text-lg font-semibold uppercase">{editing ? `Editar ${singular}` : `Nuevo ${singular}`}</DialogTitle>
            <DialogDescription className="sr-only">Datos del {singular}</DialogDescription>
            <div className="mt-4">
              <RecordForm
                sections={typeof sections === 'function' ? sections(rows, editing) : sections}
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
        <ConfirmDialog
          title={`¿Eliminar este ${singular}?`}
          description="Se quita de la ficha. El historial del registro lo conserva."
          error={removeError}
          onConfirm={() => void remove()}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  )
}
