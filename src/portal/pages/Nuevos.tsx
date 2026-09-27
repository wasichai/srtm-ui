import { Card, CardBody, CardHeader, CardTitle } from '@wasichai/ui'
import { useLocation, useNavigate } from 'react-router'
import { rentas } from '../api'
import { RecordForm } from '../forms/RecordForm'
import { UBICACION_SECTIONS } from '../forms/declaracionSpecs'
import { emptyOf } from '../forms/specs'
import { ubicacionDeLote } from '../forms/ubicacion'
import { useCatalogos, useRefresh } from '../queries'
import type { CatastroFiscal, Predio } from '../types'

// the padrón's district, in the selva: where a new predio most likely is
const PERENE = { ubigeo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE', region: 'SELVA' }

const sinVacios = (values: Partial<Predio>) => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null && v !== undefined))

// the srtm's registro de predio: its ubicación, its catastro fiscal and its lote. code and registration number are the
// backend's
export function NuevoPredioPage() {
  const navigate = useNavigate()
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  // from "buscar predios" on the list: a lote of the catastro that is no predio yet
  const lote = (useLocation().state as { lote?: CatastroFiscal } | null)?.lote
  return (
    <Card className="mx-auto max-w-6xl">
      <CardHeader>
        <CardTitle>Nuevo predio</CardTitle>
      </CardHeader>
      <CardBody>
        <RecordForm
          sections={UBICACION_SECTIONS}
          options={catalogos.data?.predio}
          initial={emptyOf<Predio>(UBICACION_SECTIONS, { ...PERENE, condicion: 'URBANO', ...(lote ? sinVacios(ubicacionDeLote(lote)) : {}) })}
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
