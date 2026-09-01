import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import {
  createCinematicWorldConfig,
  createDefaultCinematicWorldConfig,
  createLegacyPortalCinematicConfig,
  type CinematicWorldMode,
} from '../../CinematicWorldConfig'
import { DEFAULT_REACT_PRESETS, type ReactPreset } from '../../ReactTypes'
import {
  CINEMATIC_DIAGNOSTIC_WORLD_ID,
  CinematicWorldRendererHost,
  CinematicWorldRendererRegistry,
  cinematicInputFromReactFrame,
} from '../CinematicWorldRenderer'
import type {
  CinematicCanvasWorldDefinition,
  CinematicFrameContext,
  CinematicRendererInitializeInput,
  CinematicRendererResetReason,
  CinematicViewport,
  CinematicWebGLRuntimeLike,
  CinematicWebGLRuntimeRenderResult,
  CinematicWebGLServices,
  CinematicWebGLWorldDefinition,
  CinematicWorldRenderer,
} from '../CinematicWorldRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../reactRenderUtils'
import {
  cinematicWorldRendererRegistry,
  legacyPortalFrameScale,
  legacyPortalPerFrameDecay,
} from '../CinematicPortalRenderer'
import { diagnosticCinematicWorldDefinition } from '../cinematic/worlds/DiagnosticCinematicWorld'
import { cinematicWorldDefinitions } from '../cinematic/worlds'

interface Recorder {
  initialized: CinematicRendererInitializeInput[]
  resized: CinematicViewport[]
  rendered: CinematicFrameContext[]
  reset: CinematicRendererResetReason[]
  disposed: number
}

function createRecorder(): Recorder {
  return { initialized: [], resized: [], rendered: [], reset: [], disposed: 0 }
}

class RecordingRenderer implements CinematicWorldRenderer {
  constructor(private readonly recorder: Recorder) {}
  initialize(input: CinematicRendererInitializeInput): void { this.recorder.initialized.push(input) }
  resize(viewport: CinematicViewport): void { this.recorder.resized.push(viewport) }
  render(input: CinematicFrameContext): void { this.recorder.rendered.push(input) }
  reset(reason: CinematicRendererResetReason): void { this.recorder.reset.push(reason) }
  dispose(): void { this.recorder.disposed++ }
}

class RecordingWebGLRuntime implements CinematicWebGLRuntimeLike {
  renders: Array<{ definition: CinematicWebGLWorldDefinition; frame: CinematicFrameContext }> = []
  resets: CinematicRendererResetReason[] = []
  disposed = 0
  disposalModes: Array<'release-resources' | 'terminal-retire'> = []

  constructor(private readonly result: CinematicWebGLRuntimeRenderResult = { ok: true, error: null }) {}

  render(definition: CinematicWebGLWorldDefinition, frame: CinematicFrameContext): CinematicWebGLRuntimeRenderResult {
    this.renders.push({ definition, frame })
    return this.result
  }
  reset(reason: CinematicRendererResetReason): void { this.resets.push(reason) }
  dispose(mode: 'release-resources' | 'terminal-retire' = 'release-resources'): void {
    this.disposed++
    this.disposalModes.push(mode)
  }
}

function canvasDefinition(id: 'legacyPortal' = 'legacyPortal', recorder = createRecorder()): {
  definition: CinematicCanvasWorldDefinition
  recorder: Recorder
} {
  return {
    recorder,
    definition: {
      id,
      label: 'Legacy test renderer',
      backend: 'canvas2d',
      capabilities: {
        backend: 'canvas2d',
        cameraRigs: ['locked'],
        modulationTargets: ['glow'],
        supportsGeometryPasses: false,
        supportsFullscreenPasses: false,
        supportsTextureInputs: false,
        supportsPostProcessing: false,
        supportsFeedback: false,
      },
      create: () => new RecordingRenderer(recorder),
    },
  }
}

