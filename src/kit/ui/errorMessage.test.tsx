import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it("says the error's message", () => {
    expect(errorMessage(new Error('x'), 'y')).toBe('x')
  })

  it('falls back when what failed is no Error', () => {
    expect(errorMessage('boom', 'y')).toBe('y')
  })

  it('falls back when the message says nothing', () => {
    expect(errorMessage(new Error(''), 'y')).toBe('y')
    expect(errorMessage(new Error('  '), 'y')).toBe('y')
  })
})
