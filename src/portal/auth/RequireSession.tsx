import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSession } from './session'

export function RequireSession({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

// only a path of this site, read as the browser reads it: ?next=//evil.example must not leave the app, nor
// /\evil.example (a backslash is a slash to it) nor a path with a tab or a newline in it (it drops them)
export function safeNext(next: string | null): string {
  if (!next?.startsWith('/')) return '/'
  try {
    const url = new URL(next, window.location.origin)
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/'
  } catch {
    return '/'
  }
}
