import { Button, Card } from '@wasichai/ui'
import { ArrowRight, FileText, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { rentas } from '../api'
import { FichaTabs } from '../components/FichaTabs'
import { today } from '../components/format'
import { RecordForm } from '../forms/RecordForm'
import { CONTRIBUYENTE_SECTIONS, emptyOf } from '../forms/specs'
import { useCatalogos, useRefresh } from '../queries'
import type { Contribuyente } from '../types'
import { CONTRIBUYENTE_TABS } from './ContribuyentePage'

const FORM_ID = 'nuevo-contribuyente'

// the srtm's wizard, step one: the datos del contribuyente. "Siguiente" inscribes it and opens its ficha on
// Domicilios; the other tabs stay greyed until the contribuyente exists, as in the srtm
export function NuevoContribuyentePage() {
  const navigate = useNavigate()
  const catalogos = useCatalogos()
  const refresh = useRefresh()

  const inscribir = async (values: Contribuyente) => {
    const created = await rentas.inscribirContribuyente(values)
    await refresh()
    navigate(`/contribuyentes/${created.id}?tab=domicilios`, { replace: true })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink uppercase">Nuevo contribuyente</h1>
          <p className="text-xs font-semibold tracking-wide text-brand uppercase italic">Insertar contribuyente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <X className="size-4" />
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID}>
            <ArrowRight className="size-4" />
            Siguiente
          </Button>
        </div>
      </div>
      <Card className="pb-5">
        <FichaTabs
          label="Registro de contribuyente"
          active="datos"
          onChange={() => {}}
          tabs={CONTRIBUYENTE_TABS.map((tab, i) => ({
            ...tab,
            icon: FileText,
            disabled: i > 0,
            render: () => (
              <div className="px-6 pt-5">
                <RecordForm
                  formId={FORM_ID}
                  hideActions
                  sections={CONTRIBUYENTE_SECTIONS}
                  options={catalogos.data?.contribuyente}
                  initial={emptyOf<Contribuyente>(CONTRIBUYENTE_SECTIONS, {
                    motivo: 'INSCRIPCION',
                    medio_determinacion: 'DECLARACION JURADA',
                    medio_presentacion: 'FISICO',
                    fecha_presentacion: today(),
                    fuente_informacion: 'MANUAL'
                  })}
                  submitLabel="Siguiente"
                  onSubmit={inscribir}
                />
              </div>
            )
          }))}
        />
      </Card>
    </div>
  )
}
