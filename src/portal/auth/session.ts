import { useAuth } from '@wasichai/core'
import { useCallback } from 'react'

export const TABS_KEY = 'srtm.tabs'

// the session is core's AuthProvider (mounted by WasichaiProviders), the admin's too: same srtm.token and
// srtm.user. the portal only adds forgetting its workspace tabs on sign-out
export function useSession() {
  const { user, isAdmin, signIn, signOut } = useAuth()
  const leave = useCallback(() => {
    sessionStorage.removeItem(TABS_KEY)
    signOut()
  }, [signOut])
  return { user, isAdmin, signIn, signOut: leave }
}
