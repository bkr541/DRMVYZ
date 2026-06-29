import { describe, expect, it } from 'vitest'
import {
  createCinematicWorldConfig,
  createDefaultCinematicWorldConfig,
  createLegacyPortalCinematicConfig,
  normalizeCinematicWorldConfig,
} from '../CinematicWorldConfig'
import {
  EVENT_HORIZON_DEFAULTS,
  IMPLEMENTED_CINEMATIC_WORLD_MODES,
  createCinematicSeededVariation,
  resolveEventHorizonSettings,
  resolveFractureRiftSettings,
  resolveInfiniteCorridorSettings,
  resolveMonolithGateSettings,
} from '../CinematicWorldSettings'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import { resolveCinematicPostProcessSettings } from '../renderers/cinematic/CinematicPostProcessingPipeline'
import type { CinematicFrameContext } from '../renderers/CinematicWorldRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../renderers/reactRenderUtils'

function makeFrame(config = createDefaultCinematicWorldConfig()): CinematicFrameContext {
  const preset = DEFAULT_REACT_PRESETS.find(item => item.id === 'preset-dream-gate')!
  return {
    elapsedTimeSec: 1,
    deltaTimeSec: 1 / 60,
    transportTimeSec: 1,
    frameIndex: 1,
    resolution: { width: 1280, height: 720 },
    devicePixelRatio: 1,
    audio: {
      raw: { bass: 0.4, mid: 0.3, high: 0.2, volume: 0.4 },
      smoothed: { bass: 0.4, mid: 0.3, high: 0.2, volume: 0.4 },
      spectrum: null,
      waveform: null,
    },
    beat: { hit: false, phase: 0.5, bpm: 120, kick: 0, snare: 0, downbeat: false },
    section: { type: 'verse', startSec: 0, endSec: 8, progress: 0.5, changed: false, analysis: null },
    config,
    transition: { mode: 'crossfade', active: false, progress: 1, fromWorld: null, toWorld: config.worldMode },
    randomSeed: config.seed,
    preset,
    presetId: preset.id,
    params: DEFAULT_REACT_RENDER_PARAMS,
  }
}

describe('world-specific cinematic configuration', () => {
  it('provides bounded defaults for each implemented world', () => {
    const event = createCinematicWorldConfig('eventHorizon', {})
    const corridor = createCinematicWorldConfig('infiniteCorridor', {})
    const fracture = createCinematicWorldConfig('fractureRift', {})
    const monolith = createCinematicWorldConfig('monolithGate', {})

    expect(resolveEventHorizonSettings(event.worldSettings)).toEqual(EVENT_HORIZON_DEFAULTS)
    expect(resolveInfiniteCorridorSettings(corridor.worldSettings).corridorDensity).toBeGreaterThan(0)
    expect(resolveFractureRiftSettings(fracture.worldSettings).openingAmount).toBeGreaterThan(0)
    expect(resolveMonolithGateSettings(monolith.worldSettings).columnCount).toBeGreaterThanOrEqual(2)
  })

  it('clamps invalid controls and falls back when the settings mode does not match the world', () => {
    const normalized = normalizeCinematicWorldConfig({
      worldMode: 'eventHorizon',
      worldSettings: {
        mode: 'fractureRift',
        settings: { openingAmount: 999 },
      },
    })
    expect(normalized.worldSettings.mode).toBe('eventHorizon')
    expect(resolveEventHorizonSettings(normalized.worldSettings)).toEqual(EVENT_HORIZON_DEFAULTS)

    const bounded = createCinematicWorldConfig('monolithGate', {
      columnCount: 100,
      ringCount: -5,
      gateScale: 99,
      openingAmount: -1,
    })
    expect(resolveMonolithGateSettings(bounded.worldSettings)).toMatchObject({
      columnCount: 9,
      ringCount: 0,
      gateScale: 1.15,
      openingAmount: 0,
    })
  })

  it('accepts lower-quality configurations without changing the selected world', () => {
    const config = createCinematicWorldConfig('infiniteCorridor', { corridorDensity: 0.4 }, {
      qualityTier: 'low',
    })
    expect(config.qualityTier).toBe('low')
    expect(config.worldMode).toBe('infiniteCorridor')
    expect(config.worldSettings.mode).toBe('infiniteCorridor')
  })

  it('preserves legacy Portal compatibility', () => {
    const legacy = createLegacyPortalCinematicConfig({ intensity: 0.6, fogDensity: 0.3 })
    expect(legacy.worldMode).toBe('legacyPortal')
    expect(legacy.worldSettings).toEqual({ mode: 'legacyPortal', settings: {} })
    expect(legacy.compatibility.legacyValues).toHaveProperty('legacyPortalControls')
  })

  it('derives deterministic seeded structural variation', () => {
    const first = createCinematicSeededVariation('eventHorizon', 98231)
    const second = createCinematicSeededVariation('eventHorizon', 98231)
    const differentSeed = createCinematicSeededVariation('eventHorizon', 98232)
    const differentWorld = createCinematicSeededVariation('fractureRift', 98231)

    expect(first).toEqual(second)
    expect(first).not.toEqual(differentSeed)
    expect(first).not.toEqual(differentWorld)
    expect(first.density).toBeGreaterThanOrEqual(0.8)
    expect(first.density).toBeLessThanOrEqual(1.2)
  })

  it('contains three structurally distinct presets per implemented world with unique IDs', () => {
    const ids = DEFAULT_REACT_PRESETS.map(preset => preset.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const mode of IMPLEMENTED_CINEMATIC_WORLD_MODES) {
      const presets = DEFAULT_REACT_PRESETS.filter(preset => preset.cinematicConfig?.worldMode === mode)
      expect(presets, mode).toHaveLength(3)
      const structuralSignatures = presets.map(preset => JSON.stringify({
        settings: preset.cinematicConfig?.worldSettings,
        cameraRig: preset.cinematicConfig?.cameraRig,
        environment: preset.cinematicConfig?.environment,
        material: preset.cinematicConfig?.material,
      }))
      expect(new Set(structuralSignatures).size, mode).toBe(3)
      expect(presets.every(preset => preset.engine === 'cinematicPortal')).toBe(true)
    }
  })

  it('applies Event Horizon bloom and chromatic post-process boosts', () => {
    const base = createCinematicWorldConfig('eventHorizon', {
      bloomBoost: 0.25,
      chromaticAberrationBoost: 0.2,
    }, {
      material: { bloom: 0.4, glow: 0.4, chromaticAberration: 0.1 },
    })
    const settings = resolveCinematicPostProcessSettings(makeFrame(base))
    expect(settings.bloom).toBeCloseTo(0.65)
    expect(settings.chromaticAberration).toBeCloseTo(0.3)
  })
})
