import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext } from '../../../../features/performanceCore'
import type { ReactTrackSection, CanvasMediaItem } from '../ReactTypes'
import { resolveCanvasPlaybackUrl } from '../canvasMediaFidelity'
import { CANVAS_COMPOSITION_TEMPLATES } from './CanvasCompositionTemplates'
import {
  getCanvasPerformancePreloadCandidates,
  resolveCanvasDeterministicMedia,
  resolveCanvasPerformanceFrame,
} from './CanvasPerformanceEngine'
import { deriveAutomaticCanvasMediaRoles, resolveCanvasMediaRoles } from './CanvasMediaRoles'
import { resolveCanvasPlayback } from './CanvasPlayback'
import { buildCanvasPreloadRequests, CanvasPreloadManager } from './CanvasPreloadManager'
import {
  DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  MAX_CANVAS_EFFECT_CHAIN_DEPTH,
  MAX_CANVAS_FEEDBACK_PASSES,
  MAX_CANVAS_MEDIA_HANDLES,
  MAX_CANVAS_PERFORMANCE_LAYERS,
  type CanvasCompositionTemplateId,
  type CanvasOrchestrationSettings,
  type CanvasPerformanceShowId,
} from './CanvasPerformanceTypes'
import { resolveCanvasTransition, resolveCanvasTransitionDefinition } from './CanvasTransitions'

const sections: ReactTrackSection[] = [
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 0, endSec: 32, intensity: 0.9, source: 'auto', confidence: 0.95, interpretation: { familyId: 'drop-family', occurrenceIndex: 1 } },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 32, endSec: 48, intensity: 0.3, source: 'auto', confidence: 0.9 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 48, endSec: 80, intensity: 1, source: 'auto', confidence: 0.95, interpretation: { familyId: 'drop-family', occurrenceIndex: 2 } },
]

function musicFrame(timeSec: number, event: 'none' | 'downbeat' = 'none'): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: beatIndex,
    trackId: 'track-a',
    bands: { ...DEFAULT_MI_FRAME.bands, normalizedBass: 0.76, normalizedMid: 0.48, normalizedHigh: 0.42 },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: event === 'downbeat',
      downbeatHit: event === 'downbeat',
      kickHit: event === 'downbeat',
      kickStrength: event === 'downbeat' ? 0.9 : 0,
    },
    energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.8, percentile: 0.82, spectralFlux: 0.58, tension: 0.66, complexity: 0.6, dropImpact: event === 'downbeat' ? 0.92 : 0.2 },
    capabilities: {
      liveBands: DEFAULT_MI_FRAME.capabilities?.liveBands ?? false,
      rhythmEvents: DEFAULT_MI_FRAME.capabilities?.rhythmEvents ?? false,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: DEFAULT_MI_FRAME.capabilities?.trackEnergyCurve ?? false,
      stemCurves: DEFAULT_MI_FRAME.capabilities?.stemCurves ?? false,
      lyrics: DEFAULT_MI_FRAME.capabilities?.lyrics ?? false,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.92, rhythm: 0.95, section: 0.94 },
  }
}

function contextAt(
  timeSec: number,
  previous: ReturnType<typeof buildSharedPerformanceContext> | null = null,
  identities: { seek?: string; loop?: string; track?: string } = {},
) {
  const track = identities.track ?? 'track-a'
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: musicFrame(timeSec, Number.isInteger(timeSec / 2) ? 'downbeat' : 'none'),
    resolvedSections: sections,
    trackIdentity: track,
    seekIdentity: identities.seek ?? 'seek-0',
    loopIdentity: identities.loop ?? 'loop-0',
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
    durationSec: type === 'video' ? 32 : undefined,
    fps: type === 'video' ? 30 : undefined,
    ...patch,
  }
}

function settings(patch: Partial<CanvasOrchestrationSettings> = {}): CanvasOrchestrationSettings {
  return {
    ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
    enabled: true,
    mediaPoolIds: [],
    mediaRolesById: {},
    mediaLocksByLayer: {},
    layerLocks: {},
    globalLocks: {},
    ...patch,
  }
}

