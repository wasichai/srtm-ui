import { useQuery } from '@tanstack/react-query'
import { Badge, Card } from '@wasichai/ui'
import { Building2, FileText, MapPin, Signpost, Users } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { rentas } from '../api'
import { FichaTabs } from '../components/FichaTabs'
import { QueryState } from '../components/QueryState'
import { CARACTERISTICAS_SECTIONS, DATOS_DEL_PREDIO, DJ_DATOS_SECTIONS, UBICACION_SECTIONS } from '../forms/declaracionSpecs'
import { dataFields, type SectionSpec } from '../forms/specs'
import { useCatalogos } from '../queries'
import { useWorkspaceTab } from '../shell/WorkspaceTabs'
import type { Declaracion, Predio } from '../types'
import { DatosPanel } from './DatosPanel'
import { DeclaracionesDelAnio } from './Declaraciones'
import { FichaHeader } from './FichaHeader'
import { FrentesPanel, NivelesPanel, ObrasPanel, TransferentesPanel } from './DeclaracionListas'

// the srtm's tabs of a declaración jurada predial
export const DECLARACION_TABS = [
  { id: 'datos', label: 'Datos del predio' },
  { id: 'ubicacion', label: 'Datos de la ubicación' },
  { id: 'transferentes', label: 'Datos del transferente' },
  { id: 'caracteristicas', label: 'Características' },
  { id: 'condominos', label: 'Datos de los condóminos' },
  { id: 'frentes', label: 'Otros frentes' }
] as const

// a form tab sends only its own fields, over the record as it is now: the other tabs of the same record may have
// saved meanwhile, and core's update replaces every field
export function camposDe(sections: SectionSpec[]): string[] {
  return dataFields(sections)
    .filter((f) => !f.readOnly)
    .map((f) => f.name)
}

function sobre<T extends object>(latest: T, values: T, campos: string[]): T {
  const own = Object.fromEntries(campos.map((name) => [name, (values as Record<string, unknown>)[name] ?? null]))
  return { ...latest, ...own }
}

export function DeclaracionRoute() {
  const { id = '' } = useParams()
  return <DeclaracionPage key={id} id={id} />
}

function DeclaracionPage({ id }: { id: string }) {
  const [params, setParams] = useSearchParams()
  const catalogos = useCatalogos()
  const ficha = useQuery({ queryKey: ['declaracion', id], queryFn: () => rentas.declaracionJurada(id) })
  const dj = ficha.data
  useWorkspaceTab(
    dj ? { path: `/declaraciones/${id}`, label: `DJ ${dj.declaracion.numero_declaracion ?? ''} ${dj.predio.codigo ?? ''}`.trim(), kind: 'declaracion' } : null
  )

  const guardarDeclaracion = (sections: SectionSpec[]) => async (values: Declaracion) => {
    const latest = await rentas.declaracionJurada(id)
    const campos = camposDe(sections).filter((c) => !DATOS_DEL_PREDIO.includes(c))
    await rentas.actualizarDeclaracion(id, sobre(latest.declaracion, values, campos))
    // the tipo de predio shown in datos del predio is the predio's
    const condicion = (values as unknown as Record<string, unknown>).condicion
    if (condicion !== undefined && condicion !== latest.predio.condicion) {
      await rentas.actualizarPredio(latest.predio.id!, { ...latest.predio, condicion: (condicion as string | null) ?? null })
    }
  }
  const guardarPredio = async (values: Predio) => {
    const latest = await rentas.declaracionJurada(id)
    return rentas.actualizarPredio(latest.predio.id!, sobre(latest.predio, values, camposDe(UBICACION_SECTIONS)))
  }

  return (
    <QueryState query={ficha}>
      {({ declaracion, predio, contribuyente, actualizado }) => {
        // datos del predio shows a few of the predio's fields beside the declaration's
        const datos = {
          ...declaracion,
          codigo_predio: predio.codigo,
          numero_registro: predio.numero_registro,
          condicion: predio.condicion,
          fecha_actualizacion: actualizado ?? null
        }
        const condominio = declaracion.condicion_propiedad === 'CONDOMINO'
        return (
          <div className="space-y-5">
            <FichaHeader
              kind={
                <Link to={`/contribuyentes/${contribuyente.id}`} className="hover:text-brand hover:underline">
                  {contribuyente.codigo ? `Contribuyente Nº ${contribuyente.codigo}` : 'Contribuyente'} - {contribuyente.nombre_completo}
                </Link>
              }
              title={`Declaración jurada predial${declaracion.numero_declaracion ? ` - ${declaracion.numero_declaracion}` : ''}`}
              badges={
                <>
                  {declaracion.anio && <Badge>{declaracion.anio}</Badge>}
                  {declaracion.condicion_propiedad && <Badge>{declaracion.condicion_propiedad}</Badge>}
                  <Link to={`/predios/${predio.id}`} className="font-medium text-brand hover:underline">
                    {predio.codigo}
                  </Link>
                  <span>· {predio.direccion}</span>
                </>
              }
            />
            <Card className="pb-4">
              <FichaTabs
                label="Secciones de la declaración jurada"
                active={params.get('tab') ?? 'datos'}
                onChange={(tab) => setParams({ tab }, { replace: true })}
                tabs={[
                  {
                    ...DECLARACION_TABS[0],
                    icon: FileText,
                    render: () => (
                      <div className="px-6 pt-5">
                        <DatosPanel
                          sections={DJ_DATOS_SECTIONS}
                          values={datos}
                          options={{ ...catalogos.data?.declaracion_predial, condicion: catalogos.data?.predio?.condicion ?? [] }}
                          save={guardarDeclaracion(DJ_DATOS_SECTIONS)}
                        />
                      </div>
                    )
                  },
                  {
                    ...DECLARACION_TABS[1],
                    icon: MapPin,
                    render: () => (
                      <div className="px-6 pt-5">
                        <DatosPanel sections={UBICACION_SECTIONS} values={predio} options={catalogos.data?.predio} save={guardarPredio} />
                      </div>
                    )
                  },
                  {
                    ...DECLARACION_TABS[2],
                    icon: Users,
                    render: () => (
                      <div className="px-6 pt-5">
                        <TransferentesPanel declaracion={id} />
                      </div>
                    )
                  },
                  {
                    ...DECLARACION_TABS[3],
                    icon: Building2,
                    render: () => (
                      <div className="space-y-8 px-6 pt-5">
                        <DatosPanel
                          sections={CARACTERISTICAS_SECTIONS}
                          values={declaracion}
                          options={catalogos.data?.declaracion_predial}
                          save={guardarDeclaracion(CARACTERISTICAS_SECTIONS)}
                        />
                        <NivelesPanel declaracion={id} />
                        <ObrasPanel declaracion={id} />
                      </div>
                    )
                  },
                  {
                    ...DECLARACION_TABS[4],
                    icon: Users,
                    // as in the srtm: only a condómino's declaration has co-owners to show
                    disabled: !condominio,
                    render: () => (
                      <div className="pt-2">
                        <DeclaracionesDelAnio side="predio" id={predio.id!} anio={declaracion.anio ?? new Date().getFullYear()} />
                      </div>
                    )
                  },
                  {
                    ...DECLARACION_TABS[5],
                    icon: Signpost,
                    render: () => (
                      <div className="px-6 pt-5">
                        <FrentesPanel declaracion={id} />
                      </div>
                    )
                  }
                ]}
              />
            </Card>
          </div>
        )
      }}
    </QueryState>
  )
}
