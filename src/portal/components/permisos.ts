import { useAuth, type CallerPermissions } from '@wasichai/core'

export type Accion = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'

// whether these permissions allow `accion` on an object of the model: an admin always may
export function permite(permissions: CallerPermissions | null | undefined, objeto: string, accion: Accion = 'CREATE'): boolean {
  return Boolean(permissions?.admin || permissions?.objects?.[objeto]?.includes(accion))
}

// whether the signed-in account may do `accion` on an object of the model: an admin always may. an act's button that
// asks this is shown disabled with why when it may not, never hidden (the backend refuses with a 403 all the same)
export function usePuede(objeto: string, accion: Accion = 'CREATE'): boolean {
  const { permissions } = useAuth()
  return permite(permissions, objeto, accion)
}

// whether it may read any of these objects: what a screen that only lists them needs to be offered at all (a menu
// entry, a tab). an empty list asks nothing
export function puedeLeerAlguno(permissions: CallerPermissions | null | undefined, objetos: readonly string[] | undefined): boolean {
  return !objetos?.length || objetos.some((objeto) => permite(permissions, objeto, 'READ'))
}
