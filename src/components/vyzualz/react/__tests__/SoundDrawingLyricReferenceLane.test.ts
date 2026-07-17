import { describe, expect, it } from 'vitest'
import { shouldShowSoundDrawingLyricReferenceLane } from '../SoundDrawingTimelineLane'

describe('Sound Drawing Track Map lyric reference visibility', () => {
  it('mounts the lane only when the loaded track owns at least one lyric cue', () => {
    expect(shouldShowSoundDrawingLyricReferenceLane(false, 0)).toBe(false)
    expect(shouldShowSoundDrawingLyricReferenceLane(false, 12)).toBe(false)
    expect(shouldShowSoundDrawingLyricReferenceLane(true, 0)).toBe(false)
    expect(shouldShowSoundDrawingLyricReferenceLane(true, 1)).toBe(true)
  })
})