describe('CANVAS media roles and deterministic selection', () => {
  it('supports explicit role assignment and conservative automatic role fallback', () => {
    const alphaSvg = media('mask.svg', 'svg', { hasAlpha: true, width: 800, height: 1200, libraryRole: 'svg' })
    expect(deriveAutomaticCanvasMediaRoles(alphaSvg)).toEqual(expect.arrayContaining(['foregroundAccent', 'mask', 'alternateHero']))

    const assigned = resolveCanvasMediaRoles(alphaSvg, settings({ mediaRolesById: { [alphaSvg.id]: ['transition', 'texture'] } }))
    expect(assigned.explicit).toEqual(['transition', 'texture'])
    expect(assigned.effective).toEqual(['transition', 'texture'])
  })

  it('selects the same media for stable inputs across reload, seek, and loop identities', () => {
    const pool = [media('a'), media('b'), media('c')]
    const baseSettings = settings({ mediaPoolIds: pool.map(item => item.id), poolRevision: 7 })
    const direct = resolveCanvasDeterministicMedia({ items: pool, requiredRoles: ['hero'], settings: baseSettings, context: contextAt(10), layerRole: 'hero' })
    const sought = resolveCanvasDeterministicMedia({ items: pool, requiredRoles: ['hero'], settings: baseSettings, context: contextAt(10, null, { seek: 'seek-4' }), layerRole: 'hero' })
    const looped = resolveCanvasDeterministicMedia({ items: pool, requiredRoles: ['hero'], settings: baseSettings, context: contextAt(10, null, { loop: 'loop-8' }), layerRole: 'hero' })
    expect(sought?.id).toBe(direct?.id)
    expect(looped?.id).toBe(direct?.id)
  })

  it('avoids immediate repetition and gives user media locks precedence', () => {
    const pool = [media('a'), media('b'), media('c')]
    const baseSettings = settings({ mediaPoolIds: pool.map(item => item.id) })
    const first = resolveCanvasDeterministicMedia({ items: pool, requiredRoles: ['hero'], settings: baseSettings, context: contextAt(10), layerRole: 'hero' })
    const next = resolveCanvasDeterministicMedia({ items: pool, requiredRoles: ['hero'], settings: baseSettings, context: contextAt(10), layerRole: 'hero', previousMediaId: first?.id })
    const locked = resolveCanvasDeterministicMedia({ items: pool, requiredRoles: ['hero'], settings: baseSettings, context: contextAt(10), layerRole: 'hero', lockedMediaId: 'c' })
    expect(next?.id).not.toBe(first?.id)
    expect(locked?.id).toBe('c')
  })

  it('prefers distinct suitable sources across unrelated simultaneously active roles', () => {
    const pool = [
      media('hero', 'video'),
      media('alternate', 'video'),
      media('background', 'image'),
      media('texture', 'image'),
      media('accent', 'svg', { hasAlpha: true }),
      media('transition', 'image'),
    ]
    const orchestration = settings({
      programId: 'canvas-glitch-collage-reactor',
      compositionPreference: 'fourPanelGrid',
      complexity: 0,
      mediaPoolIds: pool.map(item => item.id),
      mediaRolesById: {
        hero: ['hero', 'dropAsset'],
        alternate: ['alternateHero'],
        background: ['background'],
        texture: ['texture'],
        accent: ['foregroundAccent', 'mask'],
        transition: ['transition'],
      },
    })
    const frame = resolveCanvasPerformanceFrame({ context: contextAt(10), settings: orchestration, mediaItems: pool })
    const core = frame.layers.filter(layer => ['hero', 'foregroundAccent', 'texture', 'background'].includes(layer.role))
    const ids = core.map(layer => layer.sourceMediaId).filter((id): id is string => Boolean(id))

    expect(core).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    expect(Object.fromEntries(core.map(layer => [layer.role, layer.sourceMediaId]))).toMatchObject({
      hero: 'hero',
      foregroundAccent: 'alternate',
      texture: 'texture',
      background: 'background',
    })
  })

  it('does not collapse a pool of manually Hero-tagged sources onto the first asset', () => {
    const pool = Array.from({ length: 6 }, (_, index) => media(`hero-only-${index}`, 'image'))
    const orchestration = settings({
      programId: 'canvas-glitch-collage-reactor',
      compositionPreference: 'fourPanelGrid',
      complexity: 0,
      mediaPoolIds: pool.map(item => item.id),
      mediaRolesById: Object.fromEntries(pool.map(item => [item.id, ['hero' as const]])),
    })
    const frame = resolveCanvasPerformanceFrame({ context: contextAt(10), settings: orchestration, mediaItems: pool })
    const ids = frame.layers.map(layer => layer.sourceMediaId).filter((id): id is string => Boolean(id))

    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
  })

  it('lets locks outrank diversity and gracefully reuses a one-source pool', () => {
    const diversePool = [media('hero-a'), media('hero-b'), media('background', 'image')]
    const lockedFrame = resolveCanvasPerformanceFrame({
      context: contextAt(10),
      settings: settings({
        programId: 'canvas-cinematic-bass-editor',
        compositionPreference: 'fullScreenHero',
        complexity: 0.35,
        mediaPoolIds: diversePool.map(item => item.id),
        mediaRolesById: { 'hero-a': ['hero'], 'hero-b': ['hero'], background: ['background'] },
        mediaLocksByLayer: { background: 'hero-a' },
      }),
      mediaItems: diversePool,
    })
    expect(lockedFrame.layers.find(layer => layer.role === 'background')?.sourceMediaId).toBe('hero-a')
    expect(lockedFrame.layers.find(layer => layer.role === 'background')?.userLocked).toBe(true)

    const only = media('only-source', 'image')
    const oneSourceFrame = resolveCanvasPerformanceFrame({
      context: contextAt(10),
      settings: settings({
        programId: 'canvas-glitch-collage-reactor',
        compositionPreference: 'fourPanelGrid',
        complexity: 0,
        mediaPoolIds: [only.id],
      }),
      mediaItems: [only],
    })
    expect(oneSourceFrame.layers.filter(layer => layer.enabled)).toHaveLength(4)
    expect(new Set(oneSourceFrame.layers.map(layer => layer.sourceMediaId))).toEqual(new Set([only.id]))
    expect(oneSourceFrame.diagnostics).toContain('single-media-safe-mode')
  })

  it('preserves deliberate mirrored hero duplication when the composition calls for it', () => {
    const pool = [media('mirror-hero', 'video'), media('mirror-background', 'image'), media('mirror-texture', 'image')]
    const frame = resolveCanvasPerformanceFrame({
      context: contextAt(10),
      settings: settings({
        programId: 'canvas-cinematic-bass-editor',
        compositionPreference: 'mirroredDualClip',
        complexity: 0,
        mediaPoolIds: pool.map(item => item.id),
        mediaRolesById: {
          'mirror-hero': ['hero'],
          'mirror-background': ['background'],
          'mirror-texture': ['texture'],
        },
      }),
      mediaItems: pool,
    })

    expect(frame.layers.map(layer => layer.sourceMediaId)).toEqual(['mirror-hero', 'mirror-hero'])
  })

  it('preserves deliberate echo duplication without allowing unrelated roles to collapse onto one source', () => {
    const pool = [
      media('hero-only', 'video'),
      media('atmosphere', 'image'),
      media('texture-only', 'image'),
    ]
    const frame = resolveCanvasPerformanceFrame({
      context: contextAt(10),
      settings: settings({
        programId: 'canvas-dreamstate-media-tunnel',
        compositionPreference: 'echoTunnel',
        complexity: 0,
        mediaPoolIds: pool.map(item => item.id),
        mediaRolesById: {
          'hero-only': ['hero'],
          atmosphere: ['background'],
          'texture-only': ['texture'],
        },
      }),
      mediaItems: pool,
    })
    const hero = frame.layers.find(layer => layer.role === 'hero')
    const feedback = frame.layers.find(layer => layer.role === 'feedback')
    const texture = frame.layers.find(layer => layer.role === 'texture')

    expect(hero?.sourceMediaId).toBe('hero-only')
    expect(feedback?.sourceMediaId).toBe('hero-only')
    expect(texture?.sourceMediaId).toBe('texture-only')
  })
})

