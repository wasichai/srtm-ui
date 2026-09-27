import { useQuery } from '@tanstack/react-query'
import { Button, Card, CardBody, CardHeader, CardTitle } from '@wasichai/ui'
import { FileText, LandPlot, MapPinned, Plus, User, Users } from 'lucide-react'
import { Link } from 'react-router'
import { rentas } from '../api'
import { QueryState } from '../components/QueryState'
import { StatCard } from '../components/StatCard'
import { useSession } from '../auth/session'
import { useWorkspaceTabs } from '../shell/WorkspaceTabs'

export function InicioPage() {
  const { user } = useSession()
  const resumen = useQuery({ queryKey: ['resumen'], queryFn: rentas.resumen })
  const { tabs } = useWorkspaceTabs()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Inicio</h1>
        <p className="text-sm text-ink-muted">Hola{user?.displayName ? `, ${user.displayName}` : ''}. Busca un contribuyente o un predio para empezar.</p>
      </div>
      <QueryState query={resumen}>
        {(r) => (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Users} label="Contribuyentes" value={r.contribuyentes.toLocaleString('es-PE')} />
            <StatCard icon={MapPinned} label="Predios" value={r.predios.toLocaleString('es-PE')} />
            <StatCard icon={FileText} label="Declaraciones" value={r.declaraciones.toLocaleString('es-PE')} />
          </div>
        )}
      </QueryState>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atención rápida</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/contribuyentes">
                <Users className="size-4" />
                Buscar contribuyente
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/predios">
                <MapPinned className="size-4" />
                Buscar predio
              </Link>
            </Button>
            <Button asChild>
              <Link to="/contribuyentes/nuevo">
                <Plus className="size-4" />
                Nuevo contribuyente
              </Link>
            </Button>
            <Button asChild>
              <Link to="/predios/nuevo">
                <Plus className="size-4" />
                Nuevo predio
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/catastro/nuevo">
                <LandPlot className="size-4" />
                Nuevo lote de catastro
              </Link>
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fichas abiertas</CardTitle>
          </CardHeader>
          <CardBody>
            {tabs.length === 0 ? (
              <p className="text-sm text-ink-muted">Las fichas que abras quedan aquí y en las pestañas de arriba hasta que las cierres.</p>
            ) : (
              <ul className="space-y-1">
                {tabs.map((tab) => (
                  <li key={tab.path}>
                    <Link to={tab.path} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-brand hover:bg-brand-soft">
                      {tab.kind === 'predio' ? (
                        <MapPinned className="size-4" />
                      ) : tab.kind === 'declaracion' ? (
                        <FileText className="size-4" />
                      ) : tab.kind === 'lote' ? (
                        <LandPlot className="size-4" />
                      ) : (
                        <User className="size-4" />
                      )}
                      {tab.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
