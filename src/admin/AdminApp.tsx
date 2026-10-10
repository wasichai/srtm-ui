import { useEffect } from 'react'
import { WasichaiApp } from '@wasichai/core'
import { documentsModule } from '@wasichai/documents'
import { formsModule } from '@wasichai/forms'
import { gisModule } from '@wasichai/gis'
import { pagesModule } from '@wasichai/pages'
import { viewsModule } from '@wasichai/views'
import { workflowModule } from '@wasichai/workflow'
import { SRTM_THEMES } from '../themes'

// the admin: core plus the modules srtm-backend runs (workflow, documents, views, forms, pages, gis), under /admin.
// storagePrefix 'srtm' is the portal's too, so one sign-in serves both. workerUrl is maplibre's worker script, the
// one main.tsx hands the portal's maps: gis draws lote_geom and ubicacion with it. srtm's themes are the
// portal's, so a theme picked on one side shows on the other
export function AdminApp({ workerUrl }: { workerUrl?: string }) {
  // map controls need maplibre's css: it comes with the admin, not in the portal's first bundle
  useEffect(() => {
    void import('maplibre-gl/dist/maplibre-gl.css')
  }, [])
  return (
    <WasichaiApp
      config={{
        apiBaseUrl: '/api',
        appName: 'Rentas municipales',
        appTagline: 'Administración',
        storagePrefix: 'srtm',
        basename: '/admin',
        // the seed's admin, in development only (as the portal's LoginPage)
        defaultLoginEmail: import.meta.env.DEV ? 'admin@wasichai.local' : undefined,
        themes: SRTM_THEMES
      }}
      modules={[workflowModule(), pagesModule(), viewsModule(), formsModule(), documentsModule(), gisModule({ workerUrl })]}
    />
  )
}
