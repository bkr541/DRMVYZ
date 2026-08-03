import { describe, expect, it } from 'vitest'
import type { PixGridSurfaceRuntimeFrame } from '../PixGridSurface'
import { PixGridMotionClock } from '../PixGridRuntimeControls'
import { createPixGridSelection, pixGridRectanglePoints } from '../PixGridAuthoring'
import type { PixGridAudioFrame } from '../PixGridTypes'

const RETIRED_RUNTIME_FIELD_NAMES = [
  'signClock',
  'signTransitionClock',
  'signTransitionRate',
  'signTransitionSourceFrame',
  'signTransitionTargetFrame',
  'suppressFrameTransitions',
  'restoringFromTransparency',
  'restorationElapsedBar',
  'motionClockSign',
  'motionClockSignTransition',
  'motionClockSignTransitionSourceFrame',
  'motionClockSignTransitionTargetFrame',
  'motionClockSignSourceFrame',
  'motionClockSignTargetFrame',
  'lastSignClock',
  'motionSign',
  'motionSignFrameIndex',
  'motionSignTransitionRate',
  'preserveSignOnNextAnchor',
  'suppressFrameTransitionsUntilSignAdvance',
] as const

const RETIRED_OBSERVATION_FIELD_NAMES = [
  'signFrameIndex',
  'previousSignFrameIndex',
  'signTransitionType',
  'signTransitionProgress',
  'authoredBulbStates',
] as const

function audioFrame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return {
    audioTime: 8,
    bass: 0.4,
    mid: 0.3,
    high: 0.2,
    volume: 0.5,
    beatHit: false,
    beatPhase: 0,
    isPlaying: true,
    beatIndex: 16,
    barIndex: 4,
    absoluteBar: 4,
    sectionType: 'verse',
    sectionProgress: 0.5,
    phraseIndex: 2,
    phraseProgress: 0.25,
    beatsSinceSectionStart: 8,
    barsSinceSectionStart: 2,
    motionMultiplier: 1,
    trackIdentity: 'stage-3-test-track',
    transportState: 'playing',
    ...overrides,
  }
}

describe('PixGrid Marquee runtime removal Stage 3', () => {
  it('deletes the dedicated sign-clock and semantic-target modules', () => {
    const sourceModules = {
      ...import.meta.glob('../PixGrid*.ts', { eager: true, import: 'default', query: '?raw' }),
      ...import.meta.glob('../PixGrid*.tsx', { eager: true, import: 'default', query: '?raw' }),
    } as Record<string, string>

    expect(Object.keys(sourceModules).some(path => path.endsWith('/PixGridSignClock.ts'))).toBe(false)
    expect(Object.keys(sourceModules).some(path => path.endsWith('/PixGridSemanticTarget.ts'))).toBe(false)
    expect(Object.keys(sourceModules).some(path => path.endsWith('/PixGridSemanticTargetOverlay.tsx'))).toBe(false)
    for (const source of Object.values(sourceModules)) {
      expect(source).not.toMatch(/from ['"].*PixGridSignClock['"]/u)
      expect(source).not.toMatch(/from ['"].*PixGridSemanticTarget(?:Overlay)?['"]/u)
    }

    const productionSource = Object.values(sourceModules).join('\n')
    for (const field of [...RETIRED_RUNTIME_FIELD_NAMES, ...RETIRED_OBSERVATION_FIELD_NAMES]) {
      expect(productionSource).not.toContain(field)
    }
    expect(productionSource).not.toMatch(/clock\?:[^\n]*['"]sign['"]/u)
  })

  it('removes sign-only fields from the neutral audio-frame contract', () => {
    const frame = audioFrame()
    for (const field of RETIRED_RUNTIME_FIELD_NAMES) expect(frame).not.toHaveProperty(field)
  })

  it('keeps the generic runtime-frame observation hook while removing sign telemetry', () => {
    const surfaceSource = import.meta.glob('../PixGridSurface.tsx', {
      eager: true,
      import: 'default',
      query: '?raw',
    }) as Record<string, string>
    const source = Object.values(surfaceSource).join('\n')

    expect(source).toContain('onRuntimeFrame?: (frame: PixGridSurfaceRuntimeFrame) => void')
    expect(source).toContain('const listener = propsRef.current.onRuntimeFrame')
    expect(source).toContain('listener({')
    for (const field of RETIRED_OBSERVATION_FIELD_NAMES) expect(source).not.toContain(field)
  })

  it('keeps the generic time, beat, bar, phrase, and section motion clocks deterministic', () => {
    const firstClock = new PixGridMotionClock()
    const first = firstClock.apply(audioFrame())
    const repeated = new PixGridMotionClock().apply(audioFrame({ timingDiscontinuity: true }))

    expect(first.motionClockTime).toBe(8)
    expect(first.motionClockBeat).toBe(16)
    expect(first.motionClockBar).toBe(4)
    expect(first.motionClockSectionBeat).toBe(8)
    expect(first.motionClockSectionBar).toBe(2)
    expect(first.motionClockSectionProgress).toBe(0.5)
    expect(first.phraseIndex).toBe(2)
    expect(first.phraseProgress).toBe(0.25)
    expect(repeated).toMatchObject({
      motionClockTime: first.motionClockTime,
      motionClockBeat: first.motionClockBeat,
      motionClockBar: first.motionClockBar,
      motionClockSectionBeat: first.motionClockSectionBeat,
      motionClockSectionBar: first.motionClockSectionBar,
      motionClockSectionProgress: first.motionClockSectionProgress,
    })
  })

  it('preserves the neutral runtime observation contract and Deck diagnostics', () => {
    const observation: PixGridSurfaceRuntimeFrame = {
      rendererPath: 'canvas2d-fallback',
      logicalWidth: 160,
      logicalHeight: 90,
      sceneId: 'pix-grid-bass-beacon-verse',
      audioTimeSec: 8,
      sectionType: 'verse',
      autoPerformanceEnabled: true,
      authoredAnimationPhase: 4,
      deckSequenceFrameId: 'frame:item-a',
      deckSequenceNextFrameId: 'frame:item-b',
      deckSequenceEpoch: 3,
      deckSequenceBoundaryIdentity: 'bar:4',
      deckRuntimeStatus: 'ready',
      deckRuntimeDiagnostic: null,
      deckTransitionMode: 'crossfade',
      deckTransitionProgress: 0.5,
      deckFrameSourceIdentity: 'deck:frame:item-a:item-b',
      deckGeneratedGroupIds: ['deck:test:foreground'],
      visibleComponentIds: ['bass-word'],
      activeCellCount: 128,
      pixelHash: '1234abcd',
    }

    expect(observation.deckSequenceFrameId).toBe('frame:item-a')
    expect(observation.rendererPath).toBe('canvas2d-fallback')
    for (const field of ['signFrameIndex', 'previousSignFrameIndex', 'signTransitionType', 'signTransitionProgress', 'authoredBulbStates']) {
      expect(observation).not.toHaveProperty(field)
    }
  })

  it('keeps the rectangular Marquee editor selection tool behavior', () => {
    const selection = createPixGridSelection({ x: 5, y: 7 }, { x: 2, y: 3 })
    const points = pixGridRectanglePoints({ x: 2, y: 3 }, { x: 5, y: 7 })

    expect(selection).toEqual({ x: 2, y: 3, width: 4, height: 5 })
    expect(points).toContainEqual({ x: 2, y: 3 })
    expect(points).toContainEqual({ x: 5, y: 7 })
  })
})
