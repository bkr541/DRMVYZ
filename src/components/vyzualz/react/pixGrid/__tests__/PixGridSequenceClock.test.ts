import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import type { ReactSectionType, ReactTrackSection } from '../../ReactTypes'
import type { PixGridActionCue } from '../PixGridActionCues'
import { createPixGridAudioFrame } from '../PixGridAudioRouting'
import type { PixGridPreparedFrame, PixGridPreparedFrameSet } from '../PixGridDeckCompilerContracts'
import type {
  PixGridDeckConfiguration,
  PixGridDeckDefinition,
  PixGridDeckItemDefinition,
  PixGridDeckPlaybackOrder,
} from '../PixGridDeckDomain'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridRuntimeControls, PixGridMotionClock } from '../PixGridRuntimeControls'
import { selectPixGridPreviewScene } from '../PixGridScenePreview'
import {
  PIX_GRID_DECK_SECTION_CADENCE_BARS,
  createPixGridPreparedSequenceFrames,
  createPixGridSequenceBoundarySignals,
  resolvePixGridDeckSequencePosition,
  resolvePixGridSequencePlan,
  type PixGridSequenceBoundarySignal,
  type PixGridSequencePlan,
} from '../PixGridSequenceClock'
import { applyPixGridPresetSettings } from '../PixGridState'
import { resolvePixGridSurfacePerformanceFrame } from '../PixGridSurfaceRuntime'
import type { PixGridAudioFrame, PixGridSectionBarSpan } from '../PixGridTypes'
import { PixGridUnifiedPerformanceRuntime } from '../PixGridUnifiedPerformanceRuntime'
import { normalizePixGridState } from '../PixGridValidation'

const ITEM_IDS = ['item-a', 'item-b', 'item-c', 'item-d', 'item-e'] as const
const FRAME_IDS = ITEM_IDS.map(id => `frame:${id}`)
function item(id: string, order: number, timingOverrideBeats: number | null = null): PixGridDeckItemDefinition {
  return {
    id,
    mediaId: `media:${id}`,
    enabled: true,
    order,
    revision: 1,
    timingOverrideBeats,
    source: {
      mediaRevision: 1,
      fingerprint: `legacy:${id}`,
      fileName: `${id}.png`,
      mimeType: 'image/png',
      width: 2,
      height: 2,
      hasAlpha: false,
      transparentBackground: '#000000',
    },
  }
}

function configuration(
  playbackOrder: PixGridDeckPlaybackOrder,
  overrides: Partial<PixGridDeckConfiguration> = {},
): PixGridDeckConfiguration {
  return {
    playbackOrder,
    loop: true,
    reactionProfileId: null,
    transitionPolicy: { style: 'cut', durationBeats: 0 },
    defaultItemDurationBeats: 4,
    sectionTimingBeats: {},
    sectionItemAssignments: {},
    sceneItemAssignments: {},
    preDropBehavior: 'hold',
    ...overrides,
  }
}

function deck(
  playbackOrder: PixGridDeckPlaybackOrder = 'forward',
  overrides: Partial<PixGridDeckConfiguration> = {},
  items: PixGridDeckItemDefinition[] = ITEM_IDS.map((id, index) => item(id, index)),
): PixGridDeckDefinition {
  return {
    schemaVersion: 1,
    id: 'deck-sequence-test',
    name: 'Sequence Test',
    revision: 3,
    generatedPresetId: 'pix-grid-deck:deck-sequence-test',
    items,
    configuration: configuration(playbackOrder, overrides),
  }
}

