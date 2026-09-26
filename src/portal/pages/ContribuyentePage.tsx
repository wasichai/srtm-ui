import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Badge, Card, Tabs } from '@wasichai/ui'
import { Coins, MapPinned, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { rentas } from '../api'
import { currentYear, formatMoney } from '../components/format'
import { QueryState } from '../components/QueryState'
import { StatCard } from '../components/StatCard'
import { YearSelect } from '../components/YearSelect'
import { CONTRIBUYENTE_SECTIONS } from '../forms/specs'
import { useCatalogos } from '../queries'
import { useWorkspaceTab } from '../shell/WorkspaceTabs'
import { DatosPanel } from './DatosPanel'
import { DeclaracionesDelAnio, HistorialDeclaraciones } from './Declaraciones'
import { FichaHeader } from './FichaHeader'

// keyed by id: another contribuyente is a fresh ficha (first tab, this year), not this one reused
export function ContribuyenteRoute() {
  const { id = '' } = useParams()
  return <ContribuyentePage key={id} id={id} />
}

function ContribuyentePage({ id }: { id: string }) {
  const [anio, setAnio] = useState(currentYear)
  const catalogos = useCatalogos()
  const ficha = useQuery({
    queryKey: ['contribuyente', id, anio],
    queryFn: () => rentas.contribuyente(id, anio),
    placeholderData: keepPreviousData
  })
  const c = ficha.data?.contribuyente
  useWorkspaceTab(c ? { path: `/contribuyentes/${id}`, label: `${c.numero_documento ?? ''} ${c.nombre_completo ?? ''}`.trim(), kind: 'contribuyente' } : null)

  return (
    <QueryState query={ficha}>
      {({ contribuyente, predios, totales }) => (
        <div className="space-y-5">
          <FichaHeader
            kind="Contribuyente"
            title={contribuyente.nombre_completo ?? '—'}
            badges={
              <>
                {contribuyente.tipo_persona && <Badge>{contribuyente.tipo_persona}</Badge>}
                <span>
                  {contribuyente.tipo_documento} {contribuyente.numero_documento}
                </span>
                {contribuyente.domicilio_fiscal && <span>· {contribuyente.domicilio_fiscal}</span>}
              </>
            }
            aside={<YearSelect value={anio} onChange={setAnio} />}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={MapPinned} label={`Predios ${anio}`} value={String(predios)} />
            <StatCard icon={Receipt} label={`Autoavalúo ${anio}`} value={formatMoney(totales.autoavaluo)} />
            <StatCard icon={Coins} label={`Valor afecto ${anio}`} value={formatMoney(totales.valor_afecto)} />
          </div>
          <Card className="pb-4">
            <Tabs
              label="Secciones del contribuyente"
              tabs={[
                {
                  id: 'datos',
                  label: 'Datos',
                  render: () => (
                    <div className="px-6 pt-5">
                      <DatosPanel
                        sections={CONTRIBUYENTE_SECTIONS}
                        values={contribuyente}
                        options={catalogos.data?.contribuyente}
                        save={(values) => rentas.actualizarContribuyente(id, values)}
                      />
                    </div>
                  )
                },
                {
                  id: 'predios',
                  label: 'Predios',
                  render: () => (
                    <div className="pt-2">
                      <DeclaracionesDelAnio side="contribuyente" id={id} anio={anio} />
                    </div>
                  )
                },
                {
                  id: 'declaraciones',
                  label: 'Declaraciones',
                  render: () => (
                    <div className="px-6 pt-5">
                      <HistorialDeclaraciones side="contribuyente" id={id} />
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
