import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// the printable document sheet's css, not run through tailwind (see @wasichai/documents)
import '@wasichai/documents/print.css'
import { AdminApp } from './admin/AdminApp'
import { PortalApp } from './portal/PortalApp'
import './index.css'

// two apps, one bundle: /admin is wasichai's admin, everything else the end-user portal
const admin = /^\/admin(\/|$)/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(<StrictMode>{admin ? <AdminApp /> : <PortalApp />}</StrictMode>)
