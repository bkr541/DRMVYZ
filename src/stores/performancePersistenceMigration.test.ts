import { describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS_ORCHESTRATION_SETTINGS } from '../components/vyzualz/react/canvasPerformance/CanvasPerformanceTypes'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from '../components/vyzualz/react/soundDrawing/SoundDrawingPerformanceTypes'
import {
  migrateReactStore,
  normalizeCanvasOrchestrationSettings,
  normalizeSoundDrawingPerformanceSettings,
} from './reactStore'

describe('performance settings persistence migration', () => {
  it('repairs obsolete and corrupt Sound Drawing settings without persisting volatile runtime state', () => {
    const normalized = normalizeSoundDrawingPerformanceSettings({
      selectedShowId: 'retired-show',
      autoPerformance: true,
      complexity: 4,
      motionIntensity: -2,
      reactionIntensity: Number.NaN,
      trailIntensity: 0.42,
      generatorPreference: 'retired-generator',
      performanceSource: 'retired-source',
      sourceTreatment: 'retired-treatment',
      useSourceAs: 'retired-policy',
      preserveIdentity: false,
      contourReactivity: 3,
      wholeObjectMotion: -1,
      echoStrength: Number.POSITIVE_INFINITY,
      sourceTrailStrength: 0.31,
      supportingVisualReactivity: Number.NaN,
      locks: { generator: true, transform: true, sourceSelection: true, contourReactivity: true, unknown: true },
      runtimeFrame: { stale: true },
      activeEnvelopes: ['stale'],
    })

    expect(normalized.selectedShowId).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.selectedShowId)
    expect(normalized.generatorPreference).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.generatorPreference)
    expect(normalized.complexity).toBe(1)
    expect(normalized.motionIntensity).toBe(0)
    expect(normalized.reactionIntensity).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.reactionIntensity)
    expect(normalized.trailIntensity).toBe(0.42)
    expect(normalized.performanceSource).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.performanceSource)
    expect(normalized.sourceTreatment).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.sourceTreatment)
    expect(normalized.useSourceAs).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.useSourceAs)
    expect(normalized.preserveIdentity).toBe(false)
    expect(normalized.contourReactivity).toBe(1)
    expect(normalized.wholeObjectMotion).toBe(0)
    expect(normalized.echoStrength).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.echoStrength)
    expect(normalized.sourceTrailStrength).toBe(0.31)
    expect(normalized.supportingVisualReactivity).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.supportingVisualReactivity)
    expect(normalized.locks.generator).toBe(true)
    expect(normalized.locks.transform).toBe(true)
    expect(normalized.locks.sourceSelection).toBe(true)
    expect(normalized.locks.contourReactivity).toBe(true)
    expect(normalized.locks).not.toHaveProperty('unknown')
    expect(normalized).not.toHaveProperty('runtimeFrame')
    expect(normalized).not.toHaveProperty('activeEnvelopes')
  })

  it('migrates pre-source-integration Sound Drawing settings to identity-safe defaults', () => {
    const migrated = migrateReactStore({
      soundDrawingPerformanceSettings: {
        selectedShowId: 'harmonicRibbonReactor',
        autoPerformance: true,
        complexity: 0.8,
        motionIntensity: 0.7,
        reactionIntensity: 0.9,
        trailIntensity: 0.6,
        generatorPreference: 'authored',
        locks: { generator: true },
        runtimeFrame: { stale: true },
      },
    }, 45)

    const settings = migrated.soundDrawingPerformanceSettings as typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS
    expect(settings.performanceSource).toBe('activeUserSource')
    expect(settings.sourceTreatment).toBe('preserveIdentity')
    expect(settings.useSourceAs).toBe('primaryMotif')
    expect(settings.preserveIdentity).toBe(true)
    expect(settings.locks.generator).toBe(true)
    expect(settings.locks.sourceSelection).toBe(false)
    expect(settings).not.toHaveProperty('runtimeFrame')
  })

  it('bounds CANVAS pools and controls, removes unknown locks, and falls back from retired shows', () => {
    const pool = Array.from({ length: 140 }, (_, index) => `media-${index}`)
    const normalized = normalizeCanvasOrchestrationSettings({
      enabled: true,
      autoRoleEnabled: false,
      mediaPoolIds: [...pool, 'media-1', '', null],
      mediaRolesById: { 'media-1': ['hero', 'not-a-role'] },
      mediaLocksByLayer: { hero: ' media-1 ', bogus: 'media-2' },
      layerLocks: { hero: true, bogus: true },
      globalLocks: { media: true, unknown: true },
      complexity: 2,
      transitionDensity: -1,
      effectIntensity: Number.POSITIVE_INFINITY,
      motionIntensity: 0.37,
      cutDensity: Number.NaN,
      compositionPreference: 'retired-composition',
      poolRevision: Number.POSITIVE_INFINITY,
      programId: 'retired-show',
      resolvedFrame: { stale: true },
      preloadQueue: ['stale'],
    })

    expect(normalized.enabled).toBe(true)
    expect(normalized.autoRoleEnabled).toBe(false)
    expect(normalized.mediaPoolIds).toHaveLength(128)
    expect(new Set(normalized.mediaPoolIds).size).toBe(normalized.mediaPoolIds.length)
    expect(normalized.mediaLocksByLayer).toEqual({ hero: 'media-1' })
    expect(normalized.layerLocks).toEqual({ hero: true })
    expect(normalized.globalLocks).toEqual({ media: true })
    expect(normalized.complexity).toBe(1)
    expect(normalized.transitionDensity).toBe(0)
    expect(normalized.effectIntensity).toBe(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.effectIntensity)
    expect(normalized.motionIntensity).toBe(0.37)
    expect(normalized.cutDensity).toBe(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.cutDensity)
    expect(normalized.compositionPreference).toBe(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.compositionPreference)
    expect(normalized.poolRevision).toBe(0)
    expect(normalized.programId).toBe(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId)
    expect(normalized).not.toHaveProperty('resolvedFrame')
    expect(normalized).not.toHaveProperty('preloadQueue')
  })
})
