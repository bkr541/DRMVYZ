import { beforeEach, describe, expect, it, vi } from 'vitest'

const { textToGlyphPoints } = vi.hoisted(() => ({
  textToGlyphPoints: vi.fn((_text: string, resolution: number) => (
    Array.from({ length: resolution }, (_, index) => ({
      x: index / Math.max(1, resolution - 1),
      y: 0,
      nx: 0,
      ny: 1,
    }))
  )),
}))

vi.mock('../textGlyphUtils', () => ({ textToGlyphPoints }))

import { DEFAULT_OSCILLATOR_SETTINGS } from '../../ReactTypes'
import { EMPTY_LYRIC_PLAYBACK_STATE } from '../../../../../features/lyrics/runtime/lyricPlaybackResolver'
import { DEFAULT_REACT_RENDER_PARAMS } from '../reactRenderUtils'
import {
  clearSoundDrawingRuntimeCaches,
  getSoundDrawingPathPointsForTest,
  getSoundDrawingRuntimeCacheStats,
  setSoundDrawingClipsForFrame,
} from '../SoundDrawingRenderer'

describe('Sound Drawing lyric text geometry cache', () => {
  beforeEach(() => {
    textToGlyphPoints.mockClear()
    clearSoundDrawingRuntimeCaches()
  })

  it('regenerates only for text/path-generation inputs, not audio-time or motion controls', () => {
    const first = {
      ...DEFAULT_REACT_RENDER_PARAMS,
      motion: 0.1,
      oscillator: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'text' as const,
        text: 'FIRST LINE',
        pathResolution: 64,
      },
    }

    getSoundDrawingPathPointsForTest(first)
    getSoundDrawingPathPointsForTest({ ...first, motion: 0.9, intensity: 0.2 })
    expect(textToGlyphPoints).toHaveBeenCalledTimes(1)

    getSoundDrawingPathPointsForTest({
      ...first,
      oscillator: { ...first.oscillator, text: 'NEXT LINE' },
    })
    expect(textToGlyphPoints).toHaveBeenCalledTimes(2)

    getSoundDrawingPathPointsForTest({
      ...first,
      oscillator: { ...first.oscillator, textLetterSpacing: 12 },
    })
    expect(textToGlyphPoints).toHaveBeenCalledTimes(3)
  })

  it('schedules a trail reset whenever the lyric track or document identity changes', () => {
    const initialRevision = getSoundDrawingRuntimeCacheStats().trailResetRevision
    setSoundDrawingClipsForFrame([], [], {
      ...EMPTY_LYRIC_PLAYBACK_STATE,
      sourceIdentity: 'track-a:document-a',
      documentId: 'document-a',
      timelineRevision: 1,
    }, 'track-a')
    const firstRevision = getSoundDrawingRuntimeCacheStats().trailResetRevision

    setSoundDrawingClipsForFrame([], [], {
      ...EMPTY_LYRIC_PLAYBACK_STATE,
      sourceIdentity: 'track-b:document-b',
      documentId: 'document-b',
      timelineRevision: 1,
    }, 'track-b')

    expect(firstRevision).toBeGreaterThan(initialRevision)
    expect(getSoundDrawingRuntimeCacheStats().trailResetRevision).toBeGreaterThan(firstRevision)
  })

  it('releases replaced text geometry and runtime state on cleanup', () => {
    getSoundDrawingPathPointsForTest({
      ...DEFAULT_REACT_RENDER_PARAMS,
      oscillator: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'text',
        text: 'DISPOSE ME',
        pathResolution: 64,
      },
    })
    expect(getSoundDrawingRuntimeCacheStats().canvasTextEntries).toBeGreaterThan(0)

    clearSoundDrawingRuntimeCaches()
    expect(getSoundDrawingRuntimeCacheStats()).toMatchObject({
      canvasTextEntries: 0,
      openTypeTextEntries: 0,
      previousLyricEntries: 0,
    })
  })
})
