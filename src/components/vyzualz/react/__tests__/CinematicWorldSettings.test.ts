import { describe, expect, it } from 'vitest'
import {
  createCinematicWorldConfig,
  createDefaultCinematicWorldConfig,
  createLegacyPortalCinematicConfig,
  normalizeCinematicWorldConfig,
} from '../CinematicWorldConfig'
import {
  EVENT_HORIZON_DEFAULTS,
  GEOMETRY_CINEMATIC_WORLD_MODES,
  IMPLEMENTED_CINEMATIC_WORLD_MODES,
  PACK_A_CINEMATIC_WORLD_MODES,
  PACK_B_CINEMATIC_WORLD_MODES,
  REACTIVE_CONSTELLATION_DEFAULTS,
  cinematicQualityProfile,
  createCinematicSeededVariation,
  resolveAncientMachineSettings,
  resolveCelestialCathedralSettings,
  resolveEventHorizonSettings,
  resolveFractureRiftSettings,
  resolveInfiniteCorridorSettings,
  resolveLiquidMembraneSettings,
  resolveMirrorDimensionSettings,
  resolveMonolithGateSettings,
  resolveReactiveConstellationSettings,
  resolveStormGatewaySettings,
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
    beat: {
      hit: false,
      phase: 0.5,
      bpm: 120,
      kick: 0,
      snare: 0,
      transient: 0,
      beatIndex: -1,
      beatInBar: -1,
      barIndex: -1,
      barProgress: 0.5,
      downbeat: false,
    },
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
  it('provides bounded defaults for all implemented worlds', () => {
    const event = createCinematicWorldConfig('eventHorizon', {})
    const corridor = createCinematicWorldConfig('infiniteCorridor', {})
    const fracture = createCinematicWorldConfig('fractureRift', {})
    const monolith = createCinematicWorldConfig('monolithGate', {})
    const liquid = createCinematicWorldConfig('liquidMembrane', {})
    const cathedral = createCinematicWorldConfig('celestialCathedral', {})
    const mirror = createCinematicWorldConfig('mirrorDimension', {})
    const machine = createCinematicWorldConfig('ancientMachine', {})
    const storm = createCinematicWorldConfig('stormGateway', {})
    const constellation = createCinematicWorldConfig('reactiveConstellation', {})

    expect(resolveEventHorizonSettings(event.worldSettings)).toEqual(EVENT_HORIZON_DEFAULTS)
    expect(resolveInfiniteCorridorSettings(corridor.worldSettings).corridorDensity).toBeGreaterThan(0)
    expect(resolveFractureRiftSettings(fracture.worldSettings).openingAmount).toBeGreaterThan(0)
    expect(resolveMonolithGateSettings(monolith.worldSettings).columnCount).toBeGreaterThanOrEqual(2)
    expect(resolveLiquidMembraneSettings(liquid.worldSettings).viscosity).toBeGreaterThan(0)
    expect(resolveCelestialCathedralSettings(cathedral.worldSettings).archCount).toBeGreaterThanOrEqual(3)
    expect(resolveMirrorDimensionSettings(mirror.worldSettings).symmetryCount).toBeGreaterThanOrEqual(3)
    expect(resolveAncientMachineSettings(machine.worldSettings).ringCount).toBeGreaterThanOrEqual(2)
    expect(resolveStormGatewaySettings(storm.worldSettings).cloudLayers).toBeGreaterThanOrEqual(2)
    expect(resolveReactiveConstellationSettings(constellation.worldSettings)).toEqual(REACTIVE_CONSTELLATION_DEFAULTS)
    expect(IMPLEMENTED_CINEMATIC_WORLD_MODES).toEqual([
      ...PACK_A_CINEMATIC_WORLD_MODES,
      ...PACK_B_CINEMATIC_WORLD_MODES,
      ...GEOMETRY_CINEMATIC_WORLD_MODES,
    ])
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

    const bounded = createCinematicWorldConfig('mirrorDimension', {
      symmetryCount: 100,
      recursionDepth: -5,
      feedbackAmount: 99,
      structureStyle: 8,
    })
    expect(resolveMirrorDimensionSettings(bounded.worldSettings)).toMatchObject({
      symmetryCount: 12,
      recursionDepth: 2,
      feedbackAmount: 0.55,
      structureStyle: 2,
    })

    const storm = createCinematicWorldConfig('stormGateway', {
      cloudLayers: 100,
      debrisDensity: -1,
      lightningResponse: 99,
    })
    expect(resolveStormGatewaySettings(storm.worldSettings)).toMatchObject({
      cloudLayers: 8,
      debrisDensity: 0,
      lightningResponse: 1.5,
    })

    const constellation = createCinematicWorldConfig('reactiveConstellation', {
      nodeCount: 999,
      topologyStyle: 'futureTopology',
      polyhedronStyle: 'futurePolyhedron',
      neighborCount: 4.7,
      faceOpacity: -2,
      facetContrast: 50,
      internalGlow: -1,
      rimIntensity: 50,
      colorVariation: 4,
      backgroundCurtains: -2,
      curtainDensity: 99,
      depthFade: 9,
      springStrength: 99,
      damping: -3,
      beamWidth: 99,
      beamCoreBrightness: -4,
      beamGlow: 99,
      edgeOpacity: -1,
      trailSamples: 99,
      trailDecay: 0,
      trailSpacing: 9,
      beamFanAmount: 9,
      reseedEveryBars: 17.8,
    } as never)
    expect(resolveReactiveConstellationSettings(constellation.worldSettings)).toMatchObject({
      nodeCount: 96,
      topologyStyle: REACTIVE_CONSTELLATION_DEFAULTS.topologyStyle,
      polyhedronStyle: REACTIVE_CONSTELLATION_DEFAULTS.polyhedronStyle,
      neighborCount: 5,
      faceOpacity: 0.08,
      facetContrast: 2,
      internalGlow: 0,
      rimIntensity: 2,
      colorVariation: 1,
      backgroundCurtains: 0,
      curtainDensity: 24,
      depthFade: 1.5,
      springStrength: 2,
      damping: 0,
      beamWidth: 12,
      beamCoreBrightness: 0,
      beamGlow: 3,
      edgeOpacity: 0,
      trailSamples: 32,
      trailDecay: 0.2,
      trailSpacing: 0.25,
      beamFanAmount: 2,
      reseedEveryBars: 18,
    })
  })

  it('migrates legacy constellation topology names without discarding persisted motion settings', () => {
    const normalized = createCinematicWorldConfig('reactiveConstellation', {
      topologyStyle: 'helix',
      springStrength: 1.1,
      reseedEveryBars: 12,
    } as never)

    expect(resolveReactiveConstellationSettings(normalized.worldSettings)).toMatchObject({
      topologyStyle: 'chain',
      springStrength: 1.1,
      reseedEveryBars: 12,
    })
  })

  it('migrates constellation aliases into the typed world mode and default settings', () => {
    const normalized = normalizeCinematicWorldConfig({
      worldMode: 'constellation',
      worldSettings: { mode: 'constellation', settings: { nodeCount: 48 } },
    } as never)

    expect(normalized.worldMode).toBe('reactiveConstellation')
    expect(normalized.worldSettings.mode).toBe('reactiveConstellation')
    expect(resolveReactiveConstellationSettings(normalized.worldSettings)).toEqual(REACTIVE_CONSTELLATION_DEFAULTS)
  })

  it('scales expensive work down monotonically while keeping non-zero structural budgets', () => {
    const low = cinematicQualityProfile('low')
    const medium = cinematicQualityProfile('medium')
    const high = cinematicQualityProfile('high')
    const ultra = cinematicQualityProfile('ultra')

    expect(low.raymarchSteps).toBeGreaterThan(0)
    expect(low.atmosphericLayers).toBeGreaterThanOrEqual(2)
    expect(low.geometryScale).toBeGreaterThan(0)
    expect(low.particleScale).toBeGreaterThan(0)
    expect(low.feedbackScale).toBeGreaterThan(0)
    expect([low, medium, high, ultra].map(item => item.raymarchSteps)).toEqual([12, 20, 30, 42])
    expect(low.geometryScale).toBeLessThan(medium.geometryScale)
    expect(medium.geometryScale).toBeLessThan(high.geometryScale)
    expect(high.geometryScale).toBeLessThan(ultra.geometryScale)
  })

  it('preserves the five legacy Portal presets and compatibility payloads', () => {
    const legacy = createLegacyPortalCinematicConfig({ intensity: 0.6, fogDensity: 0.3 })
    expect(legacy.worldMode).toBe('legacyPortal')
    expect(legacy.worldSettings).toEqual({ mode: 'legacyPortal', settings: {} })
    expect(legacy.compatibility.legacyValues).toHaveProperty('legacyPortalControls')

    const legacyPresetIds = DEFAULT_REACT_PRESETS
      .filter(preset => preset.cinematicConfig?.worldMode === 'legacyPortal')
      .map(preset => preset.id)
    expect(legacyPresetIds).toEqual([
      'preset-dream-gate',
      'preset-crimson-rift',
      'preset-emerald-fog',
      'preset-portal-overload',
      'preset-quiet-ruins',
    ])
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

  it('contains valid and structurally distinct presets per implemented world with unique IDs', () => {
    const ids = DEFAULT_REACT_PRESETS.map(preset => preset.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const mode of IMPLEMENTED_CINEMATIC_WORLD_MODES) {
      const presets = DEFAULT_REACT_PRESETS.filter(preset => preset.cinematicConfig?.worldMode === mode)
      expect(presets, mode).toHaveLength(mode === 'reactiveConstellation' ? 11 : 3)
      const structuralSignatures = presets.map(preset => JSON.stringify({
        settings: preset.cinematicConfig?.worldSettings,
        cameraRig: preset.cinematicConfig?.cameraRig,
        environment: preset.cinematicConfig?.environment,
        material: preset.cinematicConfig?.material,
        audioMapping: preset.cinematicConfig?.audioMapping,
      }))
      expect(new Set(structuralSignatures).size, mode).toBe(presets.length)
      expect(presets.every(preset => preset.engine === 'cinematicPortal')).toBe(true)
      for (const preset of presets) {
        const normalized = normalizeCinematicWorldConfig(preset.cinematicConfig)
        expect(normalized).toEqual(preset.cinematicConfig)
        expect(normalized.worldSettings.mode).toBe(mode)
        expect(normalized.audioMapping.routes.length).toBeGreaterThan(0)
      }
    }
  })

  it('applies Event Horizon boosts and quality-scaled guarded Mirror feedback', () => {
    const event = createCinematicWorldConfig('eventHorizon', {
      bloomBoost: 0.25,
      chromaticAberrationBoost: 0.2,
    }, {
      material: { bloom: 0.4, glow: 0.4, chromaticAberration: 0.1 },
    })
    const eventSettings = resolveCinematicPostProcessSettings(makeFrame(event))
    expect(eventSettings.bloom).toBeCloseTo(0.65)
    expect(eventSettings.chromaticAberration).toBeCloseTo(0.3)

    const mirrorLow = createCinematicWorldConfig('mirrorDimension', { feedbackAmount: 0.55 }, {
      qualityTier: 'low',
      material: { feedback: 1 },
    })
    const mirrorUltra = createCinematicWorldConfig('mirrorDimension', { feedbackAmount: 0.55 }, {
      qualityTier: 'ultra',
      material: { feedback: 1 },
    })
    const lowFeedback = resolveCinematicPostProcessSettings(makeFrame(mirrorLow)).feedback
    const ultraFeedback = resolveCinematicPostProcessSettings(makeFrame(mirrorUltra)).feedback
    expect(lowFeedback).toBeLessThan(ultraFeedback)
    expect(ultraFeedback).toBeLessThanOrEqual(0.48)
  })
})
