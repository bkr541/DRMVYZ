import { describe, expect, it } from 'vitest'
import { hasAdminAccess } from './adminAccess'

describe('admin authority', () => {
  it('needs trusted app_metadata, with no development bypass and no other source', () => {
    expect(hasAdminAccess(undefined)).toBe(false)
    expect(hasAdminAccess({})).toBe(false)
    expect(hasAdminAccess({ role: 'authenticated' })).toBe(false)
    expect(hasAdminAccess({ role: 'developer' })).toBe(false)
    expect(hasAdminAccess({ is_developer: true })).toBe(false)
    expect(hasAdminAccess({ is_admin: 'true' })).toBe(false)
    expect(hasAdminAccess({ role: 'admin' })).toBe(true)
    expect(hasAdminAccess({ is_admin: true })).toBe(true)
  })
})
