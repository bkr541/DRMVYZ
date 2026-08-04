import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext } from '../../../../features/performanceCore'
import type { CanvasMediaItem, ReactTrackSection } from '../ReactTypes'
import { resolveCanvasPlaybackUrl } from '../canvasMediaFidelity'
import { resolveCanvasContextualTransitionIds } from './CanvasTransitions'
import {
  getCanvasPerformancePreloadCandidates,
  resolveCanvasAuthoredProgramState,
  resolveCanvasPerformanceFrame,
} from './CanvasPerformanceEngine'
import {
  CANVAS_PERFORMANCE_SHOWS,
  getCanvasPerformanceShow,
} from './CanvasPerformanceShows'
import {
  DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  MAX_CANVAS_PERFORMANCE_LAYERS,
  type CanvasOrchestrationSettings,
  type CanvasPerformanceShowId,
} from './CanvasPerformanceTypes'

const sections: ReactTrackSection[] = [
  { id: 'intro-1', label: 'Intro', type: 'intro', startSec: 0, endSec: 16, intensity: 0.25, source: 'auto', confidence: 0.92, interpretation: { familyId: 'intro-family', occurrenceIndex: 1 } },
  { id: 'verse-1', label: 'Verse 1', type: 'verse', startSec: 16, endSec: 32, intensity: 0.48, source: 'auto', confidence: 0.92, interpretation: { familyId: 'verse-family', occurrenceIndex: 1 } },
  { id: 'build-1', label: 'Build 1', type: 'build', startSec: 32, endSec: 48, intensity: 0.72, source: 'auto', confidence: 0.94, interpretation: { familyId: 'build-family', occurrenceIndex: 1 } },
  { id: 'predrop-1', label: 'Pre-Drop 1', type: 'preDrop', startSec: 48, endSec: 52, intensity: 0.45, source: 'auto', confidence: 0.95, interpretation: { familyId: 'predrop-family', occurrenceIndex: 1 } },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 52, endSec: 116, intensity: 0.96, source: 'auto', confidence: 0.97, interpretation: { familyId: 'drop-family', occurrenceIndex: 1 } },
  { id: 'breakdown-1', label: 'Breakdown', type: 'breakdown', startSec: 116, endSec: 132, intensity: 0.32, source: 'auto', confidence: 0.93, interpretation: { familyId: 'breakdown-family', occurrenceIndex: 1 } },
  { id: 'build-2', label: 'Build 2', type: 'build', startSec: 132, endSec: 148, intensity: 0.78, source: 'auto', confidence: 0.94, interpretation: { familyId: 'build-family', occurrenceIndex: 2 } },
  { id: 'predrop-2', label: 'Pre-Drop 2', type: 'preDrop', startSec: 148, endSec: 152, intensity: 0.42, source: 'auto', confidence: 0.95, interpretation: { familyId: 'predrop-family', occurrenceIndex: 2 } },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 152, endSec: 216, intensity: 1, source: 'auto', confidence: 0.97, interpretation: { familyId: 'drop-family', occurrenceIndex: 2 } },
  { id: 'outro-1', label: 'Outro', type: 'outro', startSec: 216, endSec: 232, intensity: 0.2, source: 'auto', confidence: 0.9, interpretation: { familyId: 'outro-family', occurrenceIndex: 1 } },
]

type EventKind = 'none' | 'kick' | 'snare' | 'hat' | 'downbeat'

function frameAt(timeSec: number, event: EventKind = 'none', confidence = 0.94): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const downbeat = event === 'downbeat'
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: beatIndex,
    trackId: 'track-authored-canvas',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      normalizedBass: 0.78,
      normalizedMid: 0.52,
      normalizedHigh: 0.46,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: event !== 'none',
      downbeatHit: downbeat,
      kickHit: event === 'kick' || downbeat,
      kickStrength: event === 'kick' || downbeat ? 0.94 : 0,
      snareHit: event === 'snare',
      snareStrength: event === 'snare' ? 0.9 : 0,
      hatHit: event === 'hat',
      hatStrength: event === 'hat' ? 0.82 : 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.82,
      percentile: 0.84,
      spectralFlux: 0.62,
      tension: 0.72,
      complexity: 0.65,
      dropImpact: downbeat ? 0.95 : 0.18,
    },
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: false,
      lyrics: false,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: confidence,
      rhythm: confidence,
      section: confidence,
    },
  }
}

