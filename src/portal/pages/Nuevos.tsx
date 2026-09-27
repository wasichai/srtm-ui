import { Card, CardBody, CardHeader, CardTitle } from '@wasichai/ui'
import { useNavigate } from 'react-router'
import { rentas } from '../api'
import { RecordForm } from '../forms/RecordForm'
import { emptyOf, PREDIO_SECTIONS } from '../forms/specs'
import { useCatalogos, useRefresh } from '../queries'
import type { Predio } from '../types'

export function NuevoPredioPage() {
  const navigate = useNavigate()
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>Nuevo predio</CardTitle>
      </CardHeader>
      <CardBody>
        <RecordForm
          sections={PREDIO_SECTIONS}
          options={catalogos.data?.predio}
          initial={emptyOf<Predio>(PREDIO_SECTIONS, { condicion: 'URBANO' })}
          submitLabel="Registrar predio"
          onCancel={() => navigate(-1)}
          onSubmit={async (values) => {
            const created = await rentas.crearPredio(values)
            await refresh()
            navigate(`/predios/${created.id}`, { replace: true })
          }}
        />
      </CardBody>
    </Card>
  )
}