function planAt(
  targetDeck: PixGridDeckDefinition,
  bar: number,
  options: {
    sectionType?: ReactSectionType
    sectionId?: string
    sectionBarTimeline?: readonly PixGridSectionBarSpan[]
    sceneId?: string | null
    trackIdentity?: string
    timelineRevision?: string
    signals?: readonly PixGridSequenceBoundarySignal[]
    sequenceBar?: number
    motion?: number
    transportMode?: 'live' | 'reconstruct'
  } = {},
): PixGridSequencePlan {
  const result = resolvePixGridSequencePlan({
    deck: targetDeck,
    preparedFrames: targetDeck.items.map((entry, index) => ({ itemId: entry.id, frameId: FRAME_IDS[index]! })),
    timeline: {
      absoluteBar: bar,
      sequenceBar: options.sequenceBar ?? bar,
      sectionType: options.sectionType ?? 'drop',
      sectionId: options.sectionId ?? `${options.sectionType ?? 'drop'}-fixture`,
      sectionBarTimeline: options.sectionBarTimeline,
      sceneId: options.sceneId ?? null,
      trackIdentity: options.trackIdentity ?? 'track-alpha',
      presetId: targetDeck.generatedPresetId,
      timelineRevision: options.timelineRevision ?? 'timeline-1',
    },
    boundarySignals: options.signals,
    motion: options.motion ?? 1,
    transportMode: options.transportMode ?? 'reconstruct',
  })
  expect(result).not.toBeNull()
  return result!
}

function sequence(
  targetDeck: PixGridDeckDefinition,
  bars: readonly number[],
  options: Parameters<typeof planAt>[2] = {},
): string[] {
  return bars.map(bar => planAt(targetDeck, bar, options).activeItemId)
}

function emptyMasks() {
  return {
    foreground: new Uint8Array(1),
    border: new Uint8Array(1),
    highlights: new Uint8Array(1),
    shadows: new Uint8Array(1),
    center: new Uint8Array(1),
    background: new Uint8Array(1),
  }
}

function preparedFrame(entry: PixGridDeckItemDefinition, cacheKey: string): PixGridPreparedFrame {
  return {
    schemaVersion: 1,
    cacheKey,
    mediaId: entry.mediaId,
    sourceFingerprint: entry.source.fingerprint,
    sourceRevision: entry.source.mediaRevision,
    width: 1,
    height: 1,
    pixels: new Uint8Array(4),
    masks: emptyMasks(),
    metrics: {
      cellCount: 1,
      foregroundCellCount: 0,
      backgroundCellCount: 1,
      borderCellCount: 0,
      highlightCellCount: 0,
      shadowCellCount: 0,
      centerCellCount: 0,
      averageLuminance: 0,
      luminanceDeviation: 0,
      averageAlpha: 1,
      bounds: null,
    },
    approximateBytes: 10,
  }
}

function preparedFrameSet(targetDeck: PixGridDeckDefinition): PixGridPreparedFrameSet {
  const frames = targetDeck.items.filter(entry => entry.enabled).map((entry, index) => preparedFrame(entry, FRAME_IDS[index]!))
  return {
    schemaVersion: 1,
    deckId: targetDeck.id,
    deckRevision: targetDeck.revision,
    width: 1,
    height: 1,
    frameCacheKeys: frames.map(frame => frame.cacheKey),
    frames,
  }
}

function intelligence(timeSec: number): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    sourceId: 'deck-sequence-track',
    trackId: 'deck-sequence-track',
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      beatGrid: true,
      sections: true,
    },
  }
}

function contextAt(timeSec: number, type: ReactSectionType = 'verse') {
  const sections: ReactTrackSection[] = [{
    id: `track-${type}`,
    label: type,
    type,
    startSec: 0,
    endSec: 64,
    intensity: 0.6,
    source: 'auto',
    confidence: 1,
  }]
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: intelligence(timeSec),
    resolvedSections: sections,
    durationSec: 64,
    trackIdentity: 'deck-sequence-track',
  })
}

function cue(id: string, timeSec: number, quantization: PixGridActionCue['quantization']): PixGridActionCue {
  return {
    version: 1,
    id,
    timeSec,
    label: id,
    enabled: true,
    engineId: 'pixGrid',
    action: { type: 'freeze', active: true },
    quantization,
    transition: 'cut',
    transitionDurationSec: 0,
    oneShotDurationSec: 0,
    loopBehavior: 'retrigger',
    order: 0,
  }
}

