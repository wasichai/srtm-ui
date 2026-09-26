import { WasichaiApp } from '@wasichai/core'
import { documentsModule } from '@wasichai/documents'
import { formsModule } from '@wasichai/forms'
import { pagesModule } from '@wasichai/pages'
import { viewsModule } from '@wasichai/views'
import { workflowModule } from '@wasichai/workflow'

// the admin: core plus the modules srtm-backend runs (workflow, documents, views, forms, pages), under /admin.
// storagePrefix 'srtm' is the portal's too, so one sign-in serves both
export function AdminApp() {
  return (
    <WasichaiApp
      config={{
        apiBaseUrl: '/api',
        appName: 'Rentas municipales',
        appTagline: 'Administración',
        storagePrefix: 'srtm',
        basename: '/admin',
        defaultLoginEmail: 'admin@wasichai.local'
      }}
      modules={[workflowModule(), pagesModule(), viewsModule(), formsModule(), documentsModule()]}
    />
  )
}
