import { useNavigate } from 'react-router'

// "Cancelar": back to where the clerk came from in the portal. a screen it was opened at (in another browser tab, from
// a link, the one right after signing in) has no screen of the portal behind it: going back would leave the portal or
// do nothing, so it goes to `alternativa`. the router numbers the entries it made in this browser tab (history.state.idx)
export function useVolver(alternativa: string) {
  const navigate = useNavigate()
  return () => {
    const entrada = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (entrada > 0) void navigate(-1)
    else void navigate(alternativa)
  }
}