describe('PixGridSequenceClock pure deterministic planning', () => {
  it('centralizes the confirmed section cadence defaults', () => {
    expect(PIX_GRID_DECK_SECTION_CADENCE_BARS).toEqual({
      intro: 8,
      verse: 4,
      build: 2,
      preDrop: null,
      drop: 1,
      breakdown: 8,
      bridge: 4,
      outro: 8,
      unknown: 4,
    })

    for (const [sectionType, cadence] of Object.entries(PIX_GRID_DECK_SECTION_CADENCE_BARS) as Array<[ReactSectionType, number | null]>) {
      const atBoundary = planAt(deck(), cadence ?? 20, { sectionType })
      if (cadence == null) {
        expect(atBoundary).toMatchObject({ activeItemId: ITEM_IDS[0], hold: { active: true, reason: 'preDrop' } })
      } else {
        expect(atBoundary.activeItemId).toBe(ITEM_IDS[1])
      }
    }
  })

  it.each([
    ['forward', ['item-a', 'item-b', 'item-c', 'item-d', 'item-e', 'item-a']],
    ['reverse', ['item-e', 'item-d', 'item-c', 'item-b', 'item-a', 'item-e']],
    ['pingPong', ['item-a', 'item-b', 'item-c', 'item-d', 'item-e', 'item-d']],
  ] as const)('resolves %s order from absolute musical position', (order, expected) => {
    expect(sequence(deck(order), [0, 1, 2, 3, 4, 5])).toEqual(expected)
  })

  it('uses assignment order for section-based playback with forward fallback', () => {
    const assigned = deck('sectionAssigned', {
      sectionItemAssignments: { drop: ['item-c', 'item-a', 'item-e'] },
    })
    expect(sequence(assigned, [0, 1, 2, 3])).toEqual(['item-c', 'item-a', 'item-e', 'item-c'])

    const fallback = deck('sectionAssigned', {
      sectionItemAssignments: { drop: ['missing-item'] },
    })
    expect(sequence(fallback, [0, 1, 2])).toEqual(['item-a', 'item-b', 'item-c'])
  })

  it('keeps shuffle stable across reload and varies it from immutable seed facts', () => {
    const shuffledDeck = deck('shuffle')
    const bars = Array.from({ length: 30 }, (_, index) => index)
    const first = sequence(shuffledDeck, bars, { trackIdentity: 'track-alpha' })
    const reload = sequence(structuredClone(shuffledDeck), bars, { trackIdentity: 'track-alpha' })
    const otherTrack = sequence(shuffledDeck, bars, { trackIdentity: 'track-beta' })

    expect(reload).toEqual(first)
    expect(otherTrack).not.toEqual(first)
    expect(new Set(first).size).toBe(ITEM_IDS.length)
    expect(first.every(id => ITEM_IDS.includes(id as typeof ITEM_IDS[number]))).toBe(true)
  })

  it('loops by default and returns a terminal hold when looping is disabled', () => {
    expect(planAt(deck('forward'), 5)).toMatchObject({ activeItemId: 'item-a', frameEpoch: 5 })
    expect(planAt(deck('forward', { loop: false }), 50)).toMatchObject({
      activeItemId: 'item-e',
      nextItemId: 'item-e',
      frameEpoch: 4,
      hold: { active: true, reason: 'terminal' },
      transitionWindow: { permitted: false },
    })
  })

  it('applies a per-item duration override only to that item and remains seek-safe', () => {
    const items = ITEM_IDS.map((id, index) => item(id, index, index === 0 ? 8 : null))
    const targetDeck = deck('forward', {}, items)
    expect(sequence(targetDeck, [1.99, 2, 5.99, 6], { sectionType: 'verse' })).toEqual(['item-a', 'item-b', 'item-b', 'item-c'])
    expect(planAt(targetDeck, 6, { sectionType: 'verse' })).toEqual(
      planAt(structuredClone(targetDeck), 6, { sectionType: 'verse' }),
    )
  })

  it('restricts and reorders eligible images for scene ownership without mutating Deck order', () => {
    const targetDeck = deck('forward', {
      sceneItemAssignments: { 'scene-drop': ['item-d', 'item-b', 'missing-item'] },
    })
    const originalOrder = targetDeck.items.map(entry => entry.id)
    expect(sequence(targetDeck, [0, 1, 2], { sceneId: 'scene-drop' })).toEqual(['item-d', 'item-b', 'item-d'])
    expect(targetDeck.items.map(entry => entry.id)).toEqual(originalOrder)
    expect(planAt(targetDeck, 0, { sceneId: 'empty-scene' }).eligibleItemIds).toEqual(ITEM_IDS)
  })

  it.each([
    ['hold', 'none', 'item-a'],
    ['dim', 'dim', 'item-a'],
    ['disperse', 'disperse', 'item-a'],
    ['previewNext', 'previewNext', 'item-b'],
  ] as const)('publishes the %s PreDrop policy without advancing identity', (behavior, effect, targetItemId) => {
    const result = planAt(deck('forward', { preDropBehavior: behavior }), 12, { sectionType: 'preDrop' })
    expect(result).toMatchObject({
      activeItemId: 'item-a',
      targetItemId,
      effect,
      hold: { active: true, reason: 'preDrop', behavior },
      transitionWindow: { permitted: false },
    })
  })

  it('continues the inherited musical cadence for the PreDrop continue policy', () => {
    const timeline: readonly PixGridSectionBarSpan[] = [
      { id: 'verse', type: 'verse', startBar: 0, endBar: 4 },
      { id: 'pre-drop', type: 'preDrop', startBar: 4, endBar: 12 },
    ]
    const signals: readonly PixGridSequenceBoundarySignal[] = [{
      id: 'section:pre-drop', bar: 4, kind: 'section', behavior: 'arm', quantization: 'section',
    }]
    const continuing = deck('forward', { preDropBehavior: 'continue' })
    expect(planAt(continuing, 4, { sectionBarTimeline: timeline, signals }).activeItemId).toBe('item-a')
    expect(planAt(continuing, 4.01, { sectionBarTimeline: timeline, signals }).activeItemId).toBe('item-b')
    expect(planAt(continuing, 8.01, { sectionBarTimeline: timeline, signals }).activeItemId).toBe('item-c')
  })

  it('groups coincident quantized boundary signals and advances at most one image', () => {
    const signals: readonly PixGridSequenceBoundarySignal[] = [
      { id: 'phrase-1', bar: 0.6, kind: 'phrase', behavior: 'force', quantization: 'bar' },
      { id: 'cue-1', bar: 1.12, kind: 'trackMap', behavior: 'force', quantization: 'bar' },
    ]
    const result = planAt(deck(), 1.2, { sectionType: 'intro', signals })
    expect(result).toMatchObject({
      activeItemId: 'item-b',
      frameEpoch: 1,
      boundaryIdentity: 'phrase-1+cue-1',
      transitionWindow: { startBar: 1, quantization: 'bar' },
    })
  })

  it('represents armed boundaries without mutating a frame counter', () => {
    const result = planAt(deck(), 2, {
      sectionType: 'intro',
      signals: [{ id: 'armed-cue', bar: 1, kind: 'trackMap', behavior: 'arm', quantization: 'bar' }],
    })
    expect(result).toMatchObject({ activeItemId: 'item-a', frameEpoch: 0, transitionArmedBy: 'armed-cue' })
  })

  it('publishes deterministic source/target and transition progress around a quantized boundary', () => {
    const targetDeck = deck('forward', { transitionPolicy: { style: 'crossfade', durationBeats: 2 } })
    const result = planAt(targetDeck, 1.25, {
      sectionType: 'intro',
      signals: [{ id: 'bar-cutover', bar: 1, kind: 'trackMap', behavior: 'force', quantization: 'bar' }],
    })
    expect(result).toMatchObject({
      sourceItemId: 'item-a',
      targetItemId: 'item-b',
      activeItemId: 'item-b',
      transitionWindow: {
        active: true,
        permitted: true,
        startBar: 1,
        endBar: 1.5,
        progress: 0.5,
        boundaryIdentity: 'bar-cutover',
      },
    })
  })

  it('does not double-advance when a forced boundary and eligible-set change coincide', () => {
    const targetDeck = deck('sectionAssigned', {
      sectionItemAssignments: { verse: ['item-a', 'item-b', 'item-c'], drop: ['item-c', 'item-a'] },
    })
    const timeline: readonly PixGridSectionBarSpan[] = [
      { id: 'verse', type: 'verse', startBar: 0, endBar: 4 },
      { id: 'drop', type: 'drop', startBar: 4, endBar: 8 },
    ]
    const result = planAt(targetDeck, 4, {
      sectionBarTimeline: timeline,
      signals: [{ id: 'section:drop', bar: 4, kind: 'section', behavior: 'force', quantization: 'section' }],
    })
    expect(result.frameEpoch).toBeLessThanOrEqual(1)
    expect(result.eligibleItemIds).toEqual(['item-c', 'item-a'])
    expect(result.activeItemId).toBe('item-c')
  })

  it('reconstructs direct seeks identically to uninterrupted sampling and remains FPS independent', () => {
    const targetDeck = deck('shuffle', { transitionPolicy: { style: 'crossfade', durationBeats: 1 } })
    const sampleBars = Array.from({ length: 121 }, (_, index) => index / 12)
    const uninterrupted = sampleBars.map(bar => planAt(targetDeck, bar))
    const seeks = sampleBars.map(bar => planAt(structuredClone(targetDeck), bar))
    expect(seeks).toEqual(uninterrupted)

    for (let seed = 0; seed < 20; seed += 1) {
      const trackIdentity = `property-track-${seed}`
      for (let step = 0; step < 80; step += 1) {
        const bar = (seed * 17 + step * 13) / 7
        expect(planAt(targetDeck, bar, { trackIdentity })).toEqual(planAt(targetDeck, bar, { trackIdentity }))
      }
    }
  })

  it('uses authoritative current section policy while sequence time is Motion-scaled', () => {
    const result = planAt(deck(), 21, {
      sequenceBar: 12,
      sectionBarTimeline: [
        { id: 'verse', type: 'verse', startBar: 0, endBar: 20 },
        { id: 'pre-drop', type: 'preDrop', startBar: 20, endBar: 22 },
      ],
      motion: 0.5,
      transportMode: 'live',
    })
    expect(result).toMatchObject({
      absoluteBar: 21,
      sequenceBar: 12,
      hold: { active: true, reason: 'preDrop', behavior: 'hold' },
    })
  })

  it('freezes live progression at Motion zero while reconstruction still uses authoritative position', () => {
    const live = planAt(deck(), 12, {
      sequenceBar: 3,
      motion: 0,
      transportMode: 'live',
    })
    expect(live).toMatchObject({
      absoluteBar: 12,
      sequenceBar: 3,
      activeItemId: 'item-d',
      hold: { active: true, reason: 'motionZero' },
      transitionWindow: { permitted: false },
    })
    const reconstructed = planAt(deck(), 12, {
      sequenceBar: 12,
      motion: 0,
      transportMode: 'reconstruct',
    })
    expect(reconstructed.activeItemId).toBe('item-c')
    expect(reconstructed.hold.reason).not.toBe('motionZero')
  })

  it('falls back sanely for a missing Track Map, unknown section, and one enabled prepared image', () => {
    const singlePrepared = resolvePixGridSequencePlan({
      deck: deck(),
      preparedFrames: [{ itemId: 'item-c', frameId: 'frame:item-c' }],
      timeline: { absoluteBar: 999, sectionType: 'unknown', trackIdentity: null },
    })
    expect(singlePrepared).toMatchObject({
      activeItemId: 'item-c',
      nextItemId: 'item-c',
      hold: { active: true, reason: 'singleFrame' },
    })
  })
})