describe('CANVAS composition, playback, and transitions', () => {
  it('keeps every reference composition template within layer, decoder, and feedback bounds', () => {
    expect(Object.keys(CANVAS_COMPOSITION_TEMPLATES)).toHaveLength(12)
    for (const template of Object.values(CANVAS_COMPOSITION_TEMPLATES)) {
      expect(template.slots.length).toBeLessThanOrEqual(MAX_CANVAS_PERFORMANCE_LAYERS)
      expect(template.maxVideoDecoders).toBeLessThanOrEqual(MAX_CANVAS_ACTIVE_VIDEO_DECODERS)
      expect(template.feedbackPasses).toBeLessThanOrEqual(MAX_CANVAS_FEEDBACK_PASSES)
    }
  })

  it('resolves beat-quantized playback, phrase-aligned resets, and seek/loop-safe media phase', () => {
    const clip = media('sync-video', 'video', { durationSec: 64, bpm: 120, fps: 30 })
    const beforeBoundary = contextAt(31.9)
    const phraseBoundary = contextAt(32, beforeBoundary)
    const direct = resolveCanvasPlayback(clip, phraseBoundary, 'hero', 'hero')
    const sought = resolveCanvasPlayback(clip, contextAt(32, phraseBoundary, { seek: 'seek-2' }), 'hero', 'hero')
    const looped = resolveCanvasPlayback(clip, contextAt(32, phraseBoundary, { loop: 'loop-2' }), 'hero', 'hero')
    expect(direct.quantizeBars).toBe(8)
    expect(direct.startOnDownbeat).toBe(true)
    expect(direct.phraseAlignedReset).toBe(true)
    expect(sought.phaseSec).toBeCloseTo(direct.phaseSec, 5)
    expect(looped.phaseSec).toBeCloseTo(direct.phaseSec, 5)
  })

  it('recruits layers over musical time while bounding decoder count and effect depth', () => {
    const pool = [media('v1'), media('v2'), media('v3'), media('v4'), media('still', 'image')]
    const highComplexity = settings({
      mediaPoolIds: pool.map(item => item.id),
      compositionPreference: 'fourPanelGrid',
      complexity: 1,
      effectIntensity: 1,
    })
    const early = resolveCanvasPerformanceFrame({ context: contextAt(4), settings: highComplexity, mediaItems: pool })
    const recruited = resolveCanvasPerformanceFrame({ context: contextAt(20, early.context), settings: highComplexity, mediaItems: pool, previousFrame: early })
    expect(recruited.layers.length).toBeGreaterThanOrEqual(early.layers.length)
    expect(recruited.decoderCount).toBeLessThanOrEqual(MAX_CANVAS_ACTIVE_VIDEO_DECODERS)
    expect(recruited.layers.every(layer => layer.effectChain.length <= MAX_CANVAS_EFFECT_CHAIN_DEPTH)).toBe(true)
    expect(recruited.textureHandleCount).toBeLessThanOrEqual(MAX_CANVAS_MEDIA_HANDLES)
  })

  it.each([
    { templateId: 'fullScreenHero' as const, low: 1, medium: 3, high: 6 },
    { templateId: 'mirroredDualClip' as const, low: 2, medium: 4, high: 6 },
    { templateId: 'fourPanelGrid' as const, low: 4, medium: 5, high: 7 },
    { templateId: 'videoWall' as const, low: 4, medium: 5, high: 7 },
  ])('turns Layer Complexity into structural richness for $templateId without losing its core identity', ({ templateId, low, medium, high }: { templateId: CanvasCompositionTemplateId; low: number; medium: number; high: number }) => {
    const pool = Array.from({ length: 7 }, (_, index) => media(`richness-${index}`, 'image'))
    const base = settings({
      programId: 'canvas-cinematic-bass-editor',
      mediaPoolIds: pool.map(item => item.id),
      compositionPreference: templateId,
      motionIntensity: 0,
      effectIntensity: 0,
      cutDensity: 0,
    })
    const lowFrame = resolveCanvasPerformanceFrame({ context: contextAt(5.25), settings: { ...base, complexity: 0 }, mediaItems: pool })
    const mediumFrame = resolveCanvasPerformanceFrame({ context: contextAt(5.25), settings: { ...base, complexity: 0.5 }, mediaItems: pool })
    const highFrame = resolveCanvasPerformanceFrame({ context: contextAt(5.25), settings: { ...base, complexity: 1 }, mediaItems: pool })
    const coreSlotIds = CANVAS_COMPOSITION_TEMPLATES[templateId].coreSlotIds

    expect(lowFrame.layers).toHaveLength(low)
    expect(mediumFrame.layers).toHaveLength(medium)
    expect(highFrame.layers).toHaveLength(high)
    expect(coreSlotIds.every(id => lowFrame.layers.some(layer => layer.id === id))).toBe(true)
    expect(coreSlotIds.every(id => highFrame.layers.some(layer => layer.id === id))).toBe(true)
    expect(highFrame.template.id).toBe(templateId)
  })

  it('makes Motion Intensity produce a strong renderer-consumed 0% to 100% transform range', () => {
    const pool = [media('motion-hero', 'image')]
    const base = settings({
      programId: 'canvas-cinematic-bass-editor',
      mediaPoolIds: pool.map(item => item.id),
      compositionPreference: 'fullScreenHero',
      complexity: 0,
      effectIntensity: 0,
      cutDensity: 0,
    })
    const at = (motionIntensity: number) => resolveCanvasPerformanceFrame({
      context: contextAt(5.25),
      settings: { ...base, motionIntensity },
      mediaItems: pool,
    }).layers[0]
    const low = at(0)
    const medium = at(0.5)
    const high = at(1)
    const displacement = (layer: NonNullable<typeof low>) => (
      Math.abs(layer.x) + Math.abs(layer.y) + Math.abs(layer.rotation) / 10 + Math.abs(layer.scaleX - 1) + Math.abs(layer.crop.width - 1)
    )

    expect(displacement(low!)).toBeCloseTo(0, 6)
    expect(displacement(medium!)).toBeGreaterThan(0.01)
    expect(displacement(high!)).toBeGreaterThan(displacement(medium!) * 1.8)
  })

  it.each([
    'canvas-glitch-collage-reactor' as const,
    'canvas-dreamstate-media-tunnel' as const,
  ])('normalizes Effect Intensity endpoints through renderer-consumed effect chains for %s', (programId: CanvasPerformanceShowId) => {
    const pool = [media(`effect-${programId}`, 'image')]
    const base = settings({
      programId,
      mediaPoolIds: pool.map(item => item.id),
      compositionPreference: 'fullScreenHero',
      complexity: 0,
      motionIntensity: 0,
      cutDensity: 0,
    })
    const strength = (effectIntensity: number) => {
      const frame = resolveCanvasPerformanceFrame({ context: contextAt(5.25), settings: { ...base, effectIntensity }, mediaItems: pool })
      return frame.layers[0]?.effectChain.reduce((sum, node) => sum + node.amount, 0) ?? 0
    }

    expect(strength(0)).toBe(0)
    expect(strength(0.5)).toBeGreaterThan(0)
    expect(strength(1)).toBeGreaterThan(strength(0.5))
  })

  it('turns Cut Density into a deterministic low-to-high media-change frequency across musical opportunities', () => {
    const pool = [media('cut-a', 'image'), media('cut-b', 'image'), media('cut-c', 'image')]
    const run = (cutDensity: number) => {
      const orchestration = settings({
        programId: 'canvas-impact-cut-system',
        mediaPoolIds: pool.map(item => item.id),
        compositionPreference: 'fullScreenHero',
        complexity: 0,
        motionIntensity: 0,
        effectIntensity: 0,
        transitionDensity: 0,
        cutDensity,
      })
      let context = contextAt(4.1)
      let frame = resolveCanvasPerformanceFrame({ context, settings: orchestration, mediaItems: pool })
      let changes = 0
      for (const timeSec of [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]) {
        const nextContext = contextAt(timeSec, context)
        const nextFrame = resolveCanvasPerformanceFrame({ context: nextContext, settings: orchestration, mediaItems: pool, previousFrame: frame })
        if (nextFrame.layers[0]?.sourceMediaId !== frame.layers[0]?.sourceMediaId) changes += 1
        context = nextContext
        frame = nextFrame
      }
      return changes
    }

    const low = run(0)
    const medium = run(0.5)
    const high = run(1)
    expect(low).toBe(0)
    expect(medium).toBeGreaterThan(low)
    expect(high).toBeGreaterThan(medium)
    expect(high).toBeGreaterThanOrEqual(8)
  })

  it('turns Transition Density into a deterministic low-to-high animated-transition frequency across visual changes', () => {
    const countTransitions = (density: number) => {
      let previousContext = contextAt(4.1)
      let count = 0
      for (const timeSec of [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]) {
        const context = contextAt(timeSec, previousContext)
        const transition = resolveCanvasTransition({
          context,
          density,
          allowedIds: ['crossfade', 'push'],
          fromFrameIdentity: `from-${timeSec}`,
          toFrameIdentity: `to-${timeSec}`,
        })
        if (transition) count += 1
        previousContext = context
      }
      return count
    }

    const low = countTransitions(0)
    const medium = countTransitions(0.5)
    const high = countTransitions(1)
    expect(low).toBe(0)
    expect(medium).toBeGreaterThan(low)
    expect(high).toBeGreaterThan(medium)
    expect(high).toBe(13)
  })

  it('uses a safe transition fallback and resolves seek interruptions immediately', () => {
    expect(resolveCanvasTransitionDefinition('not-supported' as never).id).toBe('crossfade')
    const previous = contextAt(4)
    const sought = contextAt(4, previous, { seek: 'seek-new' })
    expect(resolveCanvasTransition({ context: sought, density: 1, toFrameIdentity: 'next' })).toBeNull()
  })

  it('holds media between musical decision boundaries and changes it only at the next quantized boundary', () => {
    const pool = [media('a'), media('b'), media('c')]
    const orchestration = settings({
      mediaPoolIds: pool.map(item => item.id),
      compositionPreference: 'fullScreenHero',
      cutDensity: 1,
      poolRevision: 3,
    })
    const initialContext = contextAt(4.1)
    const initial = resolveCanvasPerformanceFrame({ context: initialContext, settings: orchestration, mediaItems: pool })
    const insideContext = contextAt(7.9, initialContext)
    const inside = resolveCanvasPerformanceFrame({ context: insideContext, settings: orchestration, mediaItems: pool, previousFrame: initial })
    const boundaryContext = contextAt(8, insideContext)
    const boundary = resolveCanvasPerformanceFrame({ context: boundaryContext, settings: orchestration, mediaItems: pool, previousFrame: inside })

    expect(inside.layers[0]?.sourceMediaId).toBe(initial.layers[0]?.sourceMediaId)
    expect(boundaryContext.boundaries.performanceFourBarBoundary).toBe(true)
    expect(boundary.layers[0]?.sourceMediaId).not.toBe(inside.layers[0]?.sourceMediaId)
  })

  it('reconstructs the same deterministic scene after seeking as a fresh resolver at that position', () => {
    const pool = [media('a'), media('b'), media('c'), media('texture', 'image')]
    const orchestration = settings({ mediaPoolIds: pool.map(item => item.id), complexity: 1, poolRevision: 9 })
    const freshContext = contextAt(20, null, { seek: 'seek-target' })
    const fresh = resolveCanvasPerformanceFrame({ context: freshContext, settings: orchestration, mediaItems: pool })

    const earlierContext = contextAt(4)
    const earlier = resolveCanvasPerformanceFrame({ context: earlierContext, settings: orchestration, mediaItems: pool })
    const soughtContext = contextAt(20, earlierContext, { seek: 'seek-target' })
    const sought = resolveCanvasPerformanceFrame({ context: soughtContext, settings: orchestration, mediaItems: pool, previousFrame: earlier })

    expect(sought.layers.map(layer => [layer.role, layer.sourceMediaId])).toEqual(
      fresh.layers.map(layer => [layer.role, layer.sourceMediaId]),
    )
  })

  it('retains a user-locked layer when an automated composition no longer contains that role', () => {
    const pool = [media('hero'), media('accent'), media('texture', 'image'), media('background', 'image')]
    const firstSettings = settings({
      mediaPoolIds: pool.map(item => item.id),
      compositionPreference: 'fourPanelGrid',
      complexity: 1,
      layerLocks: { texture: true },
    })
    const firstContext = contextAt(20)
    const first = resolveCanvasPerformanceFrame({ context: firstContext, settings: firstSettings, mediaItems: pool })
    const lockedTexture = first.layers.find(layer => layer.role === 'texture')
    expect(lockedTexture?.sourceMediaId).toBeTruthy()

    const nextSettings = settings({
      ...firstSettings,
      compositionPreference: 'fullScreenHero',
      layerLocks: { texture: true },
    })
    const next = resolveCanvasPerformanceFrame({
      context: contextAt(20.1, firstContext),
      settings: nextSettings,
      mediaItems: pool,
      previousFrame: first,
    })
    expect(next.layers.find(layer => layer.role === 'texture')?.sourceMediaId).toBe(lockedTexture?.sourceMediaId)
  })

  it('preserves a ready prior source when the next deterministic source is late', () => {
    const pool = [media('ready'), media('late')]
    const initialSettings = settings({
      mediaPoolIds: pool.map(item => item.id),
      compositionPreference: 'fullScreenHero',
      mediaLocksByLayer: { hero: 'ready' },
    })
    const first = resolveCanvasPerformanceFrame({
      context: contextAt(4),
      settings: initialSettings,
      mediaItems: pool,
      isMediaReady: id => id === 'ready',
    })
    const nextSettings = settings({
      mediaPoolIds: pool.map(item => item.id),
      compositionPreference: 'fullScreenHero',
      mediaLocksByLayer: { hero: 'late' },
    })
    const next = resolveCanvasPerformanceFrame({
      context: contextAt(12, first.context),
      settings: nextSettings,
      mediaItems: pool,
      previousFrame: first,
      isMediaReady: id => id === 'ready',
    })
    expect(next.layers[0]?.sourceMediaId).toBe('ready')
    expect(next.pendingMediaIds).toContain('late')
    expect(next.fallbackUsed).toBe(true)
  })
})