function webglDefinition(): CinematicWebGLWorldDefinition {
  return {
    ...diagnosticCinematicWorldDefinition,
    create: vi.fn(diagnosticCinematicWorldDefinition.create),
  }
}

function makeContext(): CanvasRenderingContext2D {
  return {
    canvas: { width: 1280, height: 720 },
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

const LIVE_CINEMATIC_PRESET = DEFAULT_REACT_PRESETS.find(
  item => item.id === 'preset-singularity-crown',
)!

function cinematicPresetFixture(id: string, worldMode: CinematicWorldMode): ReactPreset {
  return {
    ...structuredClone(LIVE_CINEMATIC_PRESET),
    id,
    name: `Fixture ${worldMode}`,
    cinematicConfig: worldMode === 'legacyPortal'
      ? createLegacyPortalCinematicConfig({ intensity: 0.7, fogDensity: 0.4 })
      : createCinematicWorldConfig(worldMode, {}),
  }
}

const LEGACY_PORTAL_FIXTURE = cinematicPresetFixture('fixture-legacy-portal', 'legacyPortal')

function makeInput(presetId = LEGACY_PORTAL_FIXTURE.id): CinematicFrameContext {
  const preset = DEFAULT_REACT_PRESETS.find(item => item.id === presetId)
    ?? (presetId === LEGACY_PORTAL_FIXTURE.id
      ? LEGACY_PORTAL_FIXTURE
      : { ...LEGACY_PORTAL_FIXTURE, id: presetId })
  const config = preset.cinematicConfig ?? createDefaultCinematicWorldConfig()
  return {
    elapsedTimeSec: 2,
    deltaTimeSec: 1 / 60,
    transportTimeSec: 12,
    frameIndex: 120,
    resolution: { width: 1280, height: 720 },
    devicePixelRatio: 1,
    audio: {
      raw: { bass: 0.4, mid: 0.3, high: 0.2, volume: 0.4 },
      smoothed: { bass: 0.4, mid: 0.3, high: 0.2, volume: 0.4 },
      spectrum: null,
      waveform: null,
    },
    beat: { hit: false, phase: 0.5, bpm: 120, kick: 0, snare: 0, transient: 0, beatIndex: -1, beatInBar: -1, barIndex: -1, barProgress: 0.5, downbeat: false },
    section: {
      type: 'verse', startSec: 8, endSec: 16, progress: 0.5, changed: false, analysis: null,
    },
    config,
    transition: {
      mode: config.transition.mode,
      active: false,
      progress: 1,
      fromWorld: null,
      toWorld: config.worldMode,
    },
    randomSeed: config.seed,
    preset,
    presetId,
    params: DEFAULT_REACT_RENDER_PARAMS,
  }
}

function makeWorldInput(worldMode: Exclude<CinematicWorldMode, 'legacyPortal'>): CinematicFrameContext {
  const preset = cinematicPresetFixture(`fixture-${worldMode}`, worldMode)
  const input = makeInput(preset.id)
  input.preset = preset
  input.config = preset.cinematicConfig!
  input.randomSeed = input.config.seed
  input.transition = { ...input.transition, toWorld: input.config.worldMode }
  return input
}

describe('legacy portal timing', () => {
  it.each([30, 60, 120])('preserves one second of movement at %i Hz', (fps) => {
    const delta = 1 / fps
    const movement = Array.from({ length: fps }, () => legacyPortalFrameScale(delta))
      .reduce((sum, frameScale) => sum + frameScale, 0)
    const decay = Array.from({ length: fps }, () => legacyPortalPerFrameDecay(0.965, delta))
      .reduce((value, multiplier) => value * multiplier, 1)

    expect(movement).toBeCloseTo(60, 10)
    expect(decay).toBeCloseTo(Math.pow(0.965, 60), 10)
  })
})

describe('CinematicWorldRendererRegistry', () => {
  it('registers all production worlds beside legacyPortal', () => {
    expect(cinematicWorldRendererRegistry.list().map(item => item.id)).toEqual([
      'legacyPortal',
      'eventHorizon',
      'infiniteCorridor',
      'fractureRift',
      'monolithGate',
      'liquidMembrane',
      'celestialCathedral',
      'mirrorDimension',
      'ancientMachine',
      'stormGateway',
      'orbitalPrismArray',
      'reactiveConstellation',
    ])
  })

  it('declares safe direction hooks for every registered production world', () => {
    for (const definition of cinematicWorldRendererRegistry.list()) {
      expect(definition.direction, `${definition.id} direction`).toBeDefined()
      expect(definition.direction?.supportedCameraRigs.length).toBeGreaterThan(0)
      expect(definition.direction?.shots.length).toBeGreaterThan(0)
      expect(definition.direction?.safeCameraRange.maxDistance).toBeGreaterThan(
        definition.direction?.safeCameraRange.minDistance ?? Number.POSITIVE_INFINITY,
      )
    }
  })

  it('resolves registered definitions and hides internal diagnostics by default', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition()
    registry.register(legacy.definition)
    registry.register(diagnosticCinematicWorldDefinition)

    expect(registry.resolve('legacyPortal')).toBe(legacy.definition)
    expect(registry.resolve(CINEMATIC_DIAGNOSTIC_WORLD_ID)).toBe(diagnosticCinematicWorldDefinition)
    expect(registry.list().map(item => item.id)).toEqual(['legacyPortal'])
    expect(registry.list({ includeInternal: true })).toHaveLength(2)
  })

  it('protects against duplicate registration', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition().definition
    registry.register(legacy)
    expect(() => registry.register(legacy)).toThrow(/already registered/)
  })
})

