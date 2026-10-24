import { EmptyState, useAuth } from '@wasichai/core'
import { Card } from '@wasichai/ui'
import { Coins, SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { FichaTabs, type FichaTab } from '../../components/FichaTabs'
import { usePuede } from '../../components/permisos'
import { ArancelesTab } from './ArancelesTab'
import { ParametrosTab } from './ParametrosTab'

// Normativa (srtm-backend#186): the parámetros and the aranceles the backend computes with, each written by one
// person and verified by another before it rules (the doble firma). a tab for each, shown to who may read its object;
// the open one is in the url (?tab=)
export function NormativaPage() {
  const [params, setParams] = useSearchParams()
  // the permissions come after the session: until then neither "sin permiso" nor a tab (a failure to read them counts
  // as read: none)
  const auth = useAuth()
  const conPermisos = auth.permissions !== null || auth.permissionsError !== null
  const parametros = usePuede('parametro_tributario', 'READ')
  const aranceles = usePuede('arancel', 'READ')
  const tabs: FichaTab[] = [
    ...(parametros ? [{ id: 'parametros', label: 'Parámetros', icon: SlidersHorizontal, render: () => <ParametrosTab /> }] : []),
    ...(aranceles ? [{ id: 'aranceles', label: 'Aranceles', icon: Coins, render: () => <ArancelesTab /> }] : [])
  ]
  const activa = tabs.find((t) => t.id === params.get('tab'))?.id ?? tabs[0]?.id

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Normativa</h1>
        <p className="text-sm text-ink-muted">
          Los parámetros tributarios y los aranceles con que se calcula. Cada valor lo transcribe una persona y lo verifica otra: solo entonces rige.
        </p>
      </div>
      {!conPermisos ? null : tabs.length === 0 ? (
        <EmptyState title="Sin permiso">
          <p>Ver la normativa pide lectura sobre los parámetros tributarios o los aranceles.</p>
        </EmptyState>
      ) : (
        <Card className="pb-4">
          <FichaTabs
            label="Normativa"
            tabs={tabs.map((t) => ({ ...t, render: () => <div className="px-6 pt-5">{t.render()}</div> }))}
            active={activa!}
            onChange={(tab) => setParams({ tab }, { replace: true })}
          />
        </Card>
      )}
    </div>
  )
}