describe('PixGridSequenceClock production adapters', () => {
  it('maps prepared compiler frames to stable Deck item identities and rejects stale sets', () => {
    const targetDeck = deck()
    const frameSet = preparedFrameSet(targetDeck)
    expect(createPixGridPreparedSequenceFrames(targetDeck, frameSet)).toEqual(
      targetDeck.items.map((entry, index) => ({ itemId: entry.id, frameId: FRAME_IDS[index] })),
    )
    expect(createPixGridPreparedSequenceFrames({ ...targetDeck, revision: targetDeck.revision + 1 }, frameSet)).toEqual([])
  })

  it('derives section, phrase, and Track Map boundary facts without encoding an image choice', () => {
    const context = contextAt(12, 'verse')
    const signals = createPixGridSequenceBoundarySignals(context, [cue('cue-at-bar-2', 4.1, 'bar')])
    expect(signals.some(signal => signal.kind === 'section')).toBe(false)
    expect(signals.some(signal => signal.kind === 'phrase')).toBe(true)
    expect(signals.some(signal => signal.id === 'track-map:cue-at-bar-2')).toBe(true)
    expect(signals.every(signal => !('itemId' in signal) && !('frameId' in signal))).toBe(true)
  })

  it('uses the existing Motion clock for live speed scaling and authoritative seek reconstruction', () => {
    const context = contextAt(12, 'drop')
    const raw = createPixGridAudioFrame(context, { isPlaying: true, deltaTimeSec: 1 / 60 })
    const clock = new PixGridMotionClock()
    const halfSpeed = clock.apply(applyPixGridRuntimeControls(raw, { bassReactivity: 1, motion: 0.5 }))
    expect(resolvePixGridDeckSequencePosition(halfSpeed, context)).toMatchObject({
      absoluteBar: context.absoluteBar,
      sequenceBar: context.absoluteBar * 0.5,
      transportMode: 'live',
    })

    const paused: PixGridAudioFrame = { ...halfSpeed, isPlaying: false, transportState: 'paused' }
    expect(resolvePixGridDeckSequencePosition(paused, context)).toMatchObject({
      sequenceBar: halfSpeed.motionClockBar,
      transportMode: 'live',
    })

    const seek: PixGridAudioFrame = { ...halfSpeed, timingDiscontinuity: true }
    expect(resolvePixGridDeckSequencePosition(seek, context)).toEqual({
      absoluteBar: context.absoluteBar,
      sequenceBar: context.absoluteBar,
      transportMode: 'reconstruct',
    })
  })

  it('enters through the real PixGrid surface runtime seam and keeps Selected Scene ownership separate', () => {
    const presetId = 'pix-grid-neon-marquee-cycle'
    const preset = PIX_GRID_PRESET_BY_ID.get(presetId)!
    const applied = applyPixGridPresetSettings(createDefaultPixGridState(), presetId, preset.pixGridSettings)
    const selectedSceneId = `${presetId}-drop`
    const authoredState = selectPixGridPreviewScene(normalizePixGridState(applied), selectedSceneId)
    const targetDeck = {
      ...deck('forward', {
        sceneItemAssignments: { [selectedSceneId]: ['item-d', 'item-b'] },
      }),
      generatedPresetId: presetId,
    }
    const context = contextAt(12, 'verse')
    const audioFrame = createPixGridAudioFrame(context, {
      isPlaying: true,
      deltaTimeSec: 1 / 60,
      autoPerformanceEnabled: true,
    })
    const frame = resolvePixGridSurfacePerformanceFrame({
      authoredState,
      trackSceneId: `${presetId}-verse`,
      context,
      audioFrame,
      presetId,
      cues: [cue('track-map-cue', 4, 'bar')],
      runtime: new PixGridUnifiedPerformanceRuntime(),
      trackId: 'deck-sequence-track',
      deck: targetDeck,
      preparedFrameSet: preparedFrameSet(targetDeck),
    })

    expect(frame.sceneOwnership).toBe('editingContext')
    expect(frame.deckSequencePlan).toMatchObject({
      activeItemId: 'item-d',
      eligibleItemIds: ['item-d', 'item-b'],
      transitionArmedBy: null,
    })
    expect(frame.deckSequencePlan?.boundaryIdentity).not.toBe('track-map:track-map-cue')
    expect(frame.resolvedRuntime.state.selectedSceneId).toBe(selectedSceneId)
  })

  it('preserves the existing Marquee Sign Clock contract beside Deck planning', () => {
    const context = contextAt(16, 'verse')
    const frame = createPixGridAudioFrame(context, { isPlaying: true, deltaTimeSec: 1 / 60 })
    const before = { signClock: frame.signClock, motionClockSign: frame.motionClockSign }
    resolvePixGridSequencePlan({
      deck: deck(),
      preparedFrames: ITEM_IDS.map((id, index) => ({ itemId: id, frameId: FRAME_IDS[index]! })),
      timeline: { absoluteBar: context.absoluteBar, sectionType: 'verse' },
    })
    expect({ signClock: frame.signClock, motionClockSign: frame.motionClockSign }).toEqual(before)
  })
})
