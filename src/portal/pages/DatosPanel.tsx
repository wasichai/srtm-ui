import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@wasichai/ui'
import { FieldGrid } from '../../kit/forms/FieldGrid'
import { RecordForm } from '../../kit/forms/RecordForm'
import type { SectionSpec } from '../../kit/forms/spec'
import { useRefresh } from '../queries'

// the Datos tab: read first, edit on demand, back to reading once saved
export function DatosPanel<T extends object>({
  sections,
  values,
  options,
  save
}: {
  sections: SectionSpec[]
  values: T
  options?: Record<string, string[]>
  save: (values: T) => Promise<unknown>
}) {
  const [editing, setEditing] = useState(false)
  const refresh = useRefresh()

  if (editing) {
    return (
      <RecordForm
        sections={sections}
        options={options}
        initial={values}
        submitLabel="Guardar cambios"
        onCancel={() => setEditing(false)}
        onSubmit={async (next) => {
          await save(next)
          await refresh()
          setEditing(false)
        }}
      />
    )
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
          Editar
        </Button>
      </div>
      <FieldGrid sections={sections} values={values} />
    </div>
  )
}
