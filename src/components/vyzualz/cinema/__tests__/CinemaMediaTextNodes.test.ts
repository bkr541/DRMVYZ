import { describe, expect, it } from 'vitest'
import {
  CINEMA_IMAGE_NODE_DEFINITION,
  CINEMA_LYRIC_NODE_DEFINITION,
  CINEMA_MEDIA_TEXT_PERSISTED_DEFINITIONS,
  CINEMA_MODULATION_SOURCE_IDS,
  CINEMA_STAGE15_REFERENCE_COMPOSITION,
  CINEMA_STAGE15_REFERENCE_COMPOSITION_ID,
  CINEMA_TEXT_NODE_DEFINITION,
  CINEMA_VIDEO_NODE_DEFINITION,
  compileCinemaCompositionGraph,
  createCinemaDefinitionRegistryFromPersisted,
  createCinemaFoundationPersistedState,
  createCinemaStore,
  resolveCinemaLyricDisplay,
  resolveCinemaModulationSourceSample,
  validateCinemaParameterSchemas,
  type CinemaFrameContext,
  type CinemaLyricFrame,
} from '../index'

function lyrics(overrides: Partial<CinemaLyricFrame> = {}): CinemaLyricFrame {
  return {
    available: true,
    sourceIdentity: 'lyrics:stage-15',
    lineId: 'line-1',
    lineText: 'We are still becoming',
    wordId: 'word-2',
    wordText: 'still',
    lineProgress: 0.4,
    wordProgress: 0.6,
    lineStarted: true,
    lineEnded: false,
    wordChanged: true,
    lineActive: true,
    lineAbsent: false,
    density: 0.75,
    lineDurationSec: 4,
    vocalsActive: true,
    ...overrides,
  }
}

describe('Cinema Stage 15 media, text, lyrics, and mask nodes', () => {
  it('registers seven production definitions and compiles the built-in reference through the canonical store path', () => {
    const state = createCinemaFoundationPersistedState()
    expect(CINEMA_MEDIA_TEXT_PERSISTED_DEFINITIONS).toHaveLength(7)
    expect(state.compositions.some(composition => composition.id === CINEMA_STAGE15_REFERENCE_COMPOSITION_ID)).toBe(true)

    for (const definition of CINEMA_MEDIA_TEXT_PERSISTED_DEFINITIONS) {
      expect(validateCinemaParameterSchemas(definition.definition.parameters)).toEqual([])
    }

    const registry = createCinemaDefinitionRegistryFromPersisted(state.definitions)
    const compiled = compileCinemaCompositionGraph(CINEMA_STAGE15_REFERENCE_COMPOSITION, registry.registry)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.plan.nodeOrder).toEqual([
      CINEMA_STAGE15_REFERENCE_COMPOSITION.nodes[0].id,
      CINEMA_STAGE15_REFERENCE_COMPOSITION.outputNodeId,
    ])

    const store = createCinemaStore()
    expect(store.getState().setActiveCinemaComposition(CINEMA_STAGE15_REFERENCE_COMPOSITION_ID).ok).toBe(true)
    expect(store.getState().activeCompositionId).toBe(CINEMA_STAGE15_REFERENCE_COMPOSITION_ID)
  })

  it('declares premultiplied media output and separate mask-compatible text attachments', () => {
    expect(CINEMA_IMAGE_NODE_DEFINITION.output.alphaMode).toBe('premultiplied')
    expect(CINEMA_VIDEO_NODE_DEFINITION.output.alphaMode).toBe('premultiplied')
    expect(CINEMA_TEXT_NODE_DEFINITION.output.hasMask).toBe(true)
    expect(CINEMA_LYRIC_NODE_DEFINITION.output.hasMask).toBe(true)
    expect(CINEMA_TEXT_NODE_DEFINITION.outputPorts.find(port => port.dataType === 'mask-texture')).toBeDefined()
  })

  it('resolves current line and word with explicit hide, hold, and static fallbacks', () => {
    const active = resolveCinemaLyricDisplay({
      lyrics: lyrics(),
      gapBehavior: 'hide',
      staticFallback: '',
      previousText: '',
      previousWord: null,
    })
    expect(active).toMatchObject({ text: 'We are still becoming', highlightWord: 'still' })

    const gap = lyrics({ lineId: null, lineText: null, wordId: null, wordText: null, lineActive: false, lineAbsent: true })
    expect(resolveCinemaLyricDisplay({
      lyrics: gap,
      gapBehavior: 'hold-previous',
      staticFallback: '',
      previousText: active.nextPreviousText,
      previousWord: active.nextPreviousWord,
    })).toMatchObject({ text: 'We are still becoming', highlightWord: 'still' })
    expect(resolveCinemaLyricDisplay({
      lyrics: gap,
      gapBehavior: 'static-fallback',
      staticFallback: 'NO LYRICS',
      previousText: active.nextPreviousText,
      previousWord: active.nextPreviousWord,
    })).toMatchObject({ text: 'NO LYRICS', highlightWord: null })
    expect(resolveCinemaLyricDisplay({
      lyrics: gap,
      gapBehavior: 'hide',
      staticFallback: 'ignored',
      previousText: active.nextPreviousText,
      previousWord: active.nextPreviousWord,
    }).text).toBe('')
  })

  it('exposes lyric density, duration, cue-end, word-change, and active/absent sources', () => {
    const frame = {
      lyrics: lyrics({ lineEnded: true }),
      capabilities: { lyrics: true },
    } as unknown as CinemaFrameContext
    expect(resolveCinemaModulationSourceSample(CINEMA_MODULATION_SOURCE_IDS.lyricDensity, frame)?.value).toBe(0.75)
    expect(resolveCinemaModulationSourceSample(CINEMA_MODULATION_SOURCE_IDS.lyricLineDuration, frame)?.value).toBe(0.4)
    expect(resolveCinemaModulationSourceSample(CINEMA_MODULATION_SOURCE_IDS.impulseLyricCueEnded, frame)?.active).toBe(true)
    expect(resolveCinemaModulationSourceSample(CINEMA_MODULATION_SOURCE_IDS.impulseLyricWordChanged, frame)?.active).toBe(true)
    expect(resolveCinemaModulationSourceSample(CINEMA_MODULATION_SOURCE_IDS.stateLyricLineActive, frame)?.active).toBe(true)
  })
})
