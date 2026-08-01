import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { createPixGridAudioFrame } from '../PixGridAudioRouting'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridRuntimeControls, PixGridMotionClock } from '../PixGridRuntimeControls'
import { PixGridSelectedScenePreviewClock } from '../PixGridScenePreview'
import {
  applyPixGridPresetSignClock,
  PIX_GRID_NEON_MARQUEE_SIGN_CADENCE,
} from '../PixGridSignClock'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridAudioFrame, PixGridLayer, PixGridSectionBarSpan, PixGridState } from '../PixGridTypes'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
const TIMELINE: readonly PixGridSectionBarSpan[] = [
  { id: 'intro-1', type: 'intro', startBar: 0, endBar: 8 },
  { id: 'verse-1', type: 'verse', startBar: 8, endBar: 20 },
  { id: 'build-1', type: 'build', startBar: 20, endBar: 24 },
  { id: 'pre-drop-1', type: 'preDrop', startBar: 24, endBar: 26 },
  { id: 'drop-1', type: 'drop', startBar: 26, endBar: 34 },
  { id: 'breakdown-1', type: 'breakdown', startBar: 34, endBar: 42 },
  { id: 'outro-1', type: 'outro', startBar: 42, endBar: 50 },
]

function sectionAt(bar: number): PixGridSectionBarSpan {
  return TIMELINE.find(section => bar >= section.startBar && bar < section.endBar) ?? TIMELINE[TIMELINE.length - 1]!
}

function rawFrameAt(bar: number, overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  const section = sectionAt(bar)
  return {
    audioTime: bar * 2,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0,
    isPlaying: true,
    beatIndex: Math.floor(bar * 4),
    barIndex: Math.floor(bar),
    barProgress: bar - Math.floor(bar),
    absoluteBar: bar,
    sectionBarTimeline: TIMELINE,
    barsSinceSectionStart: Math.max(0, bar - section.startBar),
    beatsSinceSectionStart: Math.max(0, bar - section.startBar) * 4,
    sectionType: section.type,
    motionClockSectionType: section.type,
    sectionProgress: (bar - section.startBar) / Math.max(1, section.endBar - section.startBar),
    transportState: 'playing',
    motionMultiplier: 1,
    autoPerformanceEnabled: true,
    ...overrides,
  }
}

function signedFrameAt(bar: number, overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  const signed = applyPixGridPresetSignClock(rawFrameAt(bar, overrides), PRESET_ID)
  return { ...signed, motionClockSign: signed.signClock }
}

function marqueeState(sceneId = `${PRESET_ID}-verse`): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, PRESET.pixGridSettings)
  return {
    ...applied,
    selectedSceneId: sceneId,
    performance: { ...applied.performance, enabled: true },
  }
}

function resolve(layer: PixGridLayer, frame: PixGridAudioFrame) {
  return resolvePixGridLayerAnimation(layer, PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!, frame, 1)
}

const structure = PRESET.pixGridSettings!.layers!.find(layer => layer.id === 'marquee-structure')!

