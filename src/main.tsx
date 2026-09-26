import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// the printable document sheet's css, not run through tailwind (see @wasichai/documents)
import '@wasichai/documents/print.css'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
