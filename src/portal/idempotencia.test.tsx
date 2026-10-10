import { afterEach, describe, expect, it, vi } from 'vitest'
import { claveDeIdempotencia } from './api'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => vi.unstubAllGlobals())

// the Idempotency-Key of an anuncio's alta (NuevoAnuncioPage): one per attempt, reused on its retries
describe('claveDeIdempotencia', () => {
  it('is a random v4 uuid', () => {
    const una = claveDeIdempotencia()
    expect(una).toMatch(UUID_V4)
    expect(claveDeIdempotencia()).not.toBe(una)
  })

  it('is one too where crypto.randomUUID does not exist (the portal over plain http)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    const una = claveDeIdempotencia()
    expect(una).toMatch(UUID_V4)
    expect(claveDeIdempotencia()).not.toBe(una)
  })
})