describe('CANVAS preload safety and media fidelity', () => {
  it.each([
    { label: 'track replacement', nextTrack: 'track-b', nextRevision: 1 },
    { label: 'media-pool replacement', nextTrack: 'track-a', nextRevision: 2 },
  ])('rejects stale preload results after $label', async ({ nextTrack, nextRevision }) => {
    const pending = new Map<string, { signal: AbortSignal; resolve: (value: null) => void }>()
    const manager = new CanvasPreloadManager({
      maxQueue: 2,
      loader: (item, signal) => new Promise(resolve => pending.set(item.id, { signal, resolve })),
    })
    const pool = [media('a'), media('b'), media('c'), media('d')]
    manager.setScope('track-a', 1)
    manager.request(buildCanvasPreloadRequests({ mediaItems: pool, activeMediaIds: ['a'], candidateMediaIds: ['b', 'c', 'd'], trackIdentity: 'track-a', poolRevision: 1 }))
    expect(manager.getSnapshot().queued + manager.getSnapshot().loading).toBeLessThanOrEqual(4)

    manager.setScope(nextTrack, nextRevision)
    for (const value of pending.values()) {
      expect(value.signal.aborted).toBe(true)
      value.resolve(null)
    }
    await Promise.resolve()
    await Promise.resolve()
    expect(manager.getSnapshot().handles).toBe(0)
    expect(manager.getReadiness('a')).toMatchObject({ trackIdentity: nextTrack, poolRevision: nextRevision, status: 'idle' })
    manager.dispose()
  })

  it('does not hot-loop failed media loads and retries after an explicit scope revision', async () => {
    let attempts = 0
    const manager = new CanvasPreloadManager({
      loader: async () => {
        attempts += 1
        throw new Error('Unsupported codec')
      },
    })
    const item = media('bad-video')
    const request = (revision: number) => buildCanvasPreloadRequests({
      mediaItems: [item],
      activeMediaIds: [item.id],
      candidateMediaIds: [],
      trackIdentity: 'track-a',
      poolRevision: revision,
    })

    manager.setScope('track-a', 1)
    manager.request(request(1))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(manager.getReadiness(item.id)).toMatchObject({ status: 'error', error: 'Unsupported codec' })
    manager.request(request(1))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(attempts).toBe(1)

    manager.setScope('track-a', 2)
    manager.request(request(2))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(attempts).toBe(2)
    manager.dispose()
  })

  it('releases inactive video decoder handles promptly while retaining bounded image handles', async () => {
    const manager = new CanvasPreloadManager({ loader: async () => null })
    const pool = [media('video-a'), media('video-b'), media('still', 'image')]
    manager.setScope('track-a', 1)
    manager.request(buildCanvasPreloadRequests({
      mediaItems: pool,
      activeMediaIds: pool.map(item => item.id),
      candidateMediaIds: [],
      trackIdentity: 'track-a',
      poolRevision: 1,
    }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(manager.getSnapshot()).toMatchObject({ handles: 3, videoHandles: 2 })

    manager.retainOnly(['video-a'])
    expect(manager.getSnapshot()).toMatchObject({ handles: 2, videoHandles: 1 })
    expect(manager.getReadiness('video-b').status).toBe('idle')
    manager.dispose()
  })

  it('preloads only active and ranked upcoming candidates rather than the full library', () => {
    const pool = Array.from({ length: 20 }, (_, index) => media(`media-${index}`, index % 4 === 0 ? 'image' : 'video'))
    const orchestration = settings({ mediaPoolIds: pool.map(item => item.id) })
    const frame = resolveCanvasPerformanceFrame({ context: contextAt(10), settings: orchestration, mediaItems: pool })
    const candidates = getCanvasPerformancePreloadCandidates(frame, orchestration, pool)
    const requests = buildCanvasPreloadRequests({
      mediaItems: pool,
      activeMediaIds: frame.layers.map(layer => layer.sourceMediaId).filter((id): id is string => Boolean(id)),
      candidateMediaIds: candidates,
      trackIdentity: 'track-a',
      poolRevision: orchestration.poolRevision,
    })
    expect(requests.length).toBeLessThan(pool.length)
    expect(requests.length).toBeLessThanOrEqual(5)
  })

  it('continues preferring original high-quality media URLs over optional derivatives', () => {
    expect(resolveCanvasPlaybackUrl({ url: 'original-4k.mp4', proxyUrl: 'low-res-proxy.mp4' })).toBe('original-4k.mp4')
  })
})
