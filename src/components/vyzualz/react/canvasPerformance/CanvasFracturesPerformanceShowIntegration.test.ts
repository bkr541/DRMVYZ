import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext } from '../../../../features/performanceCore'
import {
  DEFAULT_CANVAS_PRESET_SETTINGS,
  type CanvasMediaItem,
  type ReactTrackSection,
} from '../ReactTypes'
import {
  isCanvasFracturesProcessor,
  normalizeCanvasFracturesOverrideProfile,
  resolveCanvasFracturesPresetSettings,
} from './CanvasFracturesPerformance'
import { resolveCanvasPerformanceFrame } from './CanvasPerformanceEngine'
import {
  DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
  MAX_CANVAS_PERFORMANCE_LAYERS,
  type CanvasOrchestrationSettings,
} from './CanvasPerformanceTypes'

const sections: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 16, intensity: 0.2, source: 'auto', confidence: 0.95, interpretation: { familyId: 'intro', occurrenceIndex: 1 } },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 16, endSec: 32, intensity: 0.45, source: 'auto', confidence: 0.95, interpretation: { familyId: 'verse', occurrenceIndex: 1 } },
  { id: 'build', label: 'Build', type: 'build', startSec: 32, endSec: 48, intensity: 0.75, source: 'auto', confidence: 0.96, interpretation: { familyId: 'build', occurrenceIndex: 1 } },
  { id: 'predrop', label: 'Pre-Drop', type: 'preDrop', startSec: 48, endSec: 52, intensity: 0.5, source: 'auto', confidence: 0.96, interpretation: { familyId: 'predrop', occurrenceIndex: 1 } },
  { id: 'drop', label: 'Drop', type: 'drop', startSec: 52, endSec: 84, intensity: 1, source: 'auto', confidence: 0.98, interpretation: { familyId: 'drop', occurrenceIndex: 1 } },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 84, endSec: 104, intensity: 0.28, source: 'auto', confidence: 0.95, interpretation: { familyId: 'breakdown', occurrenceIndex: 1 } },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 104, endSec: 120, intensity: 0.15, source: 'auto', confidence: 0.93, interpretation: { familyId: 'outro', occurrenceIndex: 1 } },
]

function frameAt(timeSec: number): MusicIntelligenceFrame {
  const beatIndex = Math.floor(timeSec * 2)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: beatIndex,
    trackId: 'track-fractures-show',
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: timeSec * 2 - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
    },
    bands: { ...DEFAULT_MI_FRAME.bands, normalizedBass: 0.72, normalizedMid: 0.5, normalizedHigh: 0.42 },
    energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.75, percentile: 0.8, spectralFlux: 0.55, tension: 0.7, complexity: 0.6 },
    capabilities: { liveBands: true, rhythmEvents: true, beatGrid: true, sections: true, trackEnergyCurve: true, stemCurves: false, lyrics: false },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.96, rhythm: 0.96, section: 0.96 },
  }
}

function contextAt(
  timeSec: number,
  previous: ReturnType<typeof buildSharedPerformanceContext> | null = null,
  identity: { seek?: string; loop?: string; track?: string } = {},
) {
  const track = identity.track ?? 'track-fractures-show'
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: { ...frameAt(timeSec), trackId: track },
    resolvedSections: sections,
    trackIdentity: track,
    seekIdentity: identity.seek ?? 'seek-0',
    loopIdentity: identity.loop ?? 'loop-0',
    trackChangeIdentity: `track:${track}`,
    previous,
  })
}

function media(id: string, type: CanvasMediaItem['type'] = 'video'): CanvasMediaItem {
  return {
    id,
    name: id,
    type,
    objectUrl: `media://${id}`,
    thumbnailUrl: null,
    mimeType: type === 'video' ? 'video/mp4' : 'image/png',
    meta: type,
    source: 'library',
    createdAt: new Date(0).toISOString(),
    width: 1920,
    height: 1080,
    durationSec: type === 'video' ? 120 : undefined,
  }
}

const pool = [media('hero-video'), media('fallback-image', 'image')]

function showSettings(patch: Partial<CanvasOrchestrationSettings> = {}): CanvasOrchestrationSettings {
  return {
    ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
    enabled: true,
    programId: 'canvas-fractures-performance',
    mediaPoolIds: pool.map(item => item.id),
    mediaRolesById: { 'hero-video': ['hero'], 'fallback-image': ['background', 'hero'] },
    ...patch,
  }
}

function resolveAt(timeSec: number, patch: Partial<CanvasOrchestrationSettings> = {}) {
  return resolveCanvasPerformanceFrame({
    context: contextAt(timeSec),
    settings: showSettings(patch),
    mediaItems: pool,
  })
}

function processorAt(timeSec: number, patch: Partial<CanvasOrchestrationSettings> = {}) {
  const frame = resolveAt(timeSec, patch)
  const processor = frame.layers[0]?.processor
  expect(isCanvasFracturesProcessor(processor)).toBe(true)
  return { frame, processor: processor! }
}

