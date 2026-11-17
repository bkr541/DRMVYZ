import { describe, expect, it } from 'vitest'
import { normalizeSystemSettings } from '../systemSettingsTypes'

describe('normalizeSystemSettings', () => {
  it('keeps valid values and drops unknown keys and invalid values', () => {
    expect(normalizeSystemSettings({ quality: 'Medium', autoQualityEnabled: true, autoQualityMin: 'Ultra', bpmSync: 'yes', extra: 1, autoPerformanceDefault: false }))
      .toEqual({ quality: 'Medium', autoQualityEnabled: true, autoPerformanceDefault: false })
  })
  it('treats null, arrays and non-objects as nothing saved', () => {
    for (const raw of [null, undefined, [], 'x', 3]) expect(normalizeSystemSettings(raw)).toEqual({})
  })
})