describe('CinematicWorldRendererHost', () => {
  it('switches through every implemented world using one WebGL runtime', () => {
    const registry = new CinematicWorldRendererRegistry()
    registry.register(canvasDefinition().definition)
    for (const definition of cinematicWorldDefinitions) registry.register(definition)
    const runtime = new RecordingWebGLRuntime()
    const host = new CinematicWorldRendererHost(makeContext(), registry, 'legacyPortal', () => runtime)
    const worldModes: Array<Exclude<CinematicWorldMode, 'legacyPortal'>> = [
      'eventHorizon',
      'infiniteCorridor',
      'fractureRift',
      'monolithGate',
      'liquidMembrane',
      'celestialCathedral',
      'mirrorDimension',
      'ancientMachine',
      'stormGateway',
      'orbitalPrismArray',
      'reactiveConstellation',
    ]

    for (const worldMode of worldModes) host.render(makeWorldInput(worldMode))

    expect(runtime.renders.map(item => item.definition.id)).toEqual([
      'eventHorizon',
      'infiniteCorridor',
      'fractureRift',
      'monolithGate',
      'liquidMembrane',
      'celestialCathedral',
      'mirrorDimension',
      'ancientMachine',
      'stormGateway',
      'orbitalPrismArray',
      'reactiveConstellation',
    ])
    expect(runtime.disposed).toBe(0)
    host.dispose()
    expect(runtime.disposed).toBe(1)
  })

  it('routes the production Orbital Prism Array preset through the canonical registry and shared runtime', () => {
    const preset = DEFAULT_REACT_PRESETS.find(item => item.id === 'preset-orbital-prism-array')
    expect(preset?.cinematicConfig?.worldMode).toBe('orbitalPrismArray')

    const runtime = new RecordingWebGLRuntime()
    const host = new CinematicWorldRendererHost(makeContext(), cinematicWorldRendererRegistry, 'legacyPortal', () => runtime)
    host.render(makeInput('preset-orbital-prism-array'))

    expect(runtime.renders).toHaveLength(1)
    expect(runtime.renders[0].definition).toBe(cinematicWorldRendererRegistry.resolve('orbitalPrismArray'))
    expect(runtime.renders[0].frame.preset.id).toBe('preset-orbital-prism-array')
    expect(runtime.renders[0].frame.musicalAudio?.values).toMatchObject({ bass: 0.4, mid: 0.3, highs: 0.2 })
    expect(runtime.renders[0].frame.modulation?.values.nodeScale).toBeGreaterThan(0)
    expect(runtime.renders[0].frame.modulation?.values.geometryRotation).toBeGreaterThan(0)
    expect(runtime.renders[0].frame.modulation?.values.edgeBrightness).toBeGreaterThan(0)
    expect(runtime.renders[0].frame.modulation?.values.impact).toBe(0)
    expect(runtime.renders[0].frame.modulation?.values.burstImpulse).toBe(0)

    host.dispose()
    expect(runtime.disposed).toBe(1)
  })

  it('disposes fullscreen and geometry worlds without allowing released resources to draw again', () => {
    const program = {
      activate: vi.fn(),
      setVec2: vi.fn(),
      setVec3: vi.fn(),
      setVec4: vi.fn(),
      setFloat: vi.fn(),
      setInt: vi.fn(),
      setMat4: vi.fn(),
    }
    const run = vi.fn()
    const drawArraysInstanced = vi.fn()
    const gl = {
      ARRAY_BUFFER: 0x8892,
      STATIC_DRAW: 0x88e4,
      DYNAMIC_DRAW: 0x88e8,
      FLOAT: 0x1406,
      FRAMEBUFFER: 0x8d40,
      COLOR_BUFFER_BIT: 0x4000,
      DEPTH_BUFFER_BIT: 0x0100,
      DEPTH_TEST: 0x0b71,
      LEQUAL: 0x0203,
      CULL_FACE: 0x0b44,
      BACK: 0x0405,
      BLEND: 0x0be2,
      SRC_ALPHA: 0x0302,
      ONE: 1,
      ONE_MINUS_SRC_ALPHA: 0x0303,
      TRIANGLES: 0x0004,
      POINTS: 0x0000,
      createVertexArray: vi.fn(() => ({} as WebGLVertexArrayObject)),
      createBuffer: vi.fn(() => ({} as WebGLBuffer)),
      bindVertexArray: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      vertexAttribDivisor: vi.fn(),
      bindFramebuffer: vi.fn(),
      viewport: vi.fn(),
      clearColor: vi.fn(),
      clearDepth: vi.fn(),
      clear: vi.fn(),
      enable: vi.fn(),
      depthFunc: vi.fn(),
      depthMask: vi.fn(),
      cullFace: vi.fn(),
      blendFunc: vi.fn(),
      drawArraysInstanced,
      disable: vi.fn(),
      deleteVertexArray: vi.fn(),
      deleteBuffer: vi.fn(),
    } as unknown as WebGL2RenderingContext
    const resources = {
      trackBuffer: vi.fn((buffer: WebGLBuffer) => buffer),
      trackVAO: vi.fn((vao: WebGLVertexArrayObject) => vao),
      untrackBuffer: vi.fn(),
      untrackVAO: vi.fn(),
    }
    const services = {
      gl,
      compiler: {},
      fullscreenPass: { run },
      resources,
      compileProgram: vi.fn(() => program),
      createFramebuffer: vi.fn(),
      createTexture: vi.fn(() => ({ uploadBytes: vi.fn(), uploadImage: vi.fn(), handle: {}, dispose: vi.fn() })),
    } as unknown as CinematicWebGLServices

    for (const definition of cinematicWorldDefinitions) {
      const frame = makeWorldInput(definition.id as Exclude<CinematicWorldMode, 'legacyPortal'>)
      const preset = frame.preset
      const world = definition.create()
      world.initialize({ services, config: frame.config, presetId: preset.id })
      world.resize({ width: 640, height: 360, dpr: 1 })
      world.render(frame, { framebuffer: null, texture: null, width: 640, height: 360 })
      const fullscreenCallsBeforeDispose = run.mock.calls.length
      const geometryCallsBeforeDispose = drawArraysInstanced.mock.calls.length
      world.dispose()
      world.render(frame, { framebuffer: null, texture: null, width: 640, height: 360 })
      expect(run.mock.calls.length, `${definition.id} fullscreen`).toBe(fullscreenCallsBeforeDispose)
      expect(drawArraysInstanced.mock.calls.length, `${definition.id} geometry`).toBe(geometryCallsBeforeDispose)
    }

    // Reactive Constellation owns a second beam program; Orbital Prism Array
    // uses one shared program for crystals, rings, and particles.
    expect(services.compileProgram).toHaveBeenCalledTimes(cinematicWorldDefinitions.length + 1)
    expect(run).toHaveBeenCalledTimes(cinematicWorldDefinitions.filter(definition => definition.capabilities.supportsFullscreenPasses).length)
    expect(drawArraysInstanced).toHaveBeenCalled()
    expect(resources.trackVAO).toHaveBeenCalledTimes(9)
    expect(resources.untrackVAO).toHaveBeenCalledTimes(9)
  })

  it('lazily initializes, resizes, renders, resets, and disposes the legacy renderer', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition()
    registry.register(legacy.definition)
    const host = new CinematicWorldRendererHost(makeContext(), registry)

    host.render(makeInput())
    host.render({ ...makeInput(), elapsedTimeSec: 3 })
    expect(legacy.recorder.initialized).toHaveLength(1)
    expect(legacy.recorder.resized).toHaveLength(1)
    expect(legacy.recorder.rendered).toHaveLength(2)

    host.reset()
    expect(legacy.recorder.reset).toContain('manualReset')
    host.dispose()
    expect(legacy.recorder.disposed).toBe(1)
  })

  it('recreates isolated renderer state on structural configuration changes', () => {
    const recorders: Recorder[] = []
    const registry = new CinematicWorldRendererRegistry()
    const definition = canvasDefinition().definition
    definition.create = () => {
      const recorder = createRecorder()
      recorders.push(recorder)
      return new RecordingRenderer(recorder)
    }
    registry.register(definition)
    const host = new CinematicWorldRendererHost(makeContext(), registry)
    const input = makeInput()

    host.render(input)
    host.render({ ...input, config: { ...input.config, seed: input.config.seed + 1 } })

    expect(recorders).toHaveLength(2)
    expect(recorders[0].reset).toEqual(['structuralConfigurationChanged'])
    expect(recorders[0].disposed).toBe(1)
  })

  it('routes an internal WebGL world through a lazily created runtime and propagates configuration', () => {
    const registry = new CinematicWorldRendererRegistry()
    registry.register(canvasDefinition().definition)
    const diagnostic = webglDefinition()
    registry.register(diagnostic)
    const runtime = new RecordingWebGLRuntime()
    const factory = vi.fn(() => runtime)
    const host = new CinematicWorldRendererHost(makeContext(), registry, 'legacyPortal', factory)
    const input = { ...makeInput(), requestedWorldId: CINEMATIC_DIAGNOSTIC_WORLD_ID }

    host.render(input)
    host.render({ ...input, elapsedTimeSec: 3 })

    expect(factory).toHaveBeenCalledTimes(1)
    expect(runtime.renders).toHaveLength(2)
    expect(runtime.renders[0].definition.id).toBe(CINEMATIC_DIAGNOSTIC_WORLD_ID)
    expect(runtime.renders[0].frame.config).toBe(input.config)
    expect(runtime.renders[0].frame.audio.smoothed.bass).toBeCloseTo(0.4)
  })

  it('disposes the WebGL runtime when switching back to legacyPortal', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition()
    registry.register(legacy.definition)
    registry.register(webglDefinition())
    const runtime = new RecordingWebGLRuntime()
    const host = new CinematicWorldRendererHost(makeContext(), registry, 'legacyPortal', () => runtime)

    host.render({ ...makeInput(), requestedWorldId: CINEMATIC_DIAGNOSTIC_WORLD_ID })
    host.render(makeInput())

    expect(runtime.disposed).toBe(1)
    expect(legacy.recorder.rendered).toHaveLength(1)
  })

  it('passes transient thumbnail ownership to the runtime factory and terminally retires it on family change', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition()
    registry.register(legacy.definition)
    registry.register(webglDefinition())
    const runtime = new RecordingWebGLRuntime()
    const factory = vi.fn(() => runtime)
    const host = new CinematicWorldRendererHost(
      makeContext(),
      registry,
      'legacyPortal',
      factory,
      'transient-thumbnail',
    )

    host.render({ ...makeInput(), requestedWorldId: CINEMATIC_DIAGNOSTIC_WORLD_ID })
    host.render(makeInput())

    expect(factory).toHaveBeenCalledWith(expect.anything(), 'transient-thumbnail')
    expect(runtime.disposalModes).toEqual(['terminal-retire'])
  })

  it('keeps ordinary live renderer cleanup resource-only and idempotent', () => {
    const registry = new CinematicWorldRendererRegistry()
    registry.register(canvasDefinition().definition)
    registry.register(webglDefinition())
    const runtime = new RecordingWebGLRuntime()
    const host = new CinematicWorldRendererHost(makeContext(), registry, 'legacyPortal', () => runtime)

    host.render({ ...makeInput(), requestedWorldId: CINEMATIC_DIAGNOSTIC_WORLD_ID })
    host.dispose()
    host.dispose()

    expect(runtime.disposalModes).toEqual(['release-resources'])
  })

  it('uses legacy routing for unregistered future worlds', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition()
    registry.register(legacy.definition)
    const host = new CinematicWorldRendererHost(makeContext(), registry)
    const input = makeInput()
    input.config = { ...input.config, worldMode: 'eventHorizon' }

    host.render(input)

    expect(legacy.recorder.initialized).toHaveLength(1)
    expect(legacy.recorder.rendered[0].config.worldMode).toBe('eventHorizon')
  })

  it('falls back to legacyPortal when WebGL2 is unsupported', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition()
    registry.register(legacy.definition)
    registry.register(webglDefinition())
    const host = new CinematicWorldRendererHost(makeContext(), registry, 'legacyPortal', () => null)

    host.render({ ...makeInput(), requestedWorldId: CINEMATIC_DIAGNOSTIC_WORLD_ID })

    expect(legacy.recorder.rendered).toHaveLength(1)
    expect(host.error).toMatch(/WebGL2 is unavailable/)
  })

  it('falls back and cleans up after failed world initialization', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition()
    registry.register(legacy.definition)
    registry.register(webglDefinition())
    const runtime = new RecordingWebGLRuntime({ ok: false, error: 'world initialize failed' })
    const host = new CinematicWorldRendererHost(makeContext(), registry, 'legacyPortal', () => runtime)

    host.render({ ...makeInput(), requestedWorldId: CINEMATIC_DIAGNOSTIC_WORLD_ID })

    expect(runtime.disposed).toBe(1)
    expect(legacy.recorder.rendered).toHaveLength(1)
    expect(host.error).toBe('world initialize failed')
  })

  it('recovers world switching after a non-recoverable shader initialization failure', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition()
    registry.register(legacy.definition)
    for (const definition of cinematicWorldDefinitions) registry.register(definition)

    const failed = new RecordingWebGLRuntime({ ok: false, error: 'shader initialize failed' })
    const recovered = new RecordingWebGLRuntime()
    const factory = vi.fn()
      .mockReturnValueOnce(failed)
      .mockReturnValueOnce(recovered)
    const host = new CinematicWorldRendererHost(makeContext(), registry, 'legacyPortal', factory)

    host.render(makeWorldInput('liquidMembrane'))
    host.render(makeWorldInput('stormGateway'))

    expect(failed.disposed).toBe(1)
    expect(legacy.recorder.rendered).toHaveLength(1)
    expect(recovered.renders.map(item => item.definition.id)).toEqual(['stormGateway'])
    expect(host.error).toBeNull()
  })

  it('keeps a recoverable context-loss runtime alive while legacyPortal draws', () => {
    const registry = new CinematicWorldRendererRegistry()
    const legacy = canvasDefinition()
    registry.register(legacy.definition)
    registry.register(webglDefinition())
    const runtime = new RecordingWebGLRuntime({
      ok: false,
      error: 'context lost',
      recoverable: true,
    })
    const host = new CinematicWorldRendererHost(makeContext(), registry, 'legacyPortal', () => runtime)

    host.render({ ...makeInput(), requestedWorldId: CINEMATIC_DIAGNOSTIC_WORLD_ID })

    expect(runtime.disposed).toBe(0)
    expect(legacy.recorder.rendered).toHaveLength(1)
  })
})

