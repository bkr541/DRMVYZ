import { describe, expect, it, vi } from 'vitest'
import {
  CINEMATIC_CAMERA_RIGS,
  CINEMATIC_QUALITY_TIERS,
  CINEMATIC_WORLD_MODES,
  createCinematicSeededRandom,
  createDefaultCinematicWorldConfig,
  normalizeCinematicWorldConfig,
} from '../CinematicWorldConfig'
import {
  CINEMATIC_QUALITY_PROFILES,
  createCinematicSeededVariation,
} from '../CinematicWorldSettings'
import { CINEMATIC_WORLD_UI } from '../CinematicWorldsUi'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import {
  CinematicWorldRendererHost,
  CinematicWorldRendererRegistry,
  cinematicInputFromReactFrame,
  cinematicStructuralKey,
  cinematicTransitionProgress,
  type CinematicFrameContext,
  type CinematicWebGLRuntimeLike,
  type CinematicWebGLRuntimeRenderResult,
  type CinematicWebGLWorldDefinition,
} from '../renderers/CinematicWorldRenderer'
import { cinematicWorldRendererRegistry } from '../renderers/CinematicPortalRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../renderers/reactRenderUtils'
import { validateCinematicMappings } from '../renderers/cinematic/CinematicAudioModulation'
import { migrateReactStore, normalizeCinematicPresetConfiguration } from '../../../../stores/reactStore'

const liveCinematicPreset = DEFAULT_REACT_PRESETS.find(preset => preset.id === 'preset-singularity-crown')!

function frameFor(presetId = liveCinematicPreset.id): CinematicFrameContext {
  const preset = DEFAULT_REACT_PRESETS.find(item => item.id === presetId) ?? liveCinematicPreset
  const config = preset.cinematicConfig ?? createDefaultCinematicWorldConfig()
  return {
    elapsedTimeSec: 1,
    deltaTimeSec: 1 / 60,
    transportTimeSec: 1,
    isPlaying: true,
    frameIndex: 60,
    resolution: { width: 1280, height: 720 },
    devicePixelRatio: 1,
    audio: {
      raw: { bass: 0.2, mid: 0.3, high: 0.4, volume: 0.5 },
      smoothed: { bass: 0.2, mid: 0.3, high: 0.4, volume: 0.5 },
      spectrum: null,
      waveform: null,
    },
    beat: {
      hit: false, phase: 0.5, bpm: 120, kick: 0, snare: 0, transient: 0,
      beatIndex: 2, beatInBar: 2, barIndex: 0, barProgress: 0.625, downbeat: false,
    },
    section: { type: 'verse', startSec: 0, endSec: 8, progress: 0.125, changed: false, analysis: null },
    config,
    transition: { mode: config.transition.mode, active: false, progress: 1, fromWorld: null, toWorld: config.worldMode },
    randomSeed: config.seed,
    preset,
    presetId: preset.id,
    params: DEFAULT_REACT_RENDER_PARAMS,
  }
}

