'use client'

import { createContext, useMemo, use } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_TEXTS, type KitTexts } from './texts'

// Config injected into kit components
export interface KitConfig {
  texts: KitTexts
  // how an enum value reads (accents, SOLTERO(A)); default: as stored
  enumLabel: (field: string, value: string) => string
  // form-level error box
  renderAlert: (message: string) => ReactNode
}

// Default config
const DEFAULT_CONFIG: KitConfig = {
  texts: DEFAULT_TEXTS,
  enumLabel: (_, v) => v,
  renderAlert: (message) => (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  )
}

// Context for kit config
const KitContext = createContext<KitConfig>(DEFAULT_CONFIG)

interface KitProviderProps {
  texts?: Partial<KitTexts>
  enumLabel?: KitConfig['enumLabel']
  renderAlert?: KitConfig['renderAlert']
  children: ReactNode
}

// Provider component that merges texts and memoizes config
export function KitProvider({ texts, enumLabel, renderAlert, children }: KitProviderProps) {
  const config = useMemo<KitConfig>(
    () => ({
      texts: { ...DEFAULT_TEXTS, ...texts },
      enumLabel: enumLabel ?? DEFAULT_CONFIG.enumLabel,
      renderAlert: renderAlert ?? DEFAULT_CONFIG.renderAlert
    }),
    [texts, enumLabel, renderAlert]
  )

  return <KitContext.Provider value={config}>{children}</KitContext.Provider>
}

// Hook to use kit config (defaults to DEFAULT_CONFIG when no provider)
export function useKit(): KitConfig {
  return use(KitContext)
}
