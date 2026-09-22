import { describe, expect, it, vi } from 'vitest'

import { createCinemaMockWebGL, type CinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  cinema2StableId,
  type Cinema2Color,
  type Cinema2JsonValue,
  type Cinema2ModuleId,
  type Cinema2ModuleManifest,
} from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS,
  CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID,
  CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_VERSION,
  cinema2InterlockLiquidLightModuleDefinition,
  deriveCinema2InterlockLiquidLightPalette,
} from '../modules/Cinema2InterlockLiquidLightModule'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleFrameReadContext,
  Cinema2ModuleResourceFacet,
} from '../modules/Cinema2ModuleContracts'

const MODULE_ID = cinema2StableId<Cinema2ModuleId>('interlock-liquid-light-test')
const LED_COLOR = Object.freeze([0.94, 0.98, 1, 1]) as Cinema2Color
const BASE_PARAMETERS: Record<string, Cinema2JsonValue> = {
  paletteMode: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.paletteMode,
  ledColor: LED_COLOR,
  backgroundColor: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundColor,
  backgroundAccent: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundAccent,
  atmosphere: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.atmosphere,
  flow: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.flow,
  centerGlow: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.centerGlow,
  edgeDarkness: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.edgeDarkness,
  backgroundEnergy: 0,
  backgroundBassExpansion: 0,
  backgroundFlux: 0,
  backgroundBuild: 0,
  backgroundDropImpact: 0,
  backgroundVocalRestraint: 0,
  bpmSync: CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.bpmSync,
}

class TestResources implements Cinema2ModuleResourceFacet {
  private readonly leases = new Map<string, { value: unknown; dispose: (value: never) => void }>()

  constructor(private readonly gl: WebGL2RenderingContext) {}

  acquire<T>(key: string, _kind: string, create: (gl: WebGL2RenderingContext) => T, dispose: (value: T) => void): T {
    const existing = this.leases.get(key)
    if (existing) return existing.value as T
    const value = create(this.gl)
    this.leases.set(key, { value, dispose: dispose as (value: never) => void })
    return value
  }

  get activeLeaseCount(): number { return this.leases.size }

  disposeAll(): void {
    for (const lease of this.leases.values()) lease.dispose(lease.value as never)
    this.leases.clear()
  }
}

function createHarness(overrides: Partial<Record<string, Cinema2JsonValue>> = {}) {
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
  const parameters: Record<string, Cinema2JsonValue> = { ...BASE_PARAMETERS, ...overrides }
  const module: Cinema2ModuleManifest = {
    id: MODULE_ID,
    typeId: CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID,
    version: CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_VERSION,
    parameters,
  }
  const resources = new TestResources(gl)
  const parameterFacet = {
    getAuthored: (name: string) => parameters[name],
    get: (name: string) => parameters[name],
    resolve: () => null,
  }
  const targetFacet = {
    getTarget: () => null,
    resolve: () => ({ ok: false, value: undefined, target: null, contributions: [], diagnostics: [] }) as never,
    dispatch: () => ({ applied: false, diagnostics: [] }) as never,
  }
  const context: Cinema2ModuleCreateContext = {
    module,
    parameters: parameterFacet,
    targets: targetFacet,
    media: { get: () => null, getSlot: () => null },
    resources,
    randomness: {
      sample: () => 0.5,
      probability: (_purpose, probability) => probability > 0.5,
      stream: () => ({ next: () => 0.5, nextInt: () => 0, probability: () => false }) as never,
      eventStream: () => ({ next: () => 0.5, nextInt: () => 0, probability: () => false }) as never,
    },
  }
  const instance = cinema2InterlockLiquidLightModuleDefinition.create(context)
  const provider = instance.render?.providers[0]
  if (!provider) throw new Error('Expected Interlock liquid-light render provider')
  return { gl, parameters, resources, parameterFacet, targetFacet, instance, provider, module }
}

