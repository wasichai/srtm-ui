import { useQuery } from '@tanstack/react-query'
import { Card, CardBody, CardHeader, CardTitle } from '@wasichai/ui'
import { useLocation, useNavigate } from 'react-router'
import { RecordForm } from '../../kit/forms/RecordForm'
import { emptyOf } from '../../kit/forms/spec'
import { rentas } from '../api'
import { PERENE_PREDIO } from '../forms/bloques'
import { UBICACION_SECTIONS } from '../forms/declaracionSpecs'
import { camposDelLote, ubicacionDeLote } from '../forms/ubicacion'
import { useCatalogos, useRefresh } from '../queries'
import type { CatastroFiscal, Predio } from '../types'

const sinVacios = (values: Partial<Predio>) => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null && v !== undefined))

// the srtm's registro de predio: its ubicación, its catastro fiscal and its lote. code and registration number are the
// backend's (from a lote's CPU, the lote's municipal code)
export function NuevoPredioPage() {
  const navigate = useNavigate()
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  // from "buscar predios" on the list: a lote of the catastro that is no predio yet
  const lote = (useLocation().state as { lote?: CatastroFiscal } | null)?.lote
  // the lote's ubigeo is a code: its departamento, provincia and distrito come from the INEI list
  const ubigeos = useQuery({ queryKey: ['ubigeos'], queryFn: rentas.ubigeos, staleTime: Infinity, enabled: Boolean(lote?.ubigeo) })
  const delLote = lote ? sinVacios(ubicacionDeLote(lote, ubigeos.data)) : {}
  // Perené's place and región only for a lote there, or for no lote
  const base = !lote?.ubigeo || lote.ubigeo === PERENE_PREDIO.ubigeo ? PERENE_PREDIO : {}
  return (
    <Card className="mx-auto max-w-6xl">
      <CardHeader>
        <CardTitle>Nuevo predio</CardTitle>
      </CardHeader>
      <CardBody>
        {lote?.ubigeo && ubigeos.isPending ? (
          <p className="text-sm text-ink-muted">Cargando…</p>
        ) : (
          <RecordForm
            sections={UBICACION_SECTIONS}
            options={catalogos.data?.predio}
            initial={emptyOf<Predio>(UBICACION_SECTIONS, { ...base, tipo_predio: 'PREDIO URBANO', ...delLote })}
            // what the lote brought stays greyed until "desbloquear"
            locked={camposDelLote(delLote)}
            submitLabel="Registrar predio"
            onCancel={() => navigate(-1)}
            onSubmit={async (values) => {
              // the lote's municipal code is only shown: the backend finds the lote by its CPU
              const created = await rentas.crearPredio({ ...values, codigo: null })
              await refresh()
              navigate(`/predios/${created.id}`, { replace: true })
            }}
          />
        )}
      </CardBody>
    </Card>
  )
}
