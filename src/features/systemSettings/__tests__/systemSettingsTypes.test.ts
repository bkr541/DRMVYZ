import { describe, expect, it } from 'vitest'
import { normalizeSystemSettings } from '../systemSettingsTypes'

describe('normalizeSystemSettings', () => {
  it('keeps valid values and drops unknown keys and invalid values', () => {
    expect(normalizeSystemSettings({ quality: 'Medium', autoQualityEnabled: true, autoQualityMin: 'Ultra', bpmSync: 'yes', extra: 1, autoPerformanceDefault: false }))
      .toEqual({ quality: 'Medium', autoQualityEnabled: true, autoPerformanceDefault: false })
  })
  it('accepts the Transitions settings, and drops an unknown transition style or a non-boolean switch', () => {
    expect(normalizeSystemSettings({ transitionsEnabled: true, transitionStyle: 'random' })).toEqual({ transitionsEnabled: true, transitionStyle: 'random' })
    for (const style of ['dissolve', 'flash', 'wipe', 'zoom', 'dip']) expect(normalizeSystemSettings({ transitionStyle: style })).toEqual({ transitionStyle: style })
    expect(normalizeSystemSettings({ transitionsEnabled: 'on', transitionStyle: 'spin' })).toEqual({})
    expect(normalizeSystemSettings({ transitionStyle: 'off' })).toEqual({})
  })
  it('treats null, arrays and non-objects as nothing saved', () => {
    for (const raw of [null, undefined, [], 'x', 3]) expect(normalizeSystemSettings(raw)).toEqual({})
  })
})
