import { describe, expect, it } from 'vitest'
import { shouldShowLivingRibbonControls } from './SoundDrawingControlVisibility'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from './SoundDrawingPerformanceTypes'

function settings(
  patch: Partial<typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS> = {},
): typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS {
  return {
    ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
    ...patch,
    livingRibbon: {
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.livingRibbon,
      ...(patch.livingRibbon ?? {}),
    },
    locks: {
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
      ...(patch.locks ?? {}),
    },
  }
}

describe('Sound Drawing Living Ribbon control visibility', () => {
  it('shows controls for the authored Living Ribbon show or explicit generator preference', () => {
    expect(shouldShowLivingRibbonControls(settings({ selectedShowId: 'livingRibbonSystem' }))).toBe(true)
    expect(shouldShowLivingRibbonControls(settings({ generatorPreference: 'livingRibbon' }))).toBe(true)
  })

  it('does not clutter unrelated Sound Drawing shows', () => {
    expect(shouldShowLivingRibbonControls(settings({
      selectedShowId: 'radialPressureSystem',
      generatorPreference: 'authored',
    }))).toBe(false)
    expect(shouldShowLivingRibbonControls(settings({
      selectedShowId: 'harmonicRibbonReactor',
      generatorPreference: 'harmonicRibbon',
    }))).toBe(false)
  })
})