function contextAt(
  timeSec: number,
  event: EventKind = 'none',
  previous: ReturnType<typeof buildSharedPerformanceContext> | null = null,
  options: { confidence?: number; track?: string; seek?: string; loop?: string } = {},
) {
  const track = options.track ?? 'track-authored-canvas'
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: { ...frameAt(timeSec, event, options.confidence ?? 0.94), trackId: track },
    resolvedSections: sections,
    trackIdentity: track,
    seekIdentity: options.seek ?? 'seek-0',
    loopIdentity: options.loop ?? 'loop-0',
    trackChangeIdentity: `track:${track}`,
    previous,
  })
}

function media(id: string, type: CanvasMediaItem['type'] = 'video', patch: Partial<CanvasMediaItem> = {}): CanvasMediaItem {
  return {
    id,
    name: id,
    type,
    objectUrl: `original://${id}`,
    thumbnailUrl: null,
    mimeType: type === 'video' ? 'video/mp4' : type === 'svg' ? 'image/svg+xml' : 'image/png',
    meta: type.toUpperCase(),
    source: 'library',
    createdAt: new Date(0).toISOString(),
    width: 1920,
    height: 1080,
    durationSec: type === 'video' ? 64 : undefined,
    fps: type === 'video' ? 30 : undefined,
    ...patch,
  }
}

const fullPool = [
  media('hero-a', 'video', { tags: ['hero', 'drop'] }),
  media('hero-b', 'video', { tags: ['alternate', 'drop'] }),
  media('background', 'image', { tags: ['background', 'atmosphere'] }),
  media('texture', 'image', { tags: ['texture', 'overlay'] }),
  media('accent', 'svg', { tags: ['foreground', 'accent'], hasAlpha: true }),
  media('mask', 'svg', { tags: ['mask'], hasAlpha: true }),
]

function settings(showId: CanvasPerformanceShowId, patch: Partial<CanvasOrchestrationSettings> = {}): CanvasOrchestrationSettings {
  return {
    ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
    enabled: true,
    programId: showId,
    mediaPoolIds: fullPool.map(item => item.id),
    mediaRolesById: {
      'hero-a': ['hero', 'dropAsset'],
      'hero-b': ['alternateHero', 'dropAsset'],
      background: ['background', 'breakdownAsset', 'introAsset', 'outroAsset'],
      texture: ['texture'],
      accent: ['foregroundAccent'],
      mask: ['mask', 'transition'],
    },
    mediaLocksByLayer: {},
    layerLocks: {},
    globalLocks: {},
    complexity: 0.75,
    transitionDensity: 0.8,
    effectIntensity: 0.72,
    motionIntensity: 0.7,
    cutDensity: 0.8,
    ...patch,
  }
}

function resolve(showId: CanvasPerformanceShowId, timeSec: number, event: EventKind = 'none', patch: Partial<CanvasOrchestrationSettings> = {}) {
  return resolveCanvasPerformanceFrame({
    context: contextAt(timeSec, event),
    settings: settings(showId, patch),
    mediaItems: fullPool,
  })
}

function showSignature(showId: CanvasPerformanceShowId): string {
  const show = getCanvasPerformanceShow(showId)
  return show.program.scenes.map(scene => JSON.stringify({
    id: scene.id,
    sectionTypes: scene.sectionTypes,
    actions: scene.actions,
    motifs: scene.fourBarActions,
    events: scene.eventActions,
  })).join('|')
}

