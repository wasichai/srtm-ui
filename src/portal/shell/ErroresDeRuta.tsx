import { EmptyState } from '@wasichai/core'
import { Button, cn } from '@wasichai/ui'
import { AlertTriangle, SearchX } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'

// what the router draws when a screen fails while it renders (a bug, data it did not expect), instead of its page for
// developers. a screen's failure shows in the content, inside the shell: the menu and the workspace tabs stay, with
// whatever they hold. `completa` is for a failure of the shell itself or of the login, drawn on the whole page.
// trying again draws the screen anew: the router clears the error on a navigation, even to the same place. the error
// goes to the console (the router logs it), not to the clerk
export function ErrorDeRuta({ completa = false }: { completa?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <div role="alert" className={cn(completa && 'flex min-h-full items-center justify-center p-6')}>
      <EmptyState icon={AlertTriangle} title="No se pudo mostrar esta página">
        <p>Ocurrió un error inesperado. Vuelva a intentarlo; si se repite, avise a soporte técnico.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true })}>
            Volver a intentar
          </Button>
          <Button asChild variant="secondary">
            <Link to="/">Ir al inicio</Link>
          </Button>
        </div>
      </EmptyState>
    </div>
  )
}

// a path no screen answers (an old link, a typo): said so, with the way home
export function PaginaNoEncontrada() {
  return (
    <EmptyState icon={SearchX} title="Esta página no existe">
      <p>Revise la dirección o elija una opción del menú.</p>
      <div className="mt-4 flex justify-center">
        <Button asChild variant="secondary">
          <Link to="/">Ir al inicio</Link>
        </Button>
      </div>
    </EmptyState>
  )
}
