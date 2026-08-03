import { describe, expect, it } from 'vitest'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PixGridMotionClock } from '../PixGridRuntimeControls'
import {
  PIX_GRID_FOLLOW_TRACK_SCENE_VALUE,
  PixGridSelectedScenePreviewClock,
  applyPixGridSelectedScenePreviewFrame,
  resolvePixGridPreviewPerformanceContext,
  resolvePixGridSelectedScenePreviewLoopBars,
  selectPixGridPreviewScene,
} from '../PixGridScenePreview'
import type { PixGridAudioFrame } from '../PixGridTypes'

function frameAt(absoluteBar: number, overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  const beat = absoluteBar * 4
  return {
    audioTime: absoluteBar * 2,
    bass: 0.4,
    mid: 0.3,
    high: 0.2,
    volume: 0.5,
    beatHit: false,
    beatPhase: beat % 1,
    isPlaying: true,
    beatIndex: Math.floor(beat),
    barIndex: Math.floor(absoluteBar),
    barProgress: absoluteBar % 1,
    absoluteBar,
    sectionType: 'verse',
    sectionProgress: 0,
    beatsSinceSectionStart: 0,
    barsSinceSectionStart: 0,
    motionMultiplier: 1,
    trackIdentity: 'preview-track',
    transportState: 'playing',
    ...overrides,
  }
}

function selectedVerseState() {
  const state = createDefaultPixGridState()
  return selectPixGridPreviewScene(state, 'pix-grid-bass-beacon-verse')
}

describe('PixGrid selected-scene preview timeline', () => {
  it('uses the neutral four-bar preview loop for every remaining section type', () => {
    expect(resolvePixGridSelectedScenePreviewLoopBars('intro')).toBe(4)
    expect(resolvePixGridSelectedScenePreviewLoopBars('verse', 0)).toBe(4)
    expect(resolvePixGridSelectedScenePreviewLoopBars('drop', 2)).toBe(4)
  })

  it('projects transport position onto a deterministic selected-scene loop', () => {
    const state = selectedVerseState()
    const projected = applyPixGridSelectedScenePreviewFrame(frameAt(9.25), state)

    expect(projected.previewElapsedBar).toBe(9.25)
    expect(projected.previewLoopBars).toBe(4)
    expect(projected.previewLoopIndex).toBe(2)
    expect(projected.barsSinceSectionStart).toBeCloseTo(1.25, 8)
    expect(projected.sectionType).toBe('verse')
    expect(projected.inputSource).toBe('editor-preview')
  })

  it('reconstructs the same preview frame after reset, seek, and loop', () => {
    const state = selectedVerseState()
    const clock = new PixGridSelectedScenePreviewClock()
    const first = clock.apply(frameAt(5.5), state)
    clock.reset()
    const repeated = clock.apply(frameAt(5.5, { timingDiscontinuity: true }), state)

    expect(repeated.previewLoopIndex).toBe(first.previewLoopIndex)
    expect(repeated.barsSinceSectionStart).toBe(first.barsSinceSectionStart)
    expect(repeated.phraseIndex).toBe(first.phraseIndex)
    expect(repeated.sectionProgress).toBe(first.sectionProgress)
  })

  it('keeps the shared time, beat, bar, and section clocks working in preview', () => {
    const state = selectedVerseState()
    const projected = applyPixGridSelectedScenePreviewFrame(frameAt(2.5), state)
    const integrated = new PixGridMotionClock().apply(projected)

    expect(integrated.motionClockTime).toBeCloseTo(projected.audioTime, 8)
    expect(integrated.motionClockBeat).toBeCloseTo(10, 8)
    expect(integrated.motionClockBar).toBeCloseTo(2.5, 8)
    expect(integrated.motionClockSectionBar).toBeCloseTo(2.5, 8)
    expect(integrated.motionClockSectionType).toBe('verse')
  })

  it('projects Shared Performance ownership onto the selected scene', () => {
    const state = selectedVerseState()
    const projected = applyPixGridSelectedScenePreviewFrame(frameAt(6), state)
    const context = buildSharedPerformanceContext({
      audioTimeSec: projected.audioTime,
      frame: { ...DEFAULT_MI_FRAME, timeSec: projected.audioTime },
      durationSec: 64,
      trackIdentity: 'preview-track',
    })
    const preview = resolvePixGridPreviewPerformanceContext(context, state, projected)

    expect(preview.sectionType).toBe('verse')
    expect(preview.sectionId).toContain('editor-preview:pix-grid-bass-beacon-verse')
    expect(preview.barsSinceSectionStart).toBeCloseTo(2, 8)
    expect(preview.capabilities.sections).toBe(true)
  })

  it('returns control to Follow Track without changing the selected scene', () => {
    const selected = selectedVerseState()
    const followed = selectPixGridPreviewScene(selected, PIX_GRID_FOLLOW_TRACK_SCENE_VALUE)

    expect(followed.editor.scenePreviewMode).toBe('followTrack')
    expect(followed.selectedSceneId).toBe(selected.selectedSceneId)
  })
})