function frame(options: Partial<Cinema2ModuleFrameReadContext> & { timeSec?: number } = {}): Cinema2ModuleFrameReadContext {
  const timeSec = options.timeSec ?? options.elapsedTimeSec ?? 0
  return {
    frameId: options.frameId ?? 1,
    timestampMs: options.timestampMs ?? timeSec * 1000,
    deltaTimeSec: options.deltaTimeSec ?? 1 / 60,
    elapsedTimeSec: options.elapsedTimeSec ?? timeSec,
    viewport: options.viewport ?? { width: 1280, height: 720, dpr: 1 },
    contextGeneration: options.contextGeneration ?? 1,
    transport: options.transport ?? {
      sourcePresent: true,
      playing: true,
      analysisActive: true,
      paused: false,
      animationActive: true,
      trackId: 'track-a',
      timeSec,
    },
    audio: options.audio ?? null,
    director: options.director ?? null,
  }
}

function update(harness: ReturnType<typeof createHarness>, currentFrame: Cinema2ModuleFrameReadContext): void {
  harness.instance.lifecycle.update({ frame: currentFrame, parameters: harness.parameterFacet, targets: harness.targetFacet })
}

function execute(harness: ReturnType<typeof createHarness>, currentFrame: Cinema2ModuleFrameReadContext): void {
  harness.provider.execute({
    frame: currentFrame,
    target: null,
    width: currentFrame.viewport.width,
    height: currentFrame.viewport.height,
    depthAvailable: false,
  })
}

function uniformFloat(gl: CinemaMockWebGL, name: string): number | undefined {
  const calls = (gl.uniform1f as unknown as { mock: { calls: unknown[][] } }).mock.calls
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const location = calls[index]?.[0] as { name?: string } | undefined
    if (location?.name === name) return Number(calls[index]?.[1])
  }
  return undefined
}

function uniformVec3(gl: CinemaMockWebGL, name: string): readonly number[] | undefined {
  const calls = (gl.uniform3f as unknown as { mock: { calls: unknown[][] } }).mock.calls
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const location = calls[index]?.[0] as { name?: string } | undefined
    if (location?.name === name) return [Number(calls[index]?.[1]), Number(calls[index]?.[2]), Number(calls[index]?.[3])]
  }
  return undefined
}

