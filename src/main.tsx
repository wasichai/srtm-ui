import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// the printable document sheet's css, not run through tailwind (see @wasichai/documents)
import '@wasichai/documents/print.css'
// ?worker&url bundles maplibre's worker with its shared chunk into one file (plain ?url does not), without
// pulling maplibre itself into this chunk: the map loads with the first map (LotesMap in the portal, gis in the admin)
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { setMapWorkerUrl } from './portal/components/mapWorker'
import { AdminApp } from './admin/AdminApp'
import { PortalApp } from './portal/PortalApp'
import './index.css'

// two apps, one bundle: /admin is wasichai's admin, everything else the end-user portal
const admin = /^\/admin(\/|$)/.test(window.location.pathname)
setMapWorkerUrl(workerUrl)

createRoot(document.getElementById('root')!).render(<StrictMode>{admin ? <AdminApp workerUrl={workerUrl} /> : <PortalApp />}</StrictMode>)
