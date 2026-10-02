import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { QueryState } from '@wasichai/core'
import { Badge, Card } from '@wasichai/ui'
import { Coins, FileText, Landmark, MapPinned, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { rentas } from '../api'
import { FichaTabs } from '../components/FichaTabs'
import { currentYear, formatMoney } from '../components/format'
import { PasosAsistente } from '../components/PasosAsistente'
import { StatCard } from '../components/StatCard'
import { YearSelect } from '../components/YearSelect'
import { INSTRUCCIONES_INSCRIPCION } from '../forms/instrucciones'
import { CONTRIBUYENTE_SECTIONS } from '../forms/specs'
import { useCatalogos } from '../queries'
import { useWorkspaceTab } from '../shell/WorkspaceTabs'
import { DomiciliosPanel, esFiscalActivo, MediosContactoPanel, RelacionadosPanel, SustentosPanel } from './ContribuyenteListas'
import { ArbitriosDelContribuyente } from './Arbitrios'
import { DatosPanel } from './DatosPanel'
import { DeclaracionesDelAnio, HistorialDeclaraciones } from './Declaraciones'
import { EliminarFicha } from './EliminarFicha'
import { FichaHeader } from './FichaHeader'
import { VerHr } from './VerPdf'

// the srtm's registro de contribuyente, in its order, then what rentas adds: the year's predios and every declaration
export const CONTRIBUYENTE_TABS = [
  { id: 'datos', label: 'Datos del contribuyente' },
  { id: 'domicilios', label: 'Domicilios' },
  { id: 'relacionados', label: 'Relacionados' },
  { id: 'contacto', label: 'Medios de contacto' },
  { id: 'sustento', label: 'Sustento' }
] as const

// the inscription wizard's steps (pp. 4, 7, 9): Domicilios right away; once a fiscal domicilio is active, Relacionados,
// and then each tab opens the next when it is visited. rentas' own tabs come after the srtm's last
const PASOS: Record<string, number> = { datos: 0, domicilios: 1, relacionados: 2, contacto: 3, sustento: 4, predios: 5, declaraciones: 5, arbitrios: 5 }

// keyed by id: another contribuyente is a fresh ficha (first tab, this year), not this one reused
export function ContribuyenteRoute() {
  const { id = '' } = useParams()
  return <ContribuyentePage key={id} id={id} />
}

function ContribuyentePage({ id }: { id: string }) {
  const [anio, setAnio] = useState(currentYear)
  const [params, setParams] = useSearchParams()
  const catalogos = useCatalogos()
  const ficha = useQuery({
    queryKey: ['contribuyente', id, anio],
    queryFn: () => rentas.contribuyente(id, anio),
    placeholderData: keepPreviousData
  })
  // opened by the wizard: its tabs by steps. from the search, every tab
  const inscripcion = params.has('inscripcion')
  const domicilios = useQuery({ queryKey: ['domicilios', id], queryFn: () => rentas.domicilios.listar(id), enabled: inscripcion })
  const fiscal = domicilios.data?.some(esFiscalActivo) ?? false
  const [alcanzado, setAlcanzado] = useState(() => Math.max(PASOS.domicilios, PASOS[params.get('tab') ?? ''] ?? 0))
  const habilitada = (tab: string) => !inscripcion || PASOS[tab] <= PASOS.domicilios || (fiscal && PASOS[tab] <= alcanzado + 1)
  const abrir = (tab: string) => {
    setAlcanzado((a) => Math.max(a, PASOS[tab] ?? 0))
    setParams(inscripcion ? { tab, inscripcion: '1' } : { tab }, { replace: true })
  }
  // the step the inscription is on: the open tab, when it is one of the srtm's (rentas' own come after its last)
  const activa = params.get('tab') ?? 'datos'
  const paso = inscripcion ? CONTRIBUYENTE_TABS.find((tab) => tab.id === activa && habilitada(tab.id))?.id : undefined
  const c = ficha.data?.contribuyente
  useWorkspaceTab(c ? { path: `/contribuyentes/${id}`, label: `${c.numero_documento ?? ''} ${c.nombre_completo ?? ''}`.trim(), kind: 'contribuyente' } : null)

  return (
    <QueryState query={ficha}>
      {({ contribuyente, predios, totales }) => (
        <div className="space-y-5">
          <FichaHeader
            kind={contribuyente.codigo ? `Contribuyente Nº ${contribuyente.codigo}` : 'Contribuyente'}
            title={contribuyente.nombre_completo ?? '—'}
            badges={
              <>
                {(contribuyente.tipo_contribuyente ?? contribuyente.tipo_persona) && (
                  <Badge>{contribuyente.tipo_contribuyente ?? contribuyente.tipo_persona}</Badge>
                )}
                <span>
                  {contribuyente.tipo_documento} {contribuyente.numero_documento}
                </span>
                {contribuyente.domicilio_fiscal && <span>· {contribuyente.domicilio_fiscal}</span>}
              </>
            }
            aside={
              <div className="flex items-center gap-3">
                <YearSelect value={anio} onChange={setAnio} />
                <VerHr contribuyente={id} codigo={contribuyente.codigo ?? contribuyente.numero_documento ?? id} anio={anio} />
                <EliminarFicha path={`/contribuyentes/${id}`} singular="contribuyente" borrar={() => rentas.borrarContribuyente(id)} />
              </div>
            }
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={MapPinned} label={`Predios ${anio}`} value={String(predios)} />
            <StatCard icon={Receipt} label={`Autoavalúo ${anio}`} value={formatMoney(totales.autoavaluo)} />
            <StatCard icon={Coins} label={`Valor afecto ${anio}`} value={formatMoney(totales.valor_afecto)} />
          </div>
          {/* the inscription goes on here after Nuevo contribuyente: its steps, as there */}
          {paso && <PasosAsistente pasos={CONTRIBUYENTE_TABS} actual={paso} onIr={abrir} puedeIr={habilitada} instruccion={INSTRUCCIONES_INSCRIPCION[paso]} />}
          <Card className="pb-4">
            <FichaTabs
              label="Secciones del contribuyente"
              active={activa}
              onChange={abrir}
              tabs={[
                {
                  ...CONTRIBUYENTE_TABS[0],
                  icon: FileText,
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
                  ...CONTRIBUYENTE_TABS[1],
                  icon: FileText,
                  render: () => (
                    <div className="px-6 pt-5">
                      <DomiciliosPanel contribuyente={contribuyente} />
                    </div>
                  )
                },
                {
                  ...CONTRIBUYENTE_TABS[2],
                  icon: FileText,
                  render: () => (
                    <div className="px-6 pt-5">
                      <RelacionadosPanel contribuyente={id} />
                    </div>
                  )
                },
                {
                  ...CONTRIBUYENTE_TABS[3],
                  icon: FileText,
                  render: () => (
                    <div className="px-6 pt-5">
                      <MediosContactoPanel contribuyente={id} />
                    </div>
                  )
                },
                {
                  ...CONTRIBUYENTE_TABS[4],
                  icon: FileText,
                  render: () => (
                    <div className="px-6 pt-5">
                      <SustentosPanel contribuyente={id} />
                    </div>
                  )
                },
                {
                  id: 'predios',
                  label: 'Predios',
                  icon: MapPinned,
                  render: () => (
                    <div className="pt-2">
                      <DeclaracionesDelAnio side="contribuyente" id={id} anio={anio} />
                    </div>
                  )
                },
                {
                  id: 'declaraciones',
                  label: 'Declaraciones',
                  icon: Receipt,
                  render: () => (
                    <div className="px-6 pt-5">
                      <HistorialDeclaraciones side="contribuyente" id={id} />
                    </div>
                  )
                },
                {
                  id: 'arbitrios',
                  label: 'Arbitrios',
                  icon: Landmark,
                  render: () => (
                    <div className="px-6 pt-5">
                      <ArbitriosDelContribuyente id={id} anio={anio} />
                    </div>
                  )
                }
              ].map((tab) => ({ ...tab, disabled: !habilitada(tab.id) }))}
            />
          </Card>
        </div>
      )}
    </QueryState>
  )
}
