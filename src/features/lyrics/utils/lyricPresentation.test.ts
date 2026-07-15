import type { LyricStyle } from '../../../types/lyrics'
import { describe, expect, it } from 'vitest'
import {
  anchorPresetPatch,
  animationPresetPatch,
  effectPresetPatch,
  mergeLyricPresentation,
} from './lyricPresentation'

describe('lyric presentation controls', () => {
  it('maps safe presets onto renderer-supported fields', () => {
    expect(animationPresetPatch('fade-up')).toMatchObject({ in: 'fadeUp', out: 'fade' })
    expect(effectPresetPatch('beat-punch')).toMatchObject({ beatPunch: 0.65 })
    expect(anchorPresetPatch('lower-third')).toEqual({ x: 0.5, y: 0.78, align: 'center' })
  })

  it('merges document defaults with cue overrides without dropping unknown supported fields', () => {
    const merged = mergeLyricPresentation<LyricStyle>(
      { color: '#ffffff', fontFamily: 'Inter', shadowBlur: 4 },
      { color: '#00ffaa', opacity: 0.8 },
    )
    expect(merged).toEqual({
      color: '#00ffaa',
      fontFamily: 'Inter',
      shadowBlur: 4,
      opacity: 0.8,
    })
  })
})
