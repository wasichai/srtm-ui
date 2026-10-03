import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { QueryState } from '@wasichai/core'
import { Badge, Card } from '@wasichai/ui'
import { Coins, Gavel, Landmark, MapPin, Receipt, Users } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { rentas } from '../api'
import { FichaTabs } from '../components/FichaTabs'
import { currentYear, formatMoney } from '../components/format'
import { StatCard } from '../components/StatCard'
import { YearSelect } from '../components/YearSelect'
import { UBICACION_SECTIONS } from '../forms/declaracionSpecs'
import { useCatalogos } from '../queries'
import { useWorkspaceTab } from '../shell/WorkspaceTabs'
import { ArbitriosDelPredio } from './Arbitrios'
import { DatosPanel } from './DatosPanel'
import { camposDe } from './DeclaracionPage'
import { DeclaracionesDelAnio, HistorialDeclaraciones } from './Declaraciones'
import { EliminarFicha } from './EliminarFicha'
import { FichaHeader } from './FichaHeader'
import { InfraccionesDe } from './InfraccionesDe'
import { VerPu } from './VerPdf'

export function PredioRoute() {
  const { id = '' } = useParams()
  return <PredioPage key={id} id={id} />
}

function PredioPage({ id }: { id: string }) {
  const [anio, setAnio] = useState(currentYear)
  const [params, setParams] = useSearchParams()
  const catalogos = useCatalogos()
  const ficha = useQuery({ queryKey: ['predio', id, anio], queryFn: () => rentas.predio(id, anio), placeholderData: keepPreviousData })
  const p = ficha.data?.predio
  useWorkspaceTab(p ? { path: `/predios/${id}`, label: p.codigo ?? 'Predio', kind: 'predio' } : null)

  return (
    <QueryState query={ficha}>
      {({ predio, titulares, totales }) => (
        <div className="space-y-5">
          <FichaHeader
            kind={predio.numero_registro ? `Predio · Registro Nº ${predio.numero_registro}` : 'Predio'}
            title={`${predio.codigo ?? ''} · ${predio.direccion ?? ''}`}
            badges={
              <>
                {predio.tipo_predio && <Badge>{predio.tipo_predio}</Badge>}
                {(predio.sector_catastral || predio.manzana_catastral) && (
                  <span>
                    Sector {predio.sector_catastral ?? '—'} · Manzana {predio.manzana_catastral ?? '—'}
                  </span>
                )}
                {predio.habilitacion_urbana && <span>· {predio.habilitacion_urbana}</span>}
              </>
            }
            aside={
              <div className="flex items-center gap-3">
                <YearSelect value={anio} onChange={setAnio} />
                <VerPu predio={id} codigo={predio.codigo ?? id} anio={anio} titulares={titulares} />
                <EliminarFicha path={`/predios/${id}`} singular="predio" borrar={() => rentas.borrarPredio(id)} />
              </div>
            }
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Users} label={`Titulares ${anio}`} value={String(titulares)} />
            <StatCard icon={Receipt} label={`Autoavalúo ${anio}`} value={formatMoney(totales.autoavaluo)} />
            <StatCard icon={Coins} label={`Valor afecto ${anio}`} value={formatMoney(totales.valor_afecto)} />
          </div>
          <Card className="pb-4">
            <FichaTabs
              label="Secciones del predio"
              active={params.get('tab') ?? 'ubicacion'}
              onChange={(tab) => setParams({ tab }, { replace: true })}
              tabs={[
                {
                  id: 'ubicacion',
                  label: 'Datos de la ubicación',
                  icon: MapPin,
                  render: () => (
                    <div className="px-6 pt-5">
                      <DatosPanel
                        sections={UBICACION_SECTIONS}
                        values={predio}
                        options={catalogos.data?.predio}
                        save={async (values) => {
                          // only the ubicación's fields, over the predio as it is now
                          const latest = (await rentas.predio(id, anio)).predio
                          const own = Object.fromEntries(
                            camposDe(UBICACION_SECTIONS).map((c) => [c, (values as unknown as Record<string, unknown>)[c] ?? null])
                          )
                          return rentas.actualizarPredio(id, { ...latest, ...own })
                        }}
                      />
                    </div>
                  )
                },
                {
                  id: 'titulares',
                  label: 'Titulares',
                  icon: Users,
                  render: () => (
                    <div className="pt-2">
                      <DeclaracionesDelAnio side="predio" id={id} anio={anio} />
                    </div>
                  )
                },
                {
                  id: 'declaraciones',
                  label: 'Declaraciones',
                  icon: Receipt,
                  render: () => (
                    <div className="px-6 pt-5">
                      <HistorialDeclaraciones side="predio" id={id} />
                    </div>
                  )
                },
                {
                  id: 'arbitrios',
                  label: 'Arbitrios',
                  icon: Landmark,
                  render: () => (
                    <div className="px-6 pt-5">
                      <ArbitriosDelPredio id={id} anio={anio} />
                    </div>
                  )
                },
                {
                  id: 'infracciones',
                  label: 'Infracciones',
                  icon: Gavel,
                  render: () => (
                    <div className="px-6 pt-5">
                      <InfraccionesDe de="predios" id={id} />
                    </div>
                  )
                }
              ]}
            />
          </Card>
        </div>
      )}
    </QueryState>
  )
}
