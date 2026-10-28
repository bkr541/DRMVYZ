import { describe, expect, it } from 'vitest'
import { hasDeveloperAccess } from './developerAccess'

describe('developer authority', () => {
  it('enables local development and requires trusted developer metadata in production', () => {
    expect(hasDeveloperAccess(undefined, true)).toBe(true)
    expect(hasDeveloperAccess(undefined, false)).toBe(false)
    expect(hasDeveloperAccess({ role: 'authenticated' }, false)).toBe(false)
    expect(hasDeveloperAccess({ role: 'admin' }, false)).toBe(false)
    expect(hasDeveloperAccess({ is_developer: 'true' }, false)).toBe(false)
    expect(hasDeveloperAccess({ role: 'developer' }, false)).toBe(true)
    expect(hasDeveloperAccess({ is_developer: true }, false)).toBe(true)
  })
})
