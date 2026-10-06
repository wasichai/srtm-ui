import { QueryClient } from '@tanstack/react-query'
import { ApiError, createRegistry, createWasichaiI18n, resolveConfig, WasichaiProviders } from '@wasichai/core'
import { useState } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router'
import { SRTM_THEMES } from '../themes'
import { client } from './api'
import { LoginPage } from './auth/LoginPage'
import { RequireSession } from './auth/RequireSession'
import { ajustarI18n } from './i18n'
import { KitDelPortal } from './KitDelPortal'
import { BuscarPage } from './pages/BuscarPage'
import { ContribuyenteRoute } from './pages/ContribuyentePage'
import { DeclaracionRoute } from './pages/DeclaracionPage'
import { ConsultaArbitriosPage, TasasArbitriosPage } from './pages/ArbitriosPages'
import { DeterminacionesPage } from './pages/DeterminacionesPage'
import { EmisionesPage } from './pages/EmisionesPage'
import { CuisPage } from './pages/CuisPage'
import { AnuncioRoute } from './pages/AnuncioPage'
import { PadronAnunciosPage, TasasAnunciosPage } from './pages/AnunciosPages'
import { NuevoAnuncioPage } from './pages/NuevoAnuncioPage'
import { NotificacionesPage } from './pages/NotificacionesPage'
import { EscalasYPlazosPage } from './pages/EscalasYPlazosPage'
import { ExpedientesPage } from './pages/ExpedientesPage'
import { ExpedienteRoute } from './pages/ExpedientePage'
import { NuevaActaPage } from './pages/NuevaActaPage'
import { NuevaDeclaracionRoute } from './pages/NuevaDeclaracionPage'
import { InicioPage } from './pages/InicioPage'
import { LoteCatastroRoute, NuevoLotePage } from './pages/LoteCatastroPage'
import { ContribuyentesPage, PrediosPage } from './pages/Listas'
import { NuevoContribuyentePage } from './pages/NuevoContribuyentePage'
import { NuevoPredioPage } from './pages/Nuevos'
import { PredioRoute } from './pages/PredioPage'
import { AppShell } from './shell/AppShell'
import { ErrorDeRuta, PaginaNoEncontrada } from './shell/ErroresDeRuta'
import { WorkspaceTabsProvider } from './shell/WorkspaceTabs'

// a 4xx will not change by asking again; a network blip or a 5xx might
const retry = (count: number, error: unknown) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2

// a data router: a page with changes not saved can hold a navigation (useBlocker). a screen that fails while it
// renders shows ErrorDeRuta in the shell's content (the pathless route around the screens); the shell's or the
// login's own failure, on the whole page
const rutas = createRoutesFromElements(
  <>
    <Route path="/login" element={<LoginPage />} errorElement={<ErrorDeRuta completa />} />
    <Route
      element={
        <RequireSession>
          <WorkspaceTabsProvider>
            <AppShell />
          </WorkspaceTabsProvider>
        </RequireSession>
      }
      errorElement={<ErrorDeRuta completa />}
    >
      <Route errorElement={<ErrorDeRuta />}>
        <Route index element={<InicioPage />} />
        <Route path="buscar" element={<BuscarPage />} />
        <Route path="contribuyentes" element={<ContribuyentesPage />} />
        <Route path="contribuyentes/nuevo" element={<NuevoContribuyentePage />} />
        <Route path="contribuyentes/:id" element={<ContribuyenteRoute />} />
        <Route path="contribuyentes/:id/declaraciones/nueva" element={<NuevaDeclaracionRoute />} />
        <Route path="declaraciones/nueva" element={<NuevaDeclaracionRoute />} />
        <Route path="declaraciones/:id" element={<DeclaracionRoute />} />
        <Route path="predios" element={<PrediosPage />} />
        <Route path="predios/nuevo" element={<NuevoPredioPage />} />
        <Route path="predios/:id" element={<PredioRoute />} />
        <Route path="catastro/nuevo" element={<NuevoLotePage />} />
        <Route path="catastro/:id" element={<LoteCatastroRoute />} />
        <Route path="emisiones" element={<EmisionesPage />} />
        <Route path="arbitrios" element={<ConsultaArbitriosPage />} />
        <Route path="arbitrios/tasas" element={<TasasArbitriosPage />} />
        <Route path="arbitrios/determinaciones" element={<DeterminacionesPage />} />
        <Route path="infracciones" element={<ExpedientesPage />} />
        <Route path="infracciones/nueva" element={<NuevaActaPage />} />
        <Route path="infracciones/notificaciones" element={<NotificacionesPage />} />
        <Route path="infracciones/cuis" element={<CuisPage />} />
        <Route path="anuncios" element={<PadronAnunciosPage />} />
        <Route path="anuncios/nuevo" element={<NuevoAnuncioPage />} />
        <Route path="anuncios/tasas" element={<TasasAnunciosPage />} />
        <Route path="anuncios/:id" element={<AnuncioRoute />} />
        <Route path="infracciones/plazos" element={<EscalasYPlazosPage />} />
        <Route path="infracciones/:id" element={<ExpedienteRoute />} />
        <Route path="*" element={<PaginaNoEncontrada />} />
      </Route>
    </Route>
  </>
)

// the end-user portal: municipal staff looking up and keeping contribuyentes, predios and declarations.
// under core's providers, like the admin: one session, and the theme the user picked (stored for them) on both sides.
// no modules: the portal draws its own screens. it registers srtm's themes like the admin does (their labels are in
// core's i18n). spanish only, so a locale picked in the admin is left alone, with the srtm's wording and figures over
// core's strings (ajustarI18n). the kit's forms take the portal's labels and error box (KitDelPortal)
export function PortalApp() {
  const [app] = useState(() => {
    const config = resolveConfig({ apiBaseUrl: '/api', storagePrefix: 'srtm', appName: 'Rentas municipales', languages: ['es'], themes: SRTM_THEMES })
    const registry = createRegistry([])
    const i18n = createWasichaiI18n({ languages: config.languages, storageKey: client.keys.lang, modules: registry.modules })
    ajustarI18n(i18n)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry, refetchOnWindowFocus: false } } })
    return { config, registry, i18n, queryClient, router: createBrowserRouter(rutas) }
  })

  return (
    <WasichaiProviders config={app.config} registry={app.registry} apiClient={client} i18n={app.i18n} queryClient={app.queryClient}>
      <KitDelPortal>
        <RouterProvider router={app.router} />
      </KitDelPortal>
    </WasichaiProviders>
  )
}
