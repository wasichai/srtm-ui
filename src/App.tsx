import { WasichaiApp } from '@wasichai/core'
import { documentsModule } from '@wasichai/documents'
import { formsModule } from '@wasichai/forms'
import { pagesModule } from '@wasichai/pages'
import { viewsModule } from '@wasichai/views'
import { workflowModule } from '@wasichai/workflow'

// core plus the modules srtm-backend runs: workflow, documents, views, forms, pages. no gis, automation or agent.
// contribuyente, predio and declaracion_predial come from the backend metadata: nothing here per object
export function App() {
  return (
    <WasichaiApp
      config={{
        apiBaseUrl: '/api',
        appName: 'Rentas municipales',
        appTagline: 'Municipalidad Distrital de Perené',
        storagePrefix: 'srtm',
        defaultLoginEmail: 'admin@wasichai.local'
      }}
      modules={[workflowModule(), pagesModule(), viewsModule(), formsModule(), documentsModule()]}
    />
  )
}
