import { describe, expect, it } from 'vitest'
import type { ReactPreset, SoundDrawingLayer } from '../components/vyzualz/react/ReactTypes'
import {
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_REACT_PRESETS,
} from '../components/vyzualz/react/ReactTypes'
import {
  migrateReactStore,
  reactStorePartialize,
  resolvePresetOscillatorSettings,
  useReactStore,
} from './reactStore'

function legacyLayer(): SoundDrawingLayer {
  return {
    id: 'layer-1',
    name: 'Legacy text',
    enabled: true,
    sourceType: 'text',
    text: 'UNCHANGED',
    fontId: null,
    letterSpacing: 0,
    lineHeight: 1.2,
    alignment: 'center',
    svgId: null,
    shape: 'circle',
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    oscillatorOverride: {},
  }
}

describe('Sound Drawing lyric source persistence', () => {
  it('migrates older global and layer text to static without changing original text', () => {
    const migrated = migrateReactStore({
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, text: 'GLOBAL', textSource: undefined },
      soundDrawingLayersByTrackId: { 'track-1': [legacyLayer()] },
    }, 26)

    expect((migrated.oscillatorSettings as typeof DEFAULT_OSCILLATOR_SETTINGS)).toMatchObject({
      text: 'GLOBAL',
      textSource: 'static',
      lyricGapBehavior: 'hide',
      lyricFallbackText: '',
    })
    expect((migrated.soundDrawingLayersByTrackId as Record<string, SoundDrawingLayer[]>)['track-1'][0]).toMatchObject({
      text: 'UNCHANGED',
      textSource: 'static',
      lyricGapBehavior: 'hide',
      lyricFallbackText: '',
    })
  })

  it('serializes source settings and fallback text without copying lyric cue content', () => {
    const current = useReactStore.getState()
    const persisted = reactStorePartialize({
      ...current,
      oscillatorSettings: {
        ...current.oscillatorSettings,
        sourceType: 'text',
        textSource: 'activeLyricLine',
        lyricGapBehavior: 'fallback',
        lyricFallbackText: 'INSTRUMENTAL',
      },
      soundDrawingLayersByTrackId: {
        'track-1': [{
          ...legacyLayer(),
          textSource: 'activeLyricWord',
          lyricGapBehavior: 'keepPrevious',
        }],
      },
    })

    expect(persisted.oscillatorSettings).toMatchObject({
      textSource: 'activeLyricLine',
      lyricGapBehavior: 'fallback',
      lyricFallbackText: 'INSTRUMENTAL',
    })
    expect(persisted.soundDrawingLayersByTrackId['track-1'][0]).toMatchObject({
      textSource: 'activeLyricWord',
      lyricGapBehavior: 'keepPrevious',
    })
    expect(JSON.stringify(persisted)).not.toContain('activeCue')
    expect(JSON.stringify(persisted)).not.toContain('lyricCues')
  })

  it('round-trips lyric source settings through oscilloscope presets', () => {
    const base = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'oscilloscope')!
    const preset: ReactPreset = {
      ...base,
      id: 'lyric-preset',
      oscillatorSettings: {
        sourceType: 'text',
        textSource: 'activeLyricWord',
        lyricGapBehavior: 'fallback',
        lyricFallbackText: 'DROP',
      },
    }

    expect(resolvePresetOscillatorSettings(preset, DEFAULT_OSCILLATOR_SETTINGS)).toMatchObject({
      sourceType: 'text',
      textSource: 'activeLyricWord',
      lyricGapBehavior: 'fallback',
      lyricFallbackText: 'DROP',
    })
  })
})
