import type { ThemeDefinition, WasichaiModule } from '@wasichai/core'
import { TEMA_PORTAL } from './useVarianteTema'

export { TEMA_PORTAL, useVarianteTema, type VarianteTema } from './useVarianteTema'

// srtm's own themes, on top of core's light and dark. portal and admin both register them (config.themes), so a
// pick on one side shows on the other. index.html keeps an id -> color scheme copy for its boot script
export const SRTM_THEMES: ThemeDefinition[] = [{ id: TEMA_PORTAL, label: 'srtm:theme.portalTributario', colorScheme: 'light' }]

// the labels above, under the `srtm` i18n namespace: core's selector (admin) and the portal's menu both t() them
export const srtmModule: WasichaiModule = {
  id: 'srtm',
  i18n: {
    es: { theme: { portalTributario: 'Portal tributario' } },
    en: { theme: { portalTributario: 'Tax portal' } }
  }
}