describe('Cinema 2.0 Interlock liquid-light native module', () => {
  it('validates the canonical parameter contract and rejects malformed authored values', () => {
    const valid = createHarness()
    expect(cinema2InterlockLiquidLightModuleDefinition.validate(valid.module)).toEqual([])
    valid.instance.lifecycle.dispose()
    valid.resources.disposeAll()

    const malformed: Cinema2ModuleManifest = {
      id: MODULE_ID,
      typeId: CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID,
      version: CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_VERSION,
      parameters: { ...BASE_PARAMETERS, atmosphere: 2, paletteMode: 'invalid' },
    }
    const diagnostics = cinema2InterlockLiquidLightModuleDefinition.validate(malformed)
    expect(diagnostics.map(item => item.code)).toEqual(expect.arrayContaining([
      'CINEMA2_INTERLOCK_LIQUID_LIGHT_PARAMETER_INVALID',
      'CINEMA2_INTERLOCK_LIQUID_LIGHT_PALETTE_MODE_INVALID',
    ]))
  })

  it('renders with engine-owned reusable resources and consumes live atmosphere/palette changes', () => {
    const harness = createHarness()
    const first = frame({ timeSec: 1, deltaTimeSec: 0.25 })
    update(harness, first)
    execute(harness, first)
    expect(harness.resources.activeLeaseCount).toBe(2)
    expect(uniformFloat(harness.gl, 'u_atmosphere')).toBeCloseTo(0.25)
    expect(uniformFloat(harness.gl, 'u_flow')).toBeCloseTo(0.18)
    expect(uniformVec3(harness.gl, 'u_accentColor')).toEqual(expect.arrayContaining([expect.any(Number)]))

    harness.parameters.atmosphere = 1
    harness.parameters.ledColor = [1, 0, 0, 1]
    const second = frame({ timeSec: 1.1, deltaTimeSec: 0.1, frameId: 2 })
    update(harness, second)
    execute(harness, second)
    expect(uniformFloat(harness.gl, 'u_atmosphere')).toBeCloseTo(1)
    const expected = deriveCinema2InterlockLiquidLightPalette([1, 0, 0, 1])
    expect(uniformVec3(harness.gl, 'u_baseColor')).toEqual(expect.arrayContaining(expected.base.slice(0, 3)))
    expect(uniformVec3(harness.gl, 'u_accentColor')).toEqual(expect.arrayContaining(expected.accent.slice(0, 3)))
    expect(harness.resources.activeLeaseCount).toBe(2)
    expect(harness.gl.__calls.createdPrograms).toBe(1)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('freezes flow while paused and across seek/context discontinuities, then resumes from the same phase', () => {
    const harness = createHarness()
    const playing = frame({ timeSec: 1, deltaTimeSec: 1 })
    update(harness, playing)
    execute(harness, playing)
    const initial = uniformFloat(harness.gl, 'u_time')
    expect(initial).toBeGreaterThan(0)

    const paused = frame({
      timeSec: 5,
      deltaTimeSec: 4,
      frameId: 2,
      transport: {
        sourcePresent: true,
        playing: false,
        analysisActive: true,
        paused: true,
        animationActive: false,
        trackId: 'track-a',
        timeSec: 5,
      },
    })
    update(harness, paused)
    execute(harness, paused)
    expect(uniformFloat(harness.gl, 'u_time')).toBe(initial)

    const seekBack = frame({ timeSec: 0.5, deltaTimeSec: 2, frameId: 3 })
    update(harness, seekBack)
    execute(harness, seekBack)
    expect(uniformFloat(harness.gl, 'u_time')).toBe(initial)

    const contextRestore = frame({ timeSec: 0.6, deltaTimeSec: 2, frameId: 4, contextGeneration: 2 })
    update(harness, contextRestore)
    execute(harness, contextRestore)
    expect(uniformFloat(harness.gl, 'u_time')).toBe(initial)

    const resumed = frame({ timeSec: 0.85, deltaTimeSec: 0.25, frameId: 5, contextGeneration: 2 })
    update(harness, resumed)
    execute(harness, resumed)
    expect(uniformFloat(harness.gl, 'u_time')).toBeGreaterThan(initial ?? 0)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('uses musical beat position for liquid-light flow when global Sync BPM is enabled', () => {
    const at60 = createHarness()
    const at180 = createHarness()
    const syncedTransport60 = {
      sourcePresent: true,
      playing: true,
      analysisActive: true,
      paused: false,
      animationActive: true,
      trackId: 'track-a',
      timeSec: 4,
      bpmSync: true,
      bpm: 60,
    }
    const syncedTransport180 = { ...syncedTransport60, timeSec: 4 / 3, bpm: 180 }

    update(at60, frame({ timeSec: 4, deltaTimeSec: 0, transport: syncedTransport60 }))
    execute(at60, frame({ timeSec: 4, deltaTimeSec: 0, transport: syncedTransport60 }))
    update(at180, frame({ timeSec: 4 / 3, deltaTimeSec: 0, transport: syncedTransport180 }))
    execute(at180, frame({ timeSec: 4 / 3, deltaTimeSec: 0, transport: syncedTransport180 }))

    expect(uniformFloat(at60.gl, 'u_time')).toBeCloseTo(uniformFloat(at180.gl, 'u_time') ?? -1, 6)

    at60.instance.lifecycle.dispose()
    at60.resources.disposeAll()
    at180.instance.lifecycle.dispose()
    at180.resources.disposeAll()
  })

})