describe('authored CANVAS Performance Shows', () => {
  it('publishes all six selectable, structurally distinct shows', () => {
    expect(CANVAS_PERFORMANCE_SHOWS.map(show => show.label)).toEqual([
      'Cinematic Bass Editor',
      'Glitch Collage Reactor',
      'Dreamstate Media Tunnel',
      'Impact Cut System',
      'Layered Luma Journey',
      'Fractures Performance',
    ])
    expect(new Set(CANVAS_PERFORMANCE_SHOWS.map(show => show.id)).size).toBe(6)
    expect(new Set(CANVAS_PERFORMANCE_SHOWS.map(show => showSignature(show.id))).size).toBe(6)
  })

  it.each(CANVAS_PERFORMANCE_SHOWS.map(show => [show.id, show.label] as const))(
    'selects section-aware authored scenes for %s',
    (showId, label) => {
      const intro = resolve(showId, 8)
      const build = resolve(showId, 36)
      const drop = resolve(showId, 56)
      const breakdown = resolve(showId, 120)
      expect(intro.showLabel).toBe(label)
      expect(new Set([intro.sceneId, build.sceneId, drop.sceneId, breakdown.sceneId]).size).toBeGreaterThanOrEqual(4)
    },
  )

  it('evolves Drop 2 while preserving the show identity', () => {
    for (const show of CANVAS_PERFORMANCE_SHOWS) {
      const drop1 = resolve(show.id, 56)
      const drop2 = resolve(show.id, 156)
      expect(drop2.showLabel).toBe(drop1.showLabel)
      expect(drop2.sceneId).not.toBe(drop1.sceneId)
      expect(drop2.context.dropOccurrence).toBeGreaterThan(drop1.context.dropOccurrence)
    }
  })

  it('changes four-bar motifs, recruits at eight bars, and evolves at sixteen bars', () => {
    const showId: CanvasPerformanceShowId = 'canvas-glitch-collage-reactor'
    const earlyContext = contextAt(54)
    const early = resolveCanvasPerformanceFrame({ context: earlyContext, settings: settings(showId, { complexity: 0 }), mediaItems: fullPool })
    const fourBarContext = contextAt(62, 'none', earlyContext)
    const fourBar = resolveCanvasPerformanceFrame({ context: fourBarContext, settings: settings(showId, { complexity: 0 }), mediaItems: fullPool, previousFrame: early })
    const eightBarContext = contextAt(70, 'none', fourBarContext)
    const eightBar = resolveCanvasPerformanceFrame({ context: eightBarContext, settings: settings(showId, { complexity: 0 }), mediaItems: fullPool, previousFrame: fourBar })
    const sixteenBarContext = contextAt(86, 'none', eightBarContext)
    const sixteenBar = resolveCanvasPerformanceFrame({ context: sixteenBarContext, settings: settings(showId, { complexity: 0.4 }), mediaItems: fullPool, previousFrame: eightBar })

    expect(fourBar.frameIdentity).not.toBe(early.frameIdentity)
    expect(eightBar.layers.length).toBeGreaterThanOrEqual(fourBar.layers.length)
    expect(sixteenBar.template.id).not.toBe(early.template.id)
  })

  it('contracts before Pre-Drop, holds the final frame, and releases on Drop impact', () => {
    const showSettings = settings('canvas-cinematic-bass-editor')
    const contractionContext = contextAt(45)
    const contraction = resolveCanvasPerformanceFrame({ context: contractionContext, settings: showSettings, mediaItems: fullPool })
    expect(contraction.anticipatoryStage).toBe('contraction')
    expect(contraction.template.id).toBe('maskedHeroReveal')
    expect(contraction.effectRecipeId).toBe('preDropVacuum')

    const holdContext = contextAt(50.5, 'none', contractionContext)
    const held = resolveCanvasPerformanceFrame({ context: holdContext, settings: showSettings, mediaItems: fullPool, previousFrame: contraction })
    expect(held.anticipatoryStage).toBe('finalHold')
    expect(held.layers.find(layer => layer.role === 'hero')?.playback.frameHold).toBe(true)

    const impactContext = contextAt(52, 'downbeat', holdContext)
    const impact = resolveCanvasPerformanceFrame({ context: impactContext, settings: showSettings, mediaItems: fullPool, previousFrame: held })
    expect(impact.context.sectionType).toBe('drop')
    expect(impact.layers.find(layer => layer.role === 'hero')?.playback.frameHold).toBe(false)
    expect(impact.layers.find(layer => layer.role === 'hero')?.playback.releaseOnDropImpact).toBe(true)
  })

  it('selects transition families from musical context rather than unrestricted randomness', () => {
    expect(resolveCanvasContextualTransitionIds(contextAt(36), ['lumaDissolve', 'strobeCut'])).toEqual(['lumaDissolve'])
    expect(resolveCanvasContextualTransitionIds(contextAt(50), ['frameHoldRelease', 'crossfade'])).toEqual(['frameHoldRelease'])
    expect(resolveCanvasContextualTransitionIds(contextAt(56), ['hardCut', 'crossfade'])).toEqual(['hardCut'])
    expect(resolveCanvasContextualTransitionIds(contextAt(120), ['lumaDissolve', 'strobeCut'])).toEqual(['lumaDissolve'])
  })

  it('keeps continuous modulation restrained, role-specific, and bounded', () => {
    const base = contextAt(36)
    const lowContext = {
      ...base,
      bass: 0.05,
      tension: 0.08,
      trackRelativeEnergy: 0.12,
      spectralFlux: 0.15,
      phraseProgress: 0.15,
    }
    const highContext = {
      ...base,
      bass: 0.95,
      tension: 0.92,
      trackRelativeEnergy: 0.9,
      spectralFlux: 0.88,
      phraseProgress: 0.85,
    }
    const showSettings = settings('canvas-cinematic-bass-editor', {
      compositionPreference: 'heroPlusTexture',
      complexity: 1,
      motionIntensity: 1,
    })
    const low = resolveCanvasPerformanceFrame({ context: lowContext, settings: showSettings, mediaItems: fullPool })
    const high = resolveCanvasPerformanceFrame({ context: highContext, settings: showSettings, mediaItems: fullPool })
    const lowHero = low.layers.find(layer => layer.role === 'hero')!
    const highHero = high.layers.find(layer => layer.role === 'hero')!
    const lowTexture = low.layers.find(layer => layer.role === 'texture')!
    const highTexture = high.layers.find(layer => layer.role === 'texture')!

    expect(highHero.scaleX).toBeGreaterThan(lowHero.scaleX)
    expect(highHero.crop.width).toBeLessThan(lowHero.crop.width)
    expect(highHero.x).toBeGreaterThan(lowHero.x)
    expect(highTexture.opacity).toBeGreaterThan(lowTexture.opacity)
    expect(highTexture.y).toBeGreaterThan(lowTexture.y)
    expect(highTexture.opacity).toBeLessThanOrEqual(1)
    expect(highHero.crop.width).toBeGreaterThan(0)
  })

  it('keeps kick, snare, and hat actions separated by layer role and treatment', () => {
    const showSettings = settings('canvas-glitch-collage-reactor', { compositionPreference: 'fourPanelGrid', complexity: 1 })
    const neutral = resolveCanvasPerformanceFrame({ context: contextAt(56), settings: showSettings, mediaItems: fullPool })
    const kick = resolveCanvasPerformanceFrame({ context: contextAt(56, 'kick'), settings: showSettings, mediaItems: fullPool })
    const snare = resolveCanvasPerformanceFrame({ context: contextAt(56, 'snare'), settings: showSettings, mediaItems: fullPool })
    const hat = resolveCanvasPerformanceFrame({ context: contextAt(56, 'hat'), settings: showSettings, mediaItems: fullPool })
    const neutralHero = neutral.layers.find(layer => layer.role === 'hero')
    const kickHero = kick.layers.find(layer => layer.role === 'hero')
    const snareAccent = snare.layers.find(layer => layer.role === 'foregroundAccent')
    const hatTexture = hat.layers.find(layer => layer.role === 'texture')

    expect(kickHero?.scaleX).toBeGreaterThan(neutralHero?.scaleX ?? 0)
    expect(snareAccent?.rotation).not.toBe(0)
    expect(hatTexture?.y).not.toBe(neutral.layers.find(layer => layer.role === 'texture')?.y)
  })
})

