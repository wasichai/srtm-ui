import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { KitProvider, useKit } from './KitProvider'
import { DEFAULT_TEXTS } from './texts'

describe('KitProvider', () => {
  it('returns DEFAULT_TEXTS and identity enumLabel when no provider', () => {
    const { result } = renderHook(() => useKit())
    expect(result.current.texts).toEqual(DEFAULT_TEXTS)
    expect(result.current.enumLabel('any', 'value')).toBe('value')
  })

  it('merges partial texts and keeps defaults', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <KitProvider texts={{ select: 'ELEGIR' }}>{children}</KitProvider>
    const { result } = renderHook(() => useKit(), { wrapper })
    expect(result.current.texts.select).toBe('ELEGIR')
    expect(result.current.texts.required).toBe(DEFAULT_TEXTS.required)
    expect(result.current.texts.cancel).toBe(DEFAULT_TEXTS.cancel)
  })

  it('applies custom enumLabel', () => {
    const customLabel = (_f: string, v: string) => v + '!'
    const wrapper = ({ children }: { children: ReactNode }) => <KitProvider enumLabel={customLabel}>{children}</KitProvider>
    const { result } = renderHook(() => useKit(), { wrapper })
    expect(result.current.enumLabel('x', 'A')).toBe('A!')
  })

  it('provides renderAlert as default', () => {
    const { result } = renderHook(() => useKit())
    const alert = result.current.renderAlert('test message')
    expect(alert).toBeDefined()
  })
})
