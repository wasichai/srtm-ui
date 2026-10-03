import { useAuth } from '@wasichai/core'

export type Accion = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'

// whether the signed-in account may do `accion` on an object of the model: an admin always may. an act's button that
// asks this is shown disabled with why when it may not, never hidden (the backend refuses with a 403 all the same)
export function usePuede(objeto: string, accion: Accion = 'CREATE'): boolean {
  const { permissions } = useAuth()
  return Boolean(permissions?.admin || permissions?.objects?.[objeto]?.includes(accion))
}