describe('Cinematic Worlds final preset and feature audit', () => {
  it('keeps ten WebGL worlds plus the legacy compatibility renderer', () => {
    expect(CINEMATIC_WORLD_MODES).toHaveLength(11)
    expect(CINEMATIC_WORLD_MODES.filter(mode => mode !== 'legacyPortal')).toHaveLength(10)
    expect(cinematicWorldRendererRegistry.list().map(definition => definition.id)).toEqual(CINEMATIC_WORLD_MODES)
  })

  it('validates every Cinematic Worlds preset against its renderer capabilities', () => {
    const presets = DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'cinematicPortal')
    expect(new Set(DEFAULT_REACT_PRESETS.map(preset => preset.id)).size).toBe(DEFAULT_REACT_PRESETS.length)

    for (const preset of presets) {
      const config = preset.cinematicConfig
      expect(config, preset.id).toBeDefined()
      const normalized = normalizeCinematicWorldConfig(config)
      expect(normalized, preset.id).toEqual(config)
      expect(Number.isInteger(config!.seed), preset.id).toBe(true)
      expect(config!.seed, preset.id).toBeGreaterThanOrEqual(0)
      expect(CINEMATIC_QUALITY_TIERS, preset.id).toContain(config!.qualityTier)
      expect(CINEMATIC_CAMERA_RIGS, preset.id).toContain(config!.cameraRig)
      const definition = cinematicWorldRendererRegistry.resolve(config!.worldMode)
      expect(definition, preset.id).not.toBeNull()
      expect(definition!.capabilities.cameraRigs, preset.id).toContain(config!.cameraRig)
      expect(validateCinematicMappings(config!.audioMapping.routes, definition!.capabilities.modulationTargets), preset.id).toEqual([])
    }
  })

  it('keeps structurally distinct authored presets for every world', () => {
    const retiredPresetWorldModes = new Set(['legacyPortal', 'monolithGate', 'liquidMembrane', 'celestialCathedral'])
    for (const mode of CINEMATIC_WORLD_MODES) {
      const configs = DEFAULT_REACT_PRESETS
        .filter(preset => preset.cinematicConfig?.worldMode === mode)
        .map(preset => JSON.stringify({
          worldSettings: preset.cinematicConfig?.worldSettings,
          environment: preset.cinematicConfig?.environment,
          material: preset.cinematicConfig?.material,
          cameraRig: preset.cinematicConfig?.cameraRig,
          legacy: preset.cinematicConfig?.compatibility.legacyValues,
        }))
      if (retiredPresetWorldModes.has(mode)) {
        expect(configs, mode).toEqual([])
      } else {
        expect(configs.length, mode).toBeGreaterThan(0)
        expect(new Set(configs).size, mode).toBe(configs.length)
      }
    }
  })

  it('provides readable UI metadata for every selectable world', () => {
    expect(CINEMATIC_WORLD_UI).toHaveLength(CINEMATIC_WORLD_MODES.length)
    for (const world of CINEMATIC_WORLD_UI) {
      expect(world.label.trim(), world.id).not.toBe('')
      expect(world.description.trim().length, world.id).toBeGreaterThan(12)
    }
  })

  it('makes every quality tier materially different and ordered', () => {
    const profiles = CINEMATIC_QUALITY_TIERS.map(tier => CINEMATIC_QUALITY_PROFILES[tier])
    expect(new Set(profiles.map(profile => JSON.stringify(profile))).size).toBe(profiles.length)
    expect(CINEMATIC_QUALITY_PROFILES.low.raymarchSteps).toBeLessThan(CINEMATIC_QUALITY_PROFILES.medium.raymarchSteps)
    expect(CINEMATIC_QUALITY_PROFILES.medium.raymarchSteps).toBeLessThan(CINEMATIC_QUALITY_PROFILES.high.raymarchSteps)
    expect(CINEMATIC_QUALITY_PROFILES.high.raymarchSteps).toBeLessThan(CINEMATIC_QUALITY_PROFILES.ultra.raymarchSteps)
    expect(CINEMATIC_QUALITY_PROFILES.auto.geometryScale).not.toBe(CINEMATIC_QUALITY_PROFILES.high.geometryScale)
  })

  it('keeps deterministic seeds stable through variation and serialization', () => {
    const a = createCinematicSeededVariation('eventHorizon', 99123)
    const b = createCinematicSeededVariation('eventHorizon', 99123)
    expect(a).toEqual(b)
    const randomA = createCinematicSeededRandom(42)
    const randomB = createCinematicSeededRandom(42)
    expect([randomA(), randomA(), randomA()]).toEqual([randomB(), randomB(), randomB()])
    expect(JSON.parse(JSON.stringify(frameFor().config))).toEqual(frameFor().config)
  })
})

describe('Cinematic Worlds final timing and transition audit', () => {
  it('does not rebuild GPU resources for ordinary control or preset changes', () => {
    const base = frameFor()
    const controlEdit = { ...base, config: { ...base.config, qualityTier: 'low' as const } }
    const presetEdit = { ...base, presetId: 'same-world-new-preset' }
    const seedEdit = { ...base, config: { ...base.config, seed: base.config.seed + 1 } }
    expect(cinematicStructuralKey(controlEdit)).toBe(cinematicStructuralKey(base))
    expect(cinematicStructuralKey(presetEdit)).toBe(cinematicStructuralKey(base))
    expect(cinematicStructuralKey(seedEdit)).not.toBe(cinematicStructuralKey(base))
  })

  it('uses bounded real delta time and carries suspension resets into cinematic frames', () => {
    const frame = cinematicInputFromReactFrame({
      W: 1920, H: 1080, dpr: 2, t: 4, elapsedTimeSec: 12, deltaTimeSec: 30,
      timingDiscontinuity: true, timeSec: 12, audioTime: 7, bpm: 128, beatPhase: 0.25,
      beatHit: false, isPlaying: true, audio: { bass: 0, mid: 0, high: 0, volume: 0 },
      freqData: null, timeDomainData: null, musicIntelligence: null,
    }, liveCinematicPreset, DEFAULT_REACT_RENDER_PARAMS, null, liveCinematicPreset.cinematicConfig!)
    expect(frame.deltaTimeSec).toBe(0.1)
    expect(frame.elapsedTimeSec).toBe(12)
    expect(frame.timingDiscontinuity).toBe(true)
  })

  it('calculates deterministic clamped transition progress for all easings', () => {
    expect(cinematicTransitionProgress(2, 1, 1000, 'linear')).toBe(1)
    expect(cinematicTransitionProgress(0, 1, 1000, 'linear')).toBe(0)
    expect(cinematicTransitionProgress(1.5, 1, 1000, 'easeIn')).toBeCloseTo(0.25)
    expect(cinematicTransitionProgress(1.5, 1, 1000, 'easeOut')).toBeCloseTo(0.75)
    expect(cinematicTransitionProgress(1.5, 1, 1000, 'easeInOut')).toBeCloseTo(0.5)
  })
})

