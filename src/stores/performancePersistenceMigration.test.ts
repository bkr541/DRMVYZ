import { describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS_ORCHESTRATION_SETTINGS } from '../components/vyzualz/react/canvasPerformance/CanvasPerformanceTypes'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from '../components/vyzualz/react/soundDrawing/SoundDrawingPerformanceTypes'
import {
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
      locks: { generator: true, transform: true, unknown: true },
      runtimeFrame: { stale: true },
      activeEnvelopes: ['stale'],
    })

    expect(normalized.selectedShowId).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.selectedShowId)
    expect(normalized.generatorPreference).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.generatorPreference)
    expect(normalized.complexity).toBe(1)
    expect(normalized.motionIntensity).toBe(0)
    expect(normalized.reactionIntensity).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.reactionIntensity)
    expect(normalized.trailIntensity).toBe(0.42)
    expect(normalized.locks.generator).toBe(true)
    expect(normalized.locks.transform).toBe(true)
    expect(normalized).not.toHaveProperty('runtimeFrame')
    expect(normalized).not.toHaveProperty('activeEnvelopes')
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
