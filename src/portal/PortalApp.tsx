import { QueryClient } from '@tanstack/react-query'
import { ApiError, createRegistry, createWasichaiI18n, resolveConfig, WasichaiProviders } from '@wasichai/core'
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { client } from './api'
import { LoginPage } from './auth/LoginPage'
import { RequireSession } from './auth/RequireSession'
import { EmptyState } from './components/QueryState'
import { BuscarPage } from './pages/BuscarPage'
import { ContribuyenteRoute } from './pages/ContribuyentePage'
import { InicioPage } from './pages/InicioPage'
import { ContribuyentesPage, PrediosPage } from './pages/Listas'
import { NuevoContribuyentePage, NuevoPredioPage } from './pages/Nuevos'
import { PredioRoute } from './pages/PredioPage'
import { AppShell } from './shell/AppShell'
import { WorkspaceTabsProvider } from './shell/WorkspaceTabs'

// a 4xx will not change by asking again; a network blip or a 5xx might
const retry = (count: number, error: unknown) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2

// the end-user portal: municipal staff looking up and keeping contribuyentes, predios and declarations.
// under core's providers, like the admin: one session, and the theme the user picked (stored for them) on both sides.
// no modules: the portal draws its own screens. spanish only, so a locale picked in the admin is left alone
export function PortalApp() {
  const [app] = useState(() => {
    const config = resolveConfig({ apiBaseUrl: '/api', storagePrefix: 'srtm', appName: 'Rentas municipales', languages: ['es'] })
    const registry = createRegistry([])
    const i18n = createWasichaiI18n({ languages: config.languages, storageKey: client.keys.lang, modules: registry.modules })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry, refetchOnWindowFocus: false } } })
    return { config, registry, i18n, queryClient }
  })

  return (
    <WasichaiProviders config={app.config} registry={app.registry} apiClient={client} i18n={app.i18n} queryClient={app.queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireSession>
                <WorkspaceTabsProvider>
                  <AppShell />
                </WorkspaceTabsProvider>
              </RequireSession>
            }
          >
            <Route index element={<InicioPage />} />
            <Route path="buscar" element={<BuscarPage />} />
            <Route path="contribuyentes" element={<ContribuyentesPage />} />
            <Route path="contribuyentes/nuevo" element={<NuevoContribuyentePage />} />
            <Route path="contribuyentes/:id" element={<ContribuyenteRoute />} />
            <Route path="predios" element={<PrediosPage />} />
            <Route path="predios/nuevo" element={<NuevoPredioPage />} />
            <Route path="predios/:id" element={<PredioRoute />} />
            <Route path="*" element={<EmptyState title="Esta página no existe" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WasichaiProviders>
  )
}
