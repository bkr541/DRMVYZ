import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridRuntimeControls, PixGridMotionClock } from '../PixGridRuntimeControls'
import {
  applyPixGridSelectedScenePreviewFrame,
  PixGridSelectedScenePreviewClock,
  resolvePixGridPreviewPerformanceContext,
  resolvePixGridSelectedScenePreviewLoopBars,
} from '../PixGridScenePreview'
import {
  applyPixGridPresetSignClock,
  PIX_GRID_NEON_MARQUEE_SIGN_CADENCE,
} from '../PixGridSignClock'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridAudioFrame, PixGridState } from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
const structure = preset.pixGridSettings!.layers!.find(layer => layer.id === 'marquee-structure')!

function selectedState(scene: 'intro' | 'verse' | 'build' | 'drop' | 'breakdown' | 'outro'): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset.pixGridSettings)
  return normalizePixGridState({
    ...applied,
    selectedSceneId: `${PRESET_ID}-${scene}`,
    editor: { ...applied.editor, scenePreviewMode: 'selectedScene' },
    performance: { ...applied.performance, enabled: false },
    audioAssignments: [],
    groups: applied.groups.map(group => ({ ...group, reactions: [] })),
  })
}

function followTrackState(): PixGridState {
  const state = selectedState('verse')
  return normalizePixGridState({
    ...state,
    editor: { ...state.editor, scenePreviewMode: 'followTrack' },
  })
}

function rawFrameAt(
  absoluteBar: number,
  overrides: Partial<PixGridAudioFrame> = {},
): PixGridAudioFrame {
  const barIndex = Math.floor(absoluteBar)
  const barProgress = absoluteBar - barIndex
  return {
    audioTime: absoluteBar * 2,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: barProgress * 4 % 1,
    isPlaying: true,
    beatIndex: Math.floor(absoluteBar * 4),
    barIndex,
    barProgress,
    absoluteBar,
    barsSinceSectionStart: absoluteBar,
    beatsSinceSectionStart: absoluteBar * 4,
    sectionType: 'verse',
    sectionProgress: 0,
    sectionOccurrence: 0,
    transportState: 'playing',
    trackIdentity: 'selected-scene-preview-track',
    motionMultiplier: 1,
    ...overrides,
  }
}

function resolvedPreviewFrames(
  scene: 'intro' | 'verse' | 'build' | 'drop' | 'breakdown' | 'outro',
  elapsedBars: readonly number[],
  motion = 1,
): PixGridAudioFrame[] {
  const state = selectedState(scene)
  const previewClock = new PixGridSelectedScenePreviewClock()
  const motionClock = new PixGridMotionClock()
  const anchorBar = 100
  return elapsedBars.map((elapsedBar, index) => {
    const controlled = applyPixGridRuntimeControls(rawFrameAt(anchorBar + elapsedBar, {
      timingDiscontinuity: index === 0,
    }), { bassReactivity: 1, motion })
    const projected = previewClock.apply(controlled, state)
    return motionClock.apply(applyPixGridPresetSignClock(projected, PRESET_ID))
  })
}

function hash(pixels: Uint8Array): string {
  let value = 0x811c9dc5
  for (const byte of pixels) {
    value ^= byte
    value = Math.imul(value, 0x01000193)
  }
  return (value >>> 0).toString(16)
}

function activeCellCount(pixels: Uint8Array): number {
  let count = 0
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] > 0) count += 1
  }
  return count
}

function contextAt(timeSec = 0) {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const frame: MusicIntelligenceFrame = {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    sourceId: 'selected-scene-preview-track',
    trackId: 'selected-scene-preview-track',
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
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame,
    trackIdentity: 'selected-scene-preview-track',
    resolvedSections: [{
      id: 'track-verse',
      label: 'Verse',
      type: 'verse',
      startSec: 0,
      endSec: 256,
      intensity: 0.5,
      source: 'manual',
      confidence: 1,
    }],
  })
}