describe('Fractures Canvas Performance Show integration', () => {
  it('selects Fractures through the real orchestration resolver as one logical layer', () => {
    const { frame, processor } = processorAt(56)

    expect(frame.showLabel).toBe('Fractures Performance')
    expect(frame.orchestrationActive).toBe(true)
    expect(frame.layers).toHaveLength(1)
    expect(frame.layers.length).toBeLessThanOrEqual(MAX_CANVAS_PERFORMANCE_LAYERS)
    expect(frame.decoderCount).toBeLessThanOrEqual(1)
    expect(frame.textureHandleCount).toBe(1)
    expect(frame.feedbackPasses).toBe(0)
    expect(frame.layers[0].effectChain).toEqual([])
    expect(processor).toMatchObject({ kind: 'fractures', presetId: 'canvas-fractures' })
    expect(frame.diagnostics).toEqual(expect.arrayContaining(['specialized:fractures', 'fractures-one-logical-layer']))
  })

  it('resolves section profiles with restrained intros, rising builds, impact drops, readable breakdowns, and reassembled outros', () => {
    const intro = processorAt(8).processor.overrides
    const buildEarly = processorAt(33).processor.overrides
    const buildLate = processorAt(46).processor.overrides
    const drop = processorAt(56).processor.overrides
    const breakdown = processorAt(90).processor.overrides
    const outro = processorAt(110).processor.overrides

    expect(intro.fractureIntensity).toBeLessThan(drop.fractureIntensity!)
    expect(intro.fractureFocusProtection).toBeGreaterThan(drop.fractureFocusProtection!)
    expect(drop.fractureMotionAmount).toBeGreaterThan(intro.fractureMotionAmount!)
    expect(buildLate.fractureComposition).toBeGreaterThan(buildEarly.fractureComposition!)
    expect(buildLate.fractureStructuralResponse).toBeGreaterThan(buildEarly.fractureStructuralResponse!)
    expect(drop.fractureTransitionMode).toBe('hardGlitchCut')
    expect(drop.fractureDuplicationAmount).toBeGreaterThan(breakdown.fractureDuplicationAmount!)
    expect(breakdown.fractureAnchorMode).toBe('alwaysVisible')
    expect(outro.fractureReturnToAnchor).toBe(true)
    expect(outro.fractureEffectsIntensity).toBeLessThan(breakdown.fractureEffectsIntensity!)
  })

  it('applies defaults, user baseline, show overrides, and local-audio controls in the documented precedence without mutation', () => {
    const user = {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      fractureIntensity: 0.31,
      fractureAudioResponse: 0.17,
      fractureBassMotion: 0.19,
      fractureOutlineAmount: 0.77,
      fractureEffectRoleWeights: { ...DEFAULT_CANVAS_PRESET_SETTINGS.fractureEffectRoleWeights, clean: 0.91 },
    }
    const snapshot = structuredClone(user)
    const { processor } = processorAt(56)

    const active = resolveCanvasFracturesPresetSettings({
      selectedPresetId: 'canvas-fractures',
      userSettings: user,
      autoPerformance: true,
      processor,
    })
    expect(active.fractureIntensity).toBe(processor.overrides.fractureIntensity)
    expect(active.fractureAudioResponse).toBe(processor.overrides.fractureAudioResponse)
    expect(active.fractureOutlineAmount).toBe(0.77)
    expect(user).toEqual(snapshot)

    const editedUser = { ...user, fractureIntensity: 0.43 }
    const activeAfterEdit = resolveCanvasFracturesPresetSettings({
      selectedPresetId: 'canvas-fractures',
      userSettings: editedUser,
      autoPerformance: true,
      processor,
    })
    expect(activeAfterEdit.fractureIntensity).toBe(processor.overrides.fractureIntensity)

    const disabled = resolveCanvasFracturesPresetSettings({
      selectedPresetId: 'canvas-fractures',
      userSettings: editedUser,
      autoPerformance: false,
      processor,
    })
    expect(disabled.fractureIntensity).toBe(0.43)
    expect(disabled.fractureAudioResponse).toBe(0.17)
    expect(disabled.fractureBassMotion).toBe(0.19)
    expect(disabled.fractureOutlineAmount).toBe(0.77)

    const reactivated = resolveCanvasFracturesPresetSettings({
      selectedPresetId: 'canvas-fractures',
      userSettings: editedUser,
      autoPerformance: true,
      processor,
    })
    expect(reactivated).toEqual(activeAfterEdit)
    expect(user).toEqual(snapshot)
  })

  it('reconstructs identical processor state on direct seek and loop, and isolates show/context switches', () => {
    const settings = showSettings({ poolRevision: 4 })
    const directContext = contextAt(90, null, { seek: 'breakdown-target' })
    const direct = resolveCanvasPerformanceFrame({ context: directContext, settings, mediaItems: pool })

    const dropContext = contextAt(56)
    const drop = resolveCanvasPerformanceFrame({ context: dropContext, settings, mediaItems: pool })
    const soughtContext = contextAt(90, dropContext, { seek: 'breakdown-target' })
    const sought = resolveCanvasPerformanceFrame({ context: soughtContext, settings, mediaItems: pool, previousFrame: drop })
    const loopedContext = contextAt(90, dropContext, { loop: 'breakdown-loop' })
    const looped = resolveCanvasPerformanceFrame({ context: loopedContext, settings, mediaItems: pool, previousFrame: drop })

    expect(sought.layers[0].processor).toEqual(direct.layers[0].processor)
    expect(looped.layers[0].processor).toEqual(direct.layers[0].processor)
    expect(sought.layers[0].sourceMediaId).toBe(direct.layers[0].sourceMediaId)
    expect(looped.layers[0].sourceMediaId).toBe(direct.layers[0].sourceMediaId)

    const generic = resolveCanvasPerformanceFrame({
      context: contextAt(90),
      settings: { ...settings, programId: 'canvas-cinematic-bass-editor' },
      mediaItems: pool,
      previousFrame: direct,
    })
    expect(generic.layers.every(layer => !layer.processor)).toBe(true)

    const restored = resolveCanvasPerformanceFrame({ context: directContext, settings, mediaItems: pool, previousFrame: generic })
    expect(restored.layers[0].processor).toEqual(direct.layers[0].processor)
  })

  it('reconstructs the drop profile when a loop crosses build to drop and keeps preview caller context isolated', () => {
    const settings = showSettings({ poolRevision: 7 })
    const buildContext = contextAt(46, null, { loop: 'build-drop-loop' })
    const buildFrame = resolveCanvasPerformanceFrame({ context: buildContext, settings, mediaItems: pool })
    const loopedDropContext = contextAt(56, buildContext, { loop: 'build-drop-loop' })
    const loopedDrop = resolveCanvasPerformanceFrame({
      context: loopedDropContext,
      settings,
      mediaItems: pool,
      previousFrame: buildFrame,
    })
    const directDrop = resolveCanvasPerformanceFrame({
      context: contextAt(56, null, { loop: 'build-drop-loop' }),
      settings,
      mediaItems: pool,
    })
    expect(loopedDrop.layers[0].processor).toEqual(directDrop.layers[0].processor)

    const liveBreakdown = resolveCanvasPerformanceFrame({ context: contextAt(90), settings, mediaItems: pool })
    const previewBreakdown = resolveCanvasPerformanceFrame({
      context: contextAt(90, null, { track: 'preview-scene-track' }),
      settings,
      mediaItems: pool,
      previousFrame: liveBreakdown,
    })
    expect(previewBreakdown.layers[0].processor?.identity).not.toBe(liveBreakdown.layers[0].processor?.identity)

    const restoredLive = resolveCanvasPerformanceFrame({
      context: contextAt(90),
      settings,
      mediaItems: pool,
      previousFrame: previewBreakdown,
    })
    expect(restoredLive.layers[0].processor).toEqual(liveBreakdown.layers[0].processor)
  })

  it('normalizes compact persisted overrides and ignores malformed or unknown fields', () => {
    const normalized = normalizeCanvasFracturesOverrideProfile({
      values: {
        fractureIntensity: 4,
        fractureAnchorMode: 'missing',
        fractureTransitionMode: 'zoomInOut',
        fractureEffectRoleWeights: { clean: 2, glitch: -1, invented: 1 },
        unknownField: 'discard-me',
      },
      ramp: { fractureIntensity: 5, fractureAudioResponse: -5, unknownField: 1 },
    })

    expect(normalized).toEqual({
      values: {
        fractureIntensity: 1,
        fractureTransitionMode: 'zoomInOut',
        fractureEffectRoleWeights: { clean: 1, glitch: 0 },
      },
      ramp: { fractureIntensity: 1, fractureAudioResponse: -1 },
    })
    expect(normalizeCanvasFracturesOverrideProfile({ nope: true })).toEqual({ values: {} })

    const roundTrip = normalizeCanvasFracturesOverrideProfile(JSON.parse(JSON.stringify(normalized)))
    expect(roundTrip).toEqual(normalized)

    const overridden = processorAt(56, { fracturesShowOverrides: normalized }).processor.overrides
    expect(overridden.fractureIntensity).toBe(1)
    expect(overridden.fractureTransitionMode).toBe('zoomInOut')
  })

  it('keeps existing non-Fractures Performance Shows on the generic layer path', () => {
    const frame = resolveCanvasPerformanceFrame({
      context: contextAt(56),
      settings: { ...showSettings(), programId: 'canvas-cinematic-bass-editor', complexity: 1 },
      mediaItems: pool,
    })

    expect(frame.showLabel).toBe('Cinematic Bass Editor')
    expect(frame.layers.every(layer => !layer.processor)).toBe(true)
    expect(frame.diagnostics).not.toContain('specialized:fractures')
  })
})