describe('Marquee independent sign clock', () => {
  it('projects authoritative Shared Performance sections onto the absolute sign timeline', () => {
    const frame: MusicIntelligenceFrame = {
      ...DEFAULT_MI_FRAME,
      timeSec: 40,
      frameId: 81,
      trackId: 'sign-clock-track',
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 120,
        beatIndex: 80,
        beatPhase: 0,
        beatInBar: 0,
        barIndex: 20,
      },
      capabilities: {
        ...DEFAULT_MI_FRAME.capabilities!,
        beatGrid: true,
        sections: true,
      },
    }
    const context = buildSharedPerformanceContext({
      audioTimeSec: 40,
      frame,
      trackIdentity: 'sign-clock-track',
      resolvedSections: [
        { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 16, intensity: 0.2, source: 'manual', confidence: 1 },
        { id: 'verse', label: 'Verse', type: 'verse', startSec: 16, endSec: 40, intensity: 0.5, source: 'manual', confidence: 1 },
        { id: 'build', label: 'Build', type: 'build', startSec: 40, endSec: 48, intensity: 0.8, source: 'manual', confidence: 1 },
      ],
    })
    const routed = createPixGridAudioFrame(context, { isPlaying: true, deltaTimeSec: 1 / 60 })
    expect(context.sectionBarTimeline.map(section => [section.id, section.type])).toEqual([
      ['intro', 'intro'],
      ['verse', 'verse'],
      ['build', 'build'],
    ])
    expect(context.sectionBarTimeline.map(section => section.startBar)).toEqual([0, 8, 20])
    expect(context.sectionBarTimeline.map(section => section.endBar)).toEqual([8, 20, 24])
    expect(routed.absoluteBar).toBe(context.absoluteBar)
    expect(routed.sectionBarTimeline).toEqual(context.sectionBarTimeline)
  })

  it('uses the authored section cadence without resetting accumulated identity', () => {
    expect(PIX_GRID_NEON_MARQUEE_SIGN_CADENCE).toMatchObject({
      intro: 0,
      verse: 1 / 8,
      build: 1 / 4,
      preDrop: 0,
      drop: 1 / 4,
      breakdown: 1 / 16,
      outro: 0,
    })
    expect(signedFrameAt(8)).toMatchObject({ signClock: 0, signTransitionClock: null })
    expect(signedFrameAt(20).signClock).toBe(1.5)
    expect(signedFrameAt(24).signClock).toBe(2.5)
    expect(signedFrameAt(26).signClock).toBe(2.5)
    expect(signedFrameAt(34).signClock).toBe(4.5)
    expect(signedFrameAt(42).signClock).toBe(5)
    expect(signedFrameAt(49).signClock).toBe(5)
  })

  it('does not invent a sign transition when Intro enters Verse at clock zero', () => {
    const before = resolve(structure, signedFrameAt(8 - 1e-6))
    const boundary = resolve(structure, signedFrameAt(8))
    expect(boundary.frameIndex).toBe(before.frameIndex)
    expect(boundary.frameTransitionType).toBe('cut')
    expect(boundary.frameTransitionProgress).toBe(1)
  })

  it.each([
    ['Verse → Build', 20 - 1e-6, 20],
    ['Build → Pre-drop', 24 - 1e-6, 24],
    ['Pre-drop → Drop', 26 - 1e-6, 26],
    ['Drop → Breakdown', 34 - 1e-6, 34],
  ])('%s preserves the active sign when no sign boundary occurs', (_label: string, beforeBar: number, boundaryBar: number) => {
    const before = resolve(structure, signedFrameAt(beforeBar))
    const boundary = resolve(structure, signedFrameAt(boundaryBar))
    expect(boundary.frameIndex).toBe(before.frameIndex)
    expect(boundary.frameTransitionProgress).toBe(1)
  })

  it('publishes deterministic source and target epochs from the authoritative schedule', () => {
    const before = signedFrameAt(20)
    const transition = signedFrameAt(20.125)
    expect(before).toMatchObject({
      signClock: 1.5,
      signTransitionSourceFrame: 0,
      signTransitionTargetFrame: 1,
    })
    expect(transition).toMatchObject({
      signTransitionSourceFrame: 0,
      signTransitionTargetFrame: 1,
    })
  })

  it('uses the actual prior displayed sign at a real sign transition', () => {
    const boundary = resolve(structure, signedFrameAt(16))
    const middle = resolve(structure, signedFrameAt(16.0625))
    expect(signedFrameAt(16).signTransitionClock).toBe(0)
    expect(boundary).toMatchObject({ frameIndex: 1, previousFrameIndex: 0, frameTransitionProgress: 0 })
    expect(middle.frameIndex).toBe(1)
    expect(middle.previousFrameIndex).toBe(0)
    expect(middle.frameTransitionProgress).toBeGreaterThan(0)
    expect(middle.frameTransitionProgress).toBeLessThan(1)

    const outroBoundary = resolve(structure, signedFrameAt(42))
    expect(outroBoundary).toMatchObject({ frameIndex: 1, previousFrameIndex: 0, frameTransitionProgress: 0 })
  })

  it('is deterministic after seek, loop, pause, restart, and remount', () => {
    const bar = 28.03125
    const first = resolve(structure, signedFrameAt(bar))
    expect(resolve(structure, signedFrameAt(bar))).toEqual(first)
    expect(resolve(structure, signedFrameAt(bar, { isPlaying: false, transportState: 'paused' }))).toEqual(first)

    const left = new PixGridMotionClock()
    const right = new PixGridMotionClock()
    const controlled = (at: number, clock: PixGridMotionClock, discontinuity = false) => clock.apply(applyPixGridRuntimeControls(
      applyPixGridPresetSignClock(rawFrameAt(at, { timingDiscontinuity: discontinuity }), PRESET_ID),
      { bassReactivity: 1, motion: 1 },
    ))
    const initial = controlled(bar, left)
    let looped = initial
    for (let loop = 0; loop < 3; loop += 1) {
      controlled(31, left)
      looped = controlled(bar, left, true)
      expect(looped.motionClockSign).toBe(initial.motionClockSign)
      expect(looped.motionClockSignTransition).toBe(initial.motionClockSignTransition)
    }
    const remounted = controlled(bar, right, true)
    const restartedClock = new PixGridMotionClock()
    const stopped = restartedClock.apply(applyPixGridRuntimeControls(
      applyPixGridPresetSignClock(rawFrameAt(bar, { isPlaying: false, transportState: 'stopped', timingDiscontinuity: true }), PRESET_ID),
      { bassReactivity: 1, motion: 1 },
    ))
    const restarted = restartedClock.apply(applyPixGridRuntimeControls(
      applyPixGridPresetSignClock(rawFrameAt(bar, { transportState: 'playing' }), PRESET_ID),
      { bassReactivity: 1, motion: 1 },
    ))
    expect(stopped.motionClockSign).toBe(initial.motionClockSign)
    expect(restarted.motionClockSign).toBe(initial.motionClockSign)
    expect(looped.motionClockSign).toBe(remounted.motionClockSign)
    expect(resolve(structure, looped)).toEqual(resolve(structure, remounted))
  })

  it('keeps Track Map and Editing Context scene ownership independent from sign identity', () => {
    const baseFrame = signedFrameAt(18.5)
    const baseSign = resolve(structure, baseFrame).frameIndex

    const trackMapFrame = {
      ...baseFrame,
      trackMapCueEvent: true,
      trackMapCueIdentity: 'track-map:drop-scene',
    }
    expect(resolve(structure, trackMapFrame).frameIndex).toBe(baseSign)

    const selected = marqueeState(`${PRESET_ID}-drop`)
    selected.editor = { ...selected.editor, scenePreviewMode: 'selectedScene' }
    const previewClock = new PixGridSelectedScenePreviewClock()
    const previewStart = applyPixGridPresetSignClock(
      previewClock.apply(rawFrameAt(18.5, { timingDiscontinuity: true }), selected),
      PRESET_ID,
    )
    const previewFrame = applyPixGridPresetSignClock(
      previewClock.apply(rawFrameAt(22.5), selected),
      PRESET_ID,
    )
    expect(previewStart).toMatchObject({ sectionType: 'drop', previewElapsedBar: 0, signClock: 0 })
    expect(previewFrame).toMatchObject({ sectionType: 'drop', previewElapsedBar: 4, signClock: 1 })
    expect(resolve(structure, previewFrame).frameIndex).toBe(1)

    const motionClock = new PixGridMotionClock()
    const afterSceneChange = motionClock.apply(applyPixGridRuntimeControls(previewStart, { bassReactivity: 1, motion: 0.5 }))
    expect(afterSceneChange.motionClockSign).toBe(0)
    expect(resolve(structure, afterSceneChange).frameIndex).toBe(0)

    const verseScene = marqueeState(`${PRESET_ID}-verse`)
    const breakdownScene = marqueeState(`${PRESET_ID}-breakdown`)
    expect(verseScene.selectedSceneId).not.toBe(breakdownScene.selectedSceneId)
    expect(resolve(structure, baseFrame).frameIndex).toBe(baseSign)
  })

  it('does not alter existing frameCycle assets unless they opt into the sign clock', () => {
    const parade = PIX_GRID_PRESET_BY_ID.get('pix-grid-pixel-parade')!
    const frameLayer = parade.pixGridSettings!.layers!.find(layer => layer.animations.some(animation => animation.mode === 'frameCycle'))!
    const baseline = rawFrameAt(10, { beatIndex: 8, beatPhase: 0.25, signClock: 0, motionClockSign: 0 })
    const changedSign = { ...baseline, signClock: 999, motionClockSign: 999 }
    expect(frameLayer.animations.find(animation => animation.mode === 'frameCycle')?.clock).not.toBe('sign')
    expect(resolve(frameLayer, changedSign).frameIndex).toBe(resolve(frameLayer, baseline).frameIndex)
  })
})
