import { describe, expect, it } from 'vitest'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from './SoundDrawingPerformanceTypes'
import { resolveSoundDrawingOwnership } from './SoundDrawingOwnership'

describe('Sound Drawing manual versus authored ownership', () => {
  it('reports a selected show as not running while Auto Performance is off', () => {
    const state = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'stereoPulseStudy',
      autoPerformance: false,
    })
    expect(state).toMatchObject({
      owner: 'manual',
      showRunning: false,
      professionalScopeOwner: 'manual',
      manualScopeControlsDisabled: false,
    })
    expect(state.status).toContain('selected but not running')
  })

  it('marks manual Pro Scope controls read-only for an authored scope show', () => {
    const state = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'phaseOrbit',
      autoPerformance: true,
    })
    expect(state).toMatchObject({
      owner: 'authored',
      showRunning: true,
      professionalScopeOwner: 'authored',
      manualScopeControlsDisabled: true,
    })
    expect(state.status).toContain('show-controlled layer')
  })

  it('does not claim a manual scope layer for a non-scope authored show', () => {
    const state = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'radialPressureSystem',
      autoPerformance: true,
    })
    expect(state.professionalScopeOwner).toBe('none')
    expect(state.manualScopeControlsDisabled).toBe(true)
    expect(state.status).toContain('manual Pro Scope is not rendered')
  })
})
