import { describe, expect, it, vi } from 'vitest'
import { createDefaultCinematicWorldConfig } from '../../CinematicWorldConfig'
import { DEFAULT_REACT_PRESETS } from '../../ReactTypes'
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

  constructor(private readonly result: CinematicWebGLRuntimeRenderResult = { ok: true, error: null }) {}

  render(definition: CinematicWebGLWorldDefinition, frame: CinematicFrameContext): CinematicWebGLRuntimeRenderResult {
    this.renders.push({ definition, frame })
    return this.result
  }
  reset(reason: CinematicRendererResetReason): void { this.resets.push(reason) }
  dispose(): void { this.disposed++ }
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

function makeInput(presetId = 'preset-dream-gate'): CinematicFrameContext {
  const preset = {
    ...DEFAULT_REACT_PRESETS.find(item => item.id === 'preset-dream-gate')!,
    id: presetId,
  }
  const config = createDefaultCinematicWorldConfig()
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
    beat: { hit: false, phase: 0.5, bpm: 120, kick: 0, snare: 0, downbeat: false },
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
  it('registers the four production WebGL worlds beside legacyPortal', () => {
    expect(cinematicWorldRendererRegistry.list().map(item => item.id)).toEqual([
      'legacyPortal',
      'eventHorizon',
      'infiniteCorridor',
      'fractureRift',
      'monolithGate',
    ])
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
  it('switches among all four production worlds through one WebGL runtime', () => {
    const registry = new CinematicWorldRendererRegistry()
    registry.register(canvasDefinition().definition)
    for (const definition of cinematicWorldDefinitions) registry.register(definition)
    const runtime = new RecordingWebGLRuntime()
    const host = new CinematicWorldRendererHost(makeContext(), registry, 'legacyPortal', () => runtime)
    const presetIds = [
      'preset-singularity-crown',
      'preset-cathedral-run',
      'preset-glass-wound',
      'preset-titan-seal',
    ]

    for (const presetId of presetIds) {
      const preset = DEFAULT_REACT_PRESETS.find(item => item.id === presetId)!
      const input = makeInput(presetId)
      input.preset = preset
      input.config = preset.cinematicConfig!
      input.randomSeed = input.config.seed
      input.transition = { ...input.transition, toWorld: input.config.worldMode }
      host.render(input)
    }

    expect(runtime.renders.map(item => item.definition.id)).toEqual([
      'eventHorizon',
      'infiniteCorridor',
      'fractureRift',
      'monolithGate',
    ])
    expect(runtime.disposed).toBe(0)
    host.dispose()
    expect(runtime.disposed).toBe(1)
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
    const preset = DEFAULT_REACT_PRESETS.find(item => item.id === 'preset-dream-gate')!
    const config = createDefaultCinematicWorldConfig()
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
})
