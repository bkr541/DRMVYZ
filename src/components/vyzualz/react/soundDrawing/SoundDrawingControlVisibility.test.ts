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
  it('shows controls only for the authored Living Ribbon show', () => {
    expect(shouldShowLivingRibbonControls(settings({ selectedShowId: 'livingRibbonSystem' }))).toBe(true)
  })

  it('ignores retired generator preferences and does not clutter unrelated shows', () => {
    expect(shouldShowLivingRibbonControls(settings({
      selectedShowId: 'radialPressureSystem',
      generatorPreference: 'livingRibbon',
    }))).toBe(false)
    expect(shouldShowLivingRibbonControls(settings({
      selectedShowId: 'harmonicRibbonReactor',
      generatorPreference: 'harmonicRibbon',
    }))).toBe(false)
  })
})