describe('authored CANVAS fallbacks, locks, determinism, and resource limits', () => {
  it('runs with one media item, image-only pools, and missing role categories without black output', () => {
    const oneImage = [media('only-image', 'image')]
    const oneSettings = settings('canvas-dreamstate-media-tunnel', {
      mediaPoolIds: ['only-image'],
      mediaRolesById: {},
      complexity: 1,
    })
    const single = resolveCanvasPerformanceFrame({ context: contextAt(56), settings: oneSettings, mediaItems: oneImage })
    expect(single.orchestrationActive).toBe(true)
    expect(single.layers.some(layer => layer.enabled && layer.sourceMediaId === 'only-image')).toBe(true)
    expect(single.diagnostics).toEqual(expect.arrayContaining(['single-media-safe-mode', 'image-only-safe-mode']))

    const missingRoles = resolveCanvasPerformanceFrame({
      context: contextAt(120),
      settings: settings('canvas-layered-luma-journey', { mediaRolesById: {} }),
      mediaItems: fullPool.slice(0, 3),
    })
    expect(missingRoles.layers.some(layer => layer.enabled)).toBe(true)
  })

  it('gives media and layer locks precedence over authored media advances', () => {
    const lockedSettings = settings('canvas-impact-cut-system', {
      mediaLocksByLayer: { hero: 'hero-a' },
      layerLocks: { hero: true },
      cutDensity: 1,
    })
    const kick = resolveCanvasPerformanceFrame({ context: contextAt(56, 'downbeat'), settings: lockedSettings, mediaItems: fullPool })
    expect(kick.layers.find(layer => layer.role === 'hero')?.sourceMediaId).toBe('hero-a')
    expect(kick.layers.find(layer => layer.role === 'hero')?.userLocked).toBe(true)
  })

  it('reconstructs identical scenes after deterministic seeks and loop wraps', () => {
    const showSettings = settings('canvas-layered-luma-journey', { poolRevision: 7 })
    const directContext = contextAt(170, 'none', null, { seek: 'seek-target' })
    const direct = resolveCanvasPerformanceFrame({ context: directContext, settings: showSettings, mediaItems: fullPool })

    const earlierContext = contextAt(56)
    const earlier = resolveCanvasPerformanceFrame({ context: earlierContext, settings: showSettings, mediaItems: fullPool })
    const soughtContext = contextAt(170, 'none', earlierContext, { seek: 'seek-target' })
    const sought = resolveCanvasPerformanceFrame({ context: soughtContext, settings: showSettings, mediaItems: fullPool, previousFrame: earlier })
    const loopContext = contextAt(170, 'none', earlierContext, { loop: 'loop-target' })
    const looped = resolveCanvasPerformanceFrame({ context: loopContext, settings: showSettings, mediaItems: fullPool, previousFrame: earlier })

    const identity = (frame: typeof direct) => ({ template: frame.template.id, scene: frame.sceneId, layers: frame.layers.map(layer => [layer.role, layer.sourceMediaId]) })
    expect(identity(sought)).toEqual(identity(direct))
    expect(identity(looped)).toEqual(identity(direct))
  })

  it('resets deterministically after track replacement and media-pool replacement', () => {
    const showSettings = settings('canvas-cinematic-bass-editor', { poolRevision: 2 })
    const firstContext = contextAt(56)
    const first = resolveCanvasPerformanceFrame({ context: firstContext, settings: showSettings, mediaItems: fullPool })
    const replacedTrackContext = contextAt(56, 'none', firstContext, { track: 'track-b' })
    const replacedTrack = resolveCanvasPerformanceFrame({ context: replacedTrackContext, settings: showSettings, mediaItems: fullPool, previousFrame: first })
    const freshTrack = resolveCanvasPerformanceFrame({ context: contextAt(56, 'none', null, { track: 'track-b' }), settings: showSettings, mediaItems: fullPool })
    expect(replacedTrack.layers.map(layer => layer.sourceMediaId)).toEqual(freshTrack.layers.map(layer => layer.sourceMediaId))

    const replacementPool = fullPool.slice(1)
    const replacementSettings = settings('canvas-cinematic-bass-editor', {
      mediaPoolIds: replacementPool.map(item => item.id),
      poolRevision: 3,
    })
    const replacedPool = resolveCanvasPerformanceFrame({ context: contextAt(56), settings: replacementSettings, mediaItems: replacementPool, previousFrame: first })
    expect(replacedPool.layers.every(layer => !layer.sourceMediaId || replacementPool.some(item => item.id === layer.sourceMediaId))).toBe(true)
  })

  it('enforces decoder, layer, preload, and high-quality source safeguards', () => {
    const videoHeavyPool = Array.from({ length: 10 }, (_, index) => media(`video-${index}`))
    const heavySettings = settings('canvas-glitch-collage-reactor', {
      mediaPoolIds: videoHeavyPool.map(item => item.id),
      mediaRolesById: {},
      compositionPreference: 'fourPanelGrid',
      complexity: 1,
    })
    const heavy = resolveCanvasPerformanceFrame({ context: contextAt(56), settings: heavySettings, mediaItems: videoHeavyPool })
    expect(heavy.decoderCount).toBeLessThanOrEqual(MAX_CANVAS_ACTIVE_VIDEO_DECODERS)
    expect(heavy.layers.length).toBeLessThanOrEqual(MAX_CANVAS_PERFORMANCE_LAYERS)
    expect(getCanvasPerformancePreloadCandidates(heavy, heavySettings, videoHeavyPool).length).toBeLessThanOrEqual(4)
    expect(resolveCanvasPlaybackUrl({ url: 'original-4k.mp4', proxyUrl: 'proxy-540p.mp4' })).toBe('original-4k.mp4')
  })

  it('uses safe general choreography when section confidence is low', () => {
    const baseContext = contextAt(56, 'none', null, { confidence: 0.2 })
    const context = {
      ...baseContext,
      sectionConfidence: 0.2,
      capabilities: { ...baseContext.capabilities, sections: false },
      confidence: { ...baseContext.confidence, section: 0.2 },
    }
    const program = resolveCanvasAuthoredProgramState(context, settings('canvas-cinematic-bass-editor'))
    const frame = resolveCanvasPerformanceFrame({ context, settings: settings('canvas-cinematic-bass-editor'), mediaItems: fullPool })
    expect(program.lowConfidenceFallback).toBe(true)
    expect(frame.diagnostics).toContain('low-confidence-safe-choreography')
    expect(frame.orchestrationActive).toBe(true)
  })
})
