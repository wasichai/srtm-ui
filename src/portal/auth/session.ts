import { useAuth } from '@wasichai/core'
import { useCallback } from 'react'

export const TABS_KEY = 'srtm.tabs'
// whose the stored tabs are (WorkspaceTabsProvider's `usuario`)
export const TABS_USER_KEY = 'srtm.tabs.usuario'

// the session is core's AuthProvider (mounted by WasichaiProviders), the admin's too: same srtm.token and
// srtm.user. the portal only adds forgetting its workspace tabs on sign-out. storage that refuses must not keep the
// clerk signed in
export function useSession() {
  const { user, isAdmin, signIn, signOut } = useAuth()
  const leave = useCallback(() => {
    try {
      sessionStorage.removeItem(TABS_KEY)
      sessionStorage.removeItem(TABS_USER_KEY)
    } catch {
      // storage blocked: there is nothing stored to forget
    }
    signOut()
  }, [signOut])
  return { user, isAdmin, signIn, signOut: leave }
}
