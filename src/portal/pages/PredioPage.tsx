import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Badge, Card, Tabs } from '@wasichai/ui'
import { Coins, Receipt, Users } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { rentas } from '../api'
import { currentYear, formatMoney } from '../components/format'
import { QueryState } from '../components/QueryState'
import { StatCard } from '../components/StatCard'
import { YearSelect } from '../components/YearSelect'
import { PREDIO_SECTIONS } from '../forms/specs'
import { useCatalogos } from '../queries'
import { useWorkspaceTab } from '../shell/WorkspaceTabs'
import { DatosPanel } from './DatosPanel'
import { DeclaracionesDelAnio, HistorialDeclaraciones } from './Declaraciones'
import { FichaHeader } from './FichaHeader'

export function PredioRoute() {
  const { id = '' } = useParams()
  return <PredioPage key={id} id={id} />
}

function PredioPage({ id }: { id: string }) {
  const [anio, setAnio] = useState(currentYear)
  const catalogos = useCatalogos()
  const ficha = useQuery({ queryKey: ['predio', id, anio], queryFn: () => rentas.predio(id, anio), placeholderData: keepPreviousData })
  const p = ficha.data?.predio
  useWorkspaceTab(p ? { path: `/predios/${id}`, label: p.codigo ?? 'Predio', kind: 'predio' } : null)

  return (
    <QueryState query={ficha}>
      {({ predio, titulares, totales }) => (
        <div className="space-y-5">
          <FichaHeader
            kind="Predio"
            title={`${predio.codigo ?? ''} · ${predio.direccion ?? ''}`}
            badges={
              <>
                {predio.condicion && <Badge>{predio.condicion}</Badge>}
                {(predio.sector_catastral || predio.manzana_catastral) && (
                  <span>
                    Sector {predio.sector_catastral ?? '—'} · Manzana {predio.manzana_catastral ?? '—'}
                  </span>
                )}
                {predio.habilitacion_urbana && <span>· {predio.habilitacion_urbana}</span>}
              </>
            }
            aside={<YearSelect value={anio} onChange={setAnio} />}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Users} label={`Titulares ${anio}`} value={String(titulares)} />
            <StatCard icon={Receipt} label={`Autoavalúo ${anio}`} value={formatMoney(totales.autoavaluo)} />
            <StatCard icon={Coins} label={`Valor afecto ${anio}`} value={formatMoney(totales.valor_afecto)} />
          </div>
          <Card className="pb-4">
            <Tabs
              label="Secciones del predio"
              tabs={[
                {
                  id: 'datos',
                  label: 'Datos',
                  render: () => (
                    <div className="px-6 pt-5">
                      <DatosPanel
                        sections={PREDIO_SECTIONS}
                        values={predio}
                        options={catalogos.data?.predio}
                        save={(values) => rentas.actualizarPredio(id, values)}
                      />
                    </div>
                  )
                },
                {
                  id: 'titulares',
                  label: 'Titulares',
                  render: () => (
                    <div className="pt-2">
                      <DeclaracionesDelAnio side="predio" id={id} anio={anio} />
                    </div>
                  )
                },
                {
                  id: 'declaraciones',
                  label: 'Declaraciones',
                  render: () => (
                    <div className="px-6 pt-5">
                      <HistorialDeclaraciones side="predio" id={id} />
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
