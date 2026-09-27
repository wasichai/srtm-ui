import { Card } from '@wasichai/ui'
import { ArrowRight, FileText, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { rentas } from '../api'
import { Button } from '../components/controles'
import { FichaTabs } from '../components/FichaTabs'
import { today } from '../components/format'
import { PasosAsistente } from '../components/PasosAsistente'
import { INSTRUCCIONES_INSCRIPCION } from '../forms/instrucciones'
import { RecordForm } from '../forms/RecordForm'
import { CONTRIBUYENTE_SECTIONS, emptyOf } from '../forms/specs'
import { useCatalogos, useRefresh } from '../queries'
import type { Contribuyente } from '../types'
import { CabeceraAsistente } from './CabeceraAsistente'
import { CONTRIBUYENTE_TABS } from './ContribuyentePage'

const FORM_ID = 'nuevo-contribuyente'

// the srtm's wizard, step one: the datos del contribuyente. "Siguiente" inscribes it and opens its ficha on
// Domicilios, still in the wizard (inscripcion): the other tabs open step by step, as in the srtm
export function NuevoContribuyentePage() {
  const navigate = useNavigate()
  const catalogos = useCatalogos()
  const refresh = useRefresh()
  // once sent, never again: a second click would inscribe the same document twice. the ref holds before the
  // button's re-render does
  const sending = useRef(false)
  const [saving, setSaving] = useState(false)

  const inscribir = async (values: Contribuyente) => {
    if (sending.current) return
    sending.current = true
    setSaving(true)
    try {
      const created = await rentas.inscribirContribuyente(values)
      await refresh()
      navigate(`/contribuyentes/${created.id}?tab=domicilios&inscripcion=1`, { replace: true })
    } catch (e) {
      sending.current = false
      setSaving(false)
      throw e
    }
  }

  return (
    <div className="space-y-5">
      <CabeceraAsistente title="Nuevo contribuyente" detalle="Insertar contribuyente">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <X className="size-4" />
          Cancelar
        </Button>
        <Button type="submit" form={FORM_ID} disabled={saving}>
          <ArrowRight className="size-4" />
          {saving ? 'Guardando…' : 'Siguiente'}
        </Button>
      </CabeceraAsistente>
      {/* the inscription's first step: the other tabs wait for it, so there is no step to go to */}
      <PasosAsistente pasos={CONTRIBUYENTE_TABS} actual="datos" instruccion={INSTRUCCIONES_INSCRIPCION.datos} />
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
