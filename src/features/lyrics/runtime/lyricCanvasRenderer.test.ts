import { describe, expect, it } from 'vitest'
import type { LyricCue, LyricDocument } from '../../../types/lyrics'
import {
  DEFAULT_LYRIC_CANVAS_ANIMATION,
  DEFAULT_LYRIC_CANVAS_EFFECTS,
  DEFAULT_LYRIC_CANVAS_STYLE,
  resolveLyricCanvasPresentation,
} from './lyricCanvasRenderer'

function documentFixture(): LyricDocument {
  return {
    id: 'doc-preview',
    userId: 'fixture-user',
    audioTrackId: 'track-preview',
    visualSessionId: null,
    title: 'Preview',
    artist: 'DVYDRM',
    sourceType: 'manual',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: { color: '#ffffff', fontSize: 58, y: 0.74 },
    defaultAnimation: { in: 'fadeUp', inMs: 320 },
    defaultEffects: { glow: 0.25, bloom: 0.2 },
    globalOffsetMs: 0,
    isActive: false,
    metadata: {},
    revision: 1,
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
  }
}

describe('resolveLyricCanvasPresentation', () => {
  it('uses production renderer defaults before document presentation defaults', () => {
    const cue: LyricCue = { id: 'cue-default', startMs: 0, endMs: 1_000, text: 'Default' }
    const resolved = resolveLyricCanvasPresentation(documentFixture(), cue)

    expect(resolved.style.fontFamily).toBe(DEFAULT_LYRIC_CANVAS_STYLE.fontFamily)
    expect(resolved.style.fontSize).toBe(58)
    expect(resolved.style.color).toBe('#ffffff')
    expect(resolved.animation.in).toBe('fadeUp')
    expect(resolved.animation.inMs).toBe(320)
    expect(resolved.animation.out).toBe(DEFAULT_LYRIC_CANVAS_ANIMATION.out)
    expect(resolved.effects.glow).toBe(0.25)
    expect(resolved.effects.bloom).toBe(0.2)
    expect(resolved.effects.rgbSplit).toBe(DEFAULT_LYRIC_CANVAS_EFFECTS.rgbSplit)
  })

  it('applies cue presentation overrides after document defaults', () => {
    const cue: LyricCue = {
      id: 'cue-override',
      startMs: 0,
      endMs: 1_000,
      text: 'Override',
      style: { color: '#7EDAE8', fontSize: 72 },
      animation: { in: 'scalePop', intensity: 0.8 },
      effects: { glow: 0.6, rgbSplit: 0.4 },
    }
    const resolved = resolveLyricCanvasPresentation(documentFixture(), cue)

    expect(resolved.style.color).toBe('#7EDAE8')
    expect(resolved.style.fontSize).toBe(72)
    expect(resolved.style.y).toBe(0.74)
    expect(resolved.animation.in).toBe('scalePop')
    expect(resolved.animation.intensity).toBe(0.8)
    expect(resolved.animation.inMs).toBe(320)
    expect(resolved.effects.glow).toBe(0.6)
    expect(resolved.effects.rgbSplit).toBe(0.4)
    expect(resolved.effects.bloom).toBe(0.2)
  })
})