describe('Cinematic Worlds final migration and failure audit', () => {
  it('migrates old names, renamed fields, camera aliases, and ephemeral references', () => {
    const normalized = normalizeCinematicWorldConfig({
      displayName: 'Event Horizon',
      randomSeed: 987,
      quality: 'medium',
      cameraMode: 'pushIn',
      maskId: 'blob:temporary-mask',
      fogDensity: 0.2,
      particleDensity: 0.7,
      settings: { coreRadius: 0.22 },
    })
    expect(normalized).toMatchObject({
      worldMode: 'eventHorizon', seed: 987, qualityTier: 'medium', cameraRig: 'dolly', customMaskId: null,
      environment: { fog: 0.2, debris: 0.7 },
    })
  })

  it('maps historical Portal payloads and remains idempotent', () => {
    const legacy = {
      ...liveCinematicPreset,
      id: 'fixture-legacy-portal',
      name: 'Legacy Portal Fixture',
      cinematicConfig: undefined,
      portalSettings: { fogDensity: 0.31, particleDensity: 0.73, oldRingSpeed: 8 },
    } as typeof liveCinematicPreset & { portalSettings: Record<string, unknown> }
    const once = normalizeCinematicPresetConfiguration(legacy)
    const twice = normalizeCinematicPresetConfiguration(once)
    expect(once.cinematicConfig?.environment).toMatchObject({ fog: 0.31, debris: 0.73 })
    expect(twice).toEqual(once)
  })

  it('keeps store migration idempotent at the final schema version', () => {
    const first = migrateReactStore({ reactPresets: [{ ...liveCinematicPreset, id: 'fixture-legacy-portal', cinematicConfig: undefined }] }, 23)
    const second = migrateReactStore(first, 26)
    expect(second).toEqual(first)
  })

  it('does not recompile a known hard-failing world on every fallback frame', () => {
    const context = {
      canvas: { width: 1280, height: 720 },
      save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const registry = new CinematicWorldRendererRegistry()
    registry.register(cinematicWorldRendererRegistry.resolve('eventHorizon')!)
    registry.register({
      id: 'legacyPortal', label: 'Test fallback', backend: 'canvas2d',
      capabilities: cinematicWorldRendererRegistry.resolve('legacyPortal')!.capabilities,
      create: () => ({ initialize: vi.fn(), resize: vi.fn(), render: vi.fn(), reset: vi.fn(), dispose: vi.fn() }),
    })
    const render = vi.fn((): CinematicWebGLRuntimeRenderResult => ({
      ok: false, error: 'hard shader failure', recoverable: false,
    }))
    const factory = vi.fn((): CinematicWebGLRuntimeLike => ({ render, reset: vi.fn(), dispose: vi.fn() }))
    const host = new CinematicWorldRendererHost(context, registry, 'legacyPortal', factory)
    const input = frameFor('preset-singularity-crown')
    host.render(input)
    host.render({ ...input, frameIndex: input.frameIndex + 1, elapsedTimeSec: input.elapsedTimeSec + 1 / 60 })
    expect(factory).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('renders a readable warning over the legacy fallback instead of a blank canvas', () => {
    const context = {
      canvas: { width: 1280, height: 720 },
      save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const runtime: CinematicWebGLRuntimeLike = {
      render: (_definition: CinematicWebGLWorldDefinition): CinematicWebGLRuntimeRenderResult => ({
        ok: false, error: 'shader compile failed', recoverable: false,
      }),
      reset: vi.fn(), dispose: vi.fn(),
    }
    const registry = new CinematicWorldRendererRegistry()
    registry.register(cinematicWorldRendererRegistry.resolve('eventHorizon')!)
    registry.register({
      id: 'legacyPortal',
      label: 'Test fallback',
      backend: 'canvas2d',
      capabilities: cinematicWorldRendererRegistry.resolve('legacyPortal')!.capabilities,
      create: () => ({
        initialize: vi.fn(), resize: vi.fn(), render: vi.fn(), reset: vi.fn(), dispose: vi.fn(),
      }),
    })
    const host = new CinematicWorldRendererHost(context, registry, 'legacyPortal', () => runtime)
    const input = frameFor('preset-singularity-crown')
    host.render(input)
    expect(context.fillText).toHaveBeenCalledWith(
      expect.stringContaining('shader compile failed'),
      expect.any(Number), expect.any(Number), expect.any(Number),
    )
    expect(host.error).toContain('shader compile failed')
  })
})
