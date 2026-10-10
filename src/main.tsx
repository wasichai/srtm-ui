import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
// the printable document sheet's css, not run through tailwind (see @wasichai/documents)
import '@wasichai/documents/print.css'
// ?worker&url bundles maplibre's worker with its shared chunk into one file (plain ?url does not), without
// pulling maplibre itself into this chunk: the map loads with the first map (LotesMap in the portal, gis in the admin)
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { setMapWorkerUrl } from './portal/components/mapWorker'
import './index.css'

// two apps, one build: /admin is wasichai's admin, everything else the end-user portal. each is its own chunk, loaded
// only where it is drawn: the portal's clerks never download the admin's modules (workflow, pages, views, forms,
// documents, gis), nor the admin the portal's screens
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })))
const PortalApp = lazy(() => import('./portal/PortalApp').then((m) => ({ default: m.PortalApp })))

const admin = /^\/admin(\/|$)/.test(window.location.pathname)
setMapWorkerUrl(workerUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense>{admin ? <AdminApp workerUrl={workerUrl} /> : <PortalApp />}</Suspense>
  </StrictMode>
)
