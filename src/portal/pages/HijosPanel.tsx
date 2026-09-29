import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { EditableList, type Column } from '../../kit/crud/EditableList'
import type { FormValues, SectionSpec } from '../../kit/forms/spec'
import type { HijosApi } from '../api'
import { EstadoBadge } from '../components/EstadoBadge'
import { useCatalogos, useRefresh } from '../queries'
import type { CatalogKey } from '../types'

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
  columns: Column<T>[]
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

// what a list closes with: the estado, as the srtm draws it. module level: one reference for every render
const ESTADO = { label: 'Estado', render: (row: Hijo) => <EstadoBadge estado={row.estado} /> }

// one of the lists of a contribuyente (domicilios, relacionados...) or a declaración (transferentes, niveles...),
// as the srtm draws them. the list itself is the kit's (EditableList): here it gets the srtm's api, catalogs, refresh
// and estado
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
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  return (
    <EditableList<T>
      queryKey={[queryKey, parent]}
      load={() => api.listar(parent)}
      save={(editing, values) => (editing?.id ? api.actualizar(editing.id, values) : api.agregar(parent, values))}
      remove={async (row) => {
        if (row.id) await api.borrar(row.id)
      }}
      onChanged={refresh}
      plural={plural}
      singular={singular}
      sections={sections}
      options={catalogos.data?.[catalog]}
      columns={columns}
      status={sinEstado ? undefined : ESTADO}
      newRow={nuevo}
      notice={aviso}
      fixed={fijo}
      footer={footer}
      wide={wide}
      readOnly={readOnly}
    />
  )
}