describe('cinematic frame normalization', () => {
  it('passes one normalized frame with raw audio, beat, section, transition, and deterministic seed', () => {
    const preset = LEGACY_PORTAL_FIXTURE
    const config = preset.cinematicConfig!
    const frame = cinematicInputFromReactFrame({
      W: 1920,
      H: 1080,
      dpr: 1.5,
      t: 42,
      elapsedTimeSec: 0.7,
      deltaTimeSec: 1 / 30,
      audioTime: 9,
      bpm: 128,
      beatPhase: 0.25,
      beatHit: true,
      isPlaying: true,
      audio: { bass: 0.9, mid: 0.4, high: 0.2, volume: 0.6 },
      freqData: null,
      timeDomainData: null,
      musicIntelligence: null,
      resolvedSection: { type: 'drop', startSec: 8, endSec: 16, progress: 0.125 },
      sectionChanged: true,
    }, preset, DEFAULT_REACT_RENDER_PARAMS, null, config)

    expect(frame.frameIndex).toBe(42)
    expect(frame.resolution).toEqual({ width: 1920, height: 1080 })
    expect(frame.audio.raw.bass).toBe(0.9)
    expect(frame.audio.smoothed).toEqual(frame.audio.raw)
    expect(frame.beat).toMatchObject({ hit: true, phase: 0.25, bpm: 128 })
    expect(frame.section).toMatchObject({ type: 'drop', progress: 0.125, changed: true })
    expect(frame.transition.toWorld).toBe('legacyPortal')
    expect(frame.randomSeed).toBe(config.seed)
  })
  it('uses trustworthy Music Intelligence transient and bar timing when available', () => {
    const preset = DEFAULT_REACT_PRESETS.find(item => item.id === 'preset-oracle-lock')!
    const config = preset.cinematicConfig!
    const frame = cinematicInputFromReactFrame({
      W: 1280,
      H: 720,
      dpr: 1,
      t: 120,
      elapsedTimeSec: 2,
      deltaTimeSec: 1 / 60,
      audioTime: 18,
      bpm: 128,
      beatPhase: 0.25,
      beatHit: true,
      isPlaying: true,
      audio: { bass: 0.8, mid: 0.5, high: 0.4, volume: 0.7 },
      freqData: null,
      timeDomainData: null,
      musicIntelligence: {
        ...DEFAULT_MI_FRAME,
        rhythm: {
          ...DEFAULT_MI_FRAME.rhythm,
          beatIndex: 29,
          beatInBar: 1,
          barIndex: 7,
          kickStrength: 0.82,
          snareStrength: 0.64,
          transient: 0.91,
          downbeatHit: false,
        },
      },
      resolvedSection: { type: 'build', startSec: 16, endSec: 24, progress: 0.25 },
      sectionChanged: false,
    }, preset, DEFAULT_REACT_RENDER_PARAMS, 'build', config)

    expect(frame.beat).toMatchObject({
      kick: 0.82,
      snare: 0.64,
      transient: 0.91,
      beatIndex: 29,
      beatInBar: 1,
      barIndex: 7,
      barProgress: 0.3125,
      downbeat: false,
    })
  })

})