describe('Selected Scene deterministic preview timeline', () => {
  it('derives loop lengths that contain a complete four-sign cycle', () => {
    expect(resolvePixGridSelectedScenePreviewLoopBars('intro')).toBe(16)
    expect(resolvePixGridSelectedScenePreviewLoopBars('verse')).toBe(32)
    expect(resolvePixGridSelectedScenePreviewLoopBars('build')).toBe(16)
    expect(resolvePixGridSelectedScenePreviewLoopBars('drop')).toBe(16)
    expect(resolvePixGridSelectedScenePreviewLoopBars('breakdown')).toBe(64)
    expect(resolvePixGridSelectedScenePreviewLoopBars('outro')).toBe(16)
    expect(resolvePixGridSelectedScenePreviewLoopBars('verse', 0.5)).toBe(64)
    expect(resolvePixGridSelectedScenePreviewLoopBars('verse', 0)).toBe(16)
  })

  it('preserves the existing four-bar Selected Scene loop for non-Marquee presets', () => {
    const bassPresetId = 'pix-grid-bass-beacon'
    const bassPreset = PIX_GRID_PRESET_BY_ID.get(bassPresetId)!
    const applied = applyPixGridPresetSettings(createDefaultPixGridState(), bassPresetId, bassPreset.pixGridSettings)
    const state = normalizePixGridState({
      ...applied,
      selectedSceneId: `${bassPresetId}-verse`,
      editor: { ...applied.editor, scenePreviewMode: 'selectedScene' },
    })
    const frame = applyPixGridSelectedScenePreviewFrame(rawFrameAt(5.25), state)

    expect(frame.previewLoopBars).toBe(4)
    expect(frame.barsSinceSectionStart).toBe(1.25)
    expect(frame.sectionProgress).toBe(0.3125)
  })

  it.each([
    ['verse', 1 / 8],
    ['build', 1 / 4],
    ['drop', 1 / 4],
    ['breakdown', 1 / 16],
  ] as const)('%s preview reaches a real intermediate sign transition', (scene: 'verse' | 'build' | 'drop' | 'breakdown', cadence: number) => {
    const firstBoundaryBar = 1 / cadence
    const middleOffsetBar = (1 / 16) / cadence
    const [, middle] = resolvedPreviewFrames(scene, [0, firstBoundaryBar + middleOffsetBar])
    const animation = resolvePixGridLayerAnimation(
      structure,
      PIX_GRID_BUILT_IN_ASSET_BY_ID.get(structure.assetId)!,
      middle,
      1,
    )

    expect(middle.previewElapsedBar).toBeCloseTo(firstBoundaryBar + middleOffsetBar, 8)
    expect(middle.signClock).toBeCloseTo(1 + 1 / 16, 8)
    expect(animation).toMatchObject({ frameIndex: 1, previousFrameIndex: 0 })
    expect(animation.frameTransitionProgress).toBeGreaterThan(0)
    expect(animation.frameTransitionProgress).toBeLessThan(1)
  })

  it('renders source, intermediate, and completed logical transition frames', () => {
    const cadence = PIX_GRID_NEON_MARQUEE_SIGN_CADENCE.verse
    const boundaryBar = 1 / cadence
    const [source, middle, complete] = resolvedPreviewFrames('verse', [
      0,
      boundaryBar + (1 / 16) / cadence,
      boundaryBar + (1 / 8) / cadence,
    ])
    const state = selectedState('verse')
    const sourcePixels = composePixGridLogicalFrame(preset, state, source).pixels
    const middlePixels = composePixGridLogicalFrame(preset, state, middle).pixels
    const completePixels = composePixGridLogicalFrame(preset, state, complete).pixels

    expect(hash(middlePixels)).not.toBe(hash(sourcePixels))
    expect(hash(middlePixels)).not.toBe(hash(completePixels))
    const resolvedComplete = resolvePixGridLayerAnimation(
      structure,
      PIX_GRID_BUILT_IN_ASSET_BY_ID.get(structure.assetId)!,
      complete,
      1,
    )
    expect(resolvedComplete.frameTransitionProgress).toBe(1)
  })

  it('wraps a complete preview cycle through the real fourth-to-first sign transition', () => {
    const loopBars = resolvePixGridSelectedScenePreviewLoopBars('breakdown')
    const cadence = PIX_GRID_NEON_MARQUEE_SIGN_CADENCE.breakdown
    const [before, boundary, middle] = resolvedPreviewFrames('breakdown', [
      0,
      loopBars - 0.001,
      loopBars,
      loopBars + (1 / 16) / cadence,
    ]).slice(1)
    const beforeAnimation = resolvePixGridLayerAnimation(
      structure,
      PIX_GRID_BUILT_IN_ASSET_BY_ID.get(structure.assetId)!,
      before,
      1,
    )
    const boundaryAnimation = resolvePixGridLayerAnimation(
      structure,
      PIX_GRID_BUILT_IN_ASSET_BY_ID.get(structure.assetId)!,
      boundary,
      1,
    )
    const middleAnimation = resolvePixGridLayerAnimation(
      structure,
      PIX_GRID_BUILT_IN_ASSET_BY_ID.get(structure.assetId)!,
      middle,
      1,
    )

    expect(beforeAnimation.frameIndex).toBe(3)
    expect(boundary.previewLoopIndex).toBe(1)
    expect(boundary.previewLoopBoundary).toBe(true)
    expect(boundaryAnimation).toMatchObject({ frameIndex: 0, previousFrameIndex: 3, frameTransitionProgress: 0 })
    expect(middleAnimation).toMatchObject({ frameIndex: 0, previousFrameIndex: 3 })
    expect(middleAnimation.frameTransitionProgress).toBeGreaterThan(0)
    expect(middleAnimation.frameTransitionProgress).toBeLessThan(1)
  })

  it('resets manual scene switches to a safe held preview start', () => {
    const clock = new PixGridSelectedScenePreviewClock()
    const verse = selectedState('verse')
    const drop = selectedState('drop')
    clock.apply(rawFrameAt(100, { timingDiscontinuity: true }), verse)
    const progressed = applyPixGridPresetSignClock(clock.apply(rawFrameAt(109), verse), PRESET_ID)
    const switched = applyPixGridPresetSignClock(clock.apply(rawFrameAt(109), drop), PRESET_ID)

    expect(progressed.previewElapsedBar).toBe(9)
    expect(progressed.signClock).toBeGreaterThanOrEqual(1)
    expect(switched).toMatchObject({
      sectionType: 'drop',
      previewElapsedBar: 0,
      previewLoopIndex: 0,
      previewLoopBoundary: true,
      barsSinceSectionStart: 0,
      signClock: 0,
      signTransitionClock: null,
    })
  })

  it('keeps the selected preview timeline through seeks instead of reconstructing track Outro transparency', () => {
    const clock = new PixGridSelectedScenePreviewClock()
    const motionClock = new PixGridMotionClock()
    const state = selectedState('intro')
    const project = (absoluteBar: number, timingDiscontinuity = false) => {
      const controlled = applyPixGridRuntimeControls(rawFrameAt(absoluteBar, { timingDiscontinuity }), {
        bassReactivity: 1,
        motion: 1,
      })
      const preview = clock.apply(controlled, state)
      return motionClock.apply(applyPixGridPresetSignClock(preview, PRESET_ID))
    }

    project(100, true)
    const visible = project(104)
    const sought = project(60, true)
    const soughtPixels = composePixGridLogicalFrame(preset, state, sought).pixels

    expect(visible.previewElapsedBar).toBe(4)
    expect(sought).toMatchObject({
      sectionType: 'intro',
      previewElapsedBar: 4,
      restoringFromTransparency: false,
    })
    expect(activeCellCount(soughtPixels)).toBeGreaterThan(9_000)
  })

  it('restores from a completed manual Outro through a controlled power-on', () => {
    const clock = new PixGridSelectedScenePreviewClock()
    const outro = selectedState('outro')
    const intro = selectedState('intro')
    clock.apply(applyPixGridRuntimeControls(rawFrameAt(100, { timingDiscontinuity: true }), {
      bassReactivity: 1,
      motion: 1,
    }), outro)
    clock.apply(applyPixGridRuntimeControls(rawFrameAt(101), { bassReactivity: 1, motion: 1 }), outro)

    const start = clock.apply(applyPixGridRuntimeControls(rawFrameAt(101), { bassReactivity: 1, motion: 1 }), intro)
    const middle = clock.apply(applyPixGridRuntimeControls(rawFrameAt(101.375), { bassReactivity: 1, motion: 1 }), intro)
    const startAnimation = resolvePixGridLayerAnimation(
      structure,
      PIX_GRID_BUILT_IN_ASSET_BY_ID.get(structure.assetId)!,
      applyPixGridPresetSignClock(start, PRESET_ID),
      1,
    )
    const middleAnimation = resolvePixGridLayerAnimation(
      structure,
      PIX_GRID_BUILT_IN_ASSET_BY_ID.get(structure.assetId)!,
      applyPixGridPresetSignClock(middle, PRESET_ID),
      1,
    )

    expect(start).toMatchObject({ restoringFromTransparency: true, restorationElapsedBar: 0 })
    expect(startAnimation).toMatchObject({ frameTransitionType: 'powerOn', frameTransitionProgress: 0 })
    expect(middleAnimation.frameTransitionProgress).toBeGreaterThan(0)
    expect(middleAnimation.frameTransitionProgress).toBeLessThan(1)
  })

  it('freezes while paused and resumes without consuming the paused playhead jump', () => {
    const clock = new PixGridSelectedScenePreviewClock()
    const state = selectedState('verse')
    const start = clock.apply(rawFrameAt(100, { timingDiscontinuity: true }), state)
    const paused = clock.apply(rawFrameAt(104, {
      isPlaying: false,
      transportState: 'paused',
    }), state)
    const resumed = clock.apply(rawFrameAt(105), state)

    expect(start.previewElapsedBar).toBe(0)
    expect(paused.previewElapsedBar).toBe(0)
    expect(resumed.previewElapsedBar).toBe(1)
  })

  it('lets Motion scale preview cadence without changing the authored raw clock', () => {
    const [, fullMotion] = resolvedPreviewFrames('verse', [0, 8], 1)
    const [, halfMotion] = resolvedPreviewFrames('verse', [0, 8], 0.5)

    expect(fullMotion.signClock).toBe(1)
    expect(halfMotion.signClock).toBe(1)
    expect(fullMotion.motionClockSign).toBe(1)
    expect(halfMotion.motionClockSign).toBe(0.5)
    expect(halfMotion.motionClockSectionBar).toBeCloseTo(4, 8)
  })

  it('projects the Shared Performance section over the full authored preview loop', () => {
    const state = selectedState('breakdown')
    const clock = new PixGridSelectedScenePreviewClock()
    clock.apply(rawFrameAt(100, { timingDiscontinuity: true }), state)
    const frame = clock.apply(rawFrameAt(116), state)
    const context = resolvePixGridPreviewPerformanceContext(contextAt(32), state, frame)

    expect(context.sectionType).toBe('breakdown')
    expect(context.barsSinceSectionStart).toBe(16)
    expect(context.barsUntilSectionEnd).toBe(48)
    expect(context.sectionProgress).toBe(0.25)
    expect(context.performanceFourBarBlockIndex).toBe(4)
    expect(context.performanceSixteenBarBlockIndex).toBe(1)
  })

  it('uses the same local timeline to demonstrate and hold Outro power-down completion', () => {
    const frames = resolvedPreviewFrames('outro', [0, 0.25, 0.5, 0.75, 1, 20])
    const state = selectedState('outro')
    const counts = frames.map(frame => activeCellCount(composePixGridLogicalFrame(preset, state, frame).pixels))

    expect(counts[0]).toBeGreaterThan(counts[1])
    expect(counts[1]).toBeGreaterThan(counts[2])
    expect(counts[2]).toBeGreaterThan(counts[3])
    expect(counts[3]).toBe(0)
    expect(counts[4]).toBe(0)
    expect(counts[5]).toBe(0)
    expect(frames[5]).toMatchObject({
      barsSinceSectionStart: 16,
      previewLoopIndex: 0,
      previewLoops: false,
      sectionProgress: 1,
    })
  })

  it('holds Intro at its completed preview state instead of inventing a loop transition', () => {
    const frame = resolvedPreviewFrames('intro', [0, 20])[1]

    expect(frame).toMatchObject({
      barsSinceSectionStart: 16,
      previewLoopIndex: 0,
      previewLoops: false,
    })
  })

  it('leaves Follow Track frames untouched', () => {
    const clock = new PixGridSelectedScenePreviewClock()
    const frame = rawFrameAt(18.5, {
      sectionType: 'drop',
      barsSinceSectionStart: 2.5,
      sectionProgress: 0.3125,
    })
    expect(clock.apply(frame, followTrackState())).toBe(frame)
  })
})
