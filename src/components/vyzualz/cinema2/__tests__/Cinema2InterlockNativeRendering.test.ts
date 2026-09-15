import { describe, expect, it, vi } from 'vitest'

import { createCinemaMockWebGL, type CinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  cinema2StableId,
  type Cinema2JsonValue,
  type Cinema2ModuleId,
  type Cinema2ModuleManifest,
} from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_INTERLOCK_NATIVE_DEFAULTS,
  CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID,
  CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION,
  cinema2InterlockNativeModuleDefinition,
} from '../modules/Cinema2InterlockNativeModule'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleFrameReadContext,
  Cinema2ModuleResourceFacet,
} from '../modules/Cinema2ModuleContracts'
import {
  CINEMA2_INTERLOCK_FIXTURE_COUNT,
  CINEMA2_INTERLOCK_PATTERN_IDS,
} from '../modules/interlock/Cinema2InterlockDomain'
import { resolveCinema2InterlockLayout } from '../modules/interlock/Cinema2InterlockGeometry'

const MODULE_ID = cinema2StableId<Cinema2ModuleId>('interlock-native-test')
const BASE_PARAMETERS: Record<string, Cinema2JsonValue> = {
  pattern: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.pattern,
  ledColor: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.ledColor,
  ledIntensity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.ledIntensity,
  rotationAmount: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.rotationAmount,
  morphDuration: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.morphDuration,
  symmetry: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.symmetry,
  segmentPattern: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentPattern,
  litDensity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.litDensity,
  segmentSpeed: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentSpeed,
  segmentFade: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentFade,
  segmentAfterglow: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentAfterglow,
  unlitVisibility: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.unlitVisibility,
  mirrorSegmentDirection: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.mirrorSegmentDirection,
  segmentEnergy: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentEnergy,
  segmentImpact: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentImpact,
  segmentDirectionBias: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentDirectionBias,
  segmentBankPhase: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentBankPhase,
  effectsIntensity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.effectsIntensity,
}

class TestResources implements Cinema2ModuleResourceFacet {
  private readonly leases = new Map<string, { value: unknown; dispose: (value: never) => void }>()
  private disposedLeaseCount = 0

  constructor(private readonly gl: WebGL2RenderingContext) {}

  acquire<T>(key: string, _kind: string, create: (gl: WebGL2RenderingContext) => T, dispose: (value: T) => void): T {
    const existing = this.leases.get(key)
    if (existing) return existing.value as T
    const value = create(this.gl)
    this.leases.set(key, { value, dispose: dispose as (value: never) => void })
    return value
  }

  getSnapshot() {
    return { activeLeaseCount: this.leases.size, disposedLeaseCount: this.disposedLeaseCount }
  }

  disposeAll(): void {
    for (const lease of this.leases.values()) {
      lease.dispose(lease.value as never)
      this.disposedLeaseCount += 1
    }
    this.leases.clear()
  }
}

function createHarness(overrides: Partial<Record<string, Cinema2JsonValue>> = {}) {
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
  const parameters: Record<string, Cinema2JsonValue> = { ...BASE_PARAMETERS }
  for (const [name, value] of Object.entries(overrides)) {
    if (value !== undefined) parameters[name] = value
  }
  const module: Cinema2ModuleManifest = {
    id: MODULE_ID,
    typeId: CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION,
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
  const instance = cinema2InterlockNativeModuleDefinition.create(context)
  const provider = instance.render?.providers[0]
  if (!provider) throw new Error('Expected Interlock native render provider')
  return { gl, parameters, resources, parameterFacet, targetFacet, instance, provider }
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
  harness.instance.lifecycle.update({
    frame: currentFrame,
    parameters: harness.parameterFacet,
    targets: harness.targetFacet,
  })
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

function lastMockArgument(mockFn: unknown, argumentIndex: number): unknown {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls
  return calls[calls.length - 1]?.[argumentIndex]
}

function lastInstanceCount(gl: CinemaMockWebGL): number {
  return Number(lastMockArgument(gl.drawArraysInstanced, 3) ?? 0)
}

function lastUploadedInstances(gl: CinemaMockWebGL): readonly number[] {
  const value = lastMockArgument(gl.bufferSubData, 2)
  return value instanceof Float32Array ? Object.freeze(Array.from(value)) : Object.freeze([])
}

function shaderSources(gl: CinemaMockWebGL): readonly string[] {
  const calls = (gl.shaderSource as unknown as { mock: { calls: unknown[][] } }).mock.calls
  return calls.map(call => String(call[1] ?? ''))
}

function lastUniformFloat(gl: CinemaMockWebGL, name: string): number | undefined {
  const calls = (gl.uniform1f as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .filter(call => (call[0] as { name?: string } | null)?.name === name)
  return calls.length > 0 ? calls[calls.length - 1]?.[1] as number | undefined : undefined
}

function lastUniformInt(gl: CinemaMockWebGL, name: string): number | undefined {
  const calls = (gl.uniform1i as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .filter(call => (call[0] as { name?: string } | null)?.name === name)
  return calls.length > 0 ? calls[calls.length - 1]?.[1] as number | undefined : undefined
}

function lastUniformColor(gl: CinemaMockWebGL, name: string): readonly number[] | undefined {
  const calls = (gl.uniform4f as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .filter(call => (call[0] as { name?: string } | null)?.name === name)
  const call = calls.at(-1)
  return call ? [Number(call[1]), Number(call[2]), Number(call[3]), Number(call[4])] : undefined
}

function finishTransition(
  harness: ReturnType<typeof createHarness>,
  pattern: typeof CINEMA2_INTERLOCK_PATTERN_IDS[number],
  startSec: number,
  viewport = { width: 1280, height: 720, dpr: 1 },
): readonly number[] {
  harness.parameters.pattern = pattern
  update(harness, frame({ timeSec: startSec, deltaTimeSec: 0, viewport }))
  update(harness, frame({ timeSec: startSec + 8, deltaTimeSec: 8, viewport, frameId: 2 }))
  const currentFrame = frame({ timeSec: startSec + 8, deltaTimeSec: 0, viewport, frameId: 3 })
  execute(harness, currentFrame)
  expect(lastInstanceCount(harness.gl), pattern).toBe(CINEMA2_INTERLOCK_FIXTURE_COUNT)
  return lastUploadedInstances(harness.gl)
}

describe('Cinema 2.0 Interlock native LED renderer', () => {
  it('validates its exact segmented module contract and rejects malformed or placeholder configuration', () => {
    const valid: Cinema2ModuleManifest = {
      id: MODULE_ID,
      typeId: CINEMA2_INTERLOCK_NATIVE_MODULE_TYPE_ID,
      version: CINEMA2_INTERLOCK_NATIVE_MODULE_VERSION,
      parameters: BASE_PARAMETERS,
    }
    expect(cinema2InterlockNativeModuleDefinition.validate?.(valid)).toEqual([])
    expect(cinema2InterlockNativeModuleDefinition.validate?.({
      ...valid,
      parameters: { ...BASE_PARAMETERS, ledIntensity: 2, segmentPattern: 'nope', litDensity: 4, futureSegmentControl: 1 },
      config: { placeholder: true },
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_INTERLOCK_NORMALIZED_PARAMETER_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_INTERLOCK_MODULE_PARAMETER_UNKNOWN' }),
      expect.objectContaining({ code: 'CINEMA2_INTERLOCK_SEGMENT_PATTERN_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_INTERLOCK_SEGMENT_PARAMETER_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_INTERLOCK_MODULE_CONFIG_UNSUPPORTED' }),
    ]))
  })

  it('uses one instanced finite-fixture pipeline, clears transparent outside the bars, and submits exactly 28 visible instances', () => {
    const harness = createHarness()
    const currentFrame = frame({ timeSec: 0 })
    update(harness, currentFrame)
    execute(harness, currentFrame)

    const sources = shaderSources(harness.gl)
    const fragment = sources.find(source => source.includes('roundedBoxSdf')) ?? ''
    expect(fragment).toContain('float roundedBoxSdf')
    expect(fragment).toContain('segmentProgramMask')
    expect(fragment).toContain('float cellShape')
    expect(fragment).toContain('vec3 coreColor')
    expect(fragment).toContain('outColor = vec4(rgb * alpha, alpha);')
    expect(lastInstanceCount(harness.gl)).toBe(CINEMA2_INTERLOCK_FIXTURE_COUNT)
    expect(lastUploadedInstances(harness.gl)).toHaveLength(CINEMA2_INTERLOCK_FIXTURE_COUNT * 11)
    expect(harness.gl.__calls.createdPrograms).toBe(1)
    expect(harness.gl.__calls.createdBuffers).toBe(2)
    expect(harness.gl.__calls.createdVertexArrays).toBe(1)
    expect(harness.gl.clearColor).toHaveBeenCalledWith(0, 0, 0, 0)
    expect(harness.gl.clear).toHaveBeenCalledWith(harness.gl.COLOR_BUFFER_BIT)
    expect(harness.gl.blendFunc).toHaveBeenCalledWith(harness.gl.ONE, harness.gl.ONE_MINUS_SRC_ALPHA)
    expect(lastUniformFloat(harness.gl, 'uLedIntensity')).toBeCloseTo(0.78)
    expect(lastUniformColor(harness.gl, 'uLedColor')).toEqual([0.94, 0.98, 1, 1])
    expect(lastUniformInt(harness.gl, 'uSegmentProgram')).toBe(3)
    expect(lastUniformFloat(harness.gl, 'uLitDensity')).toBeCloseTo(0.65)
    expect(lastUniformFloat(harness.gl, 'uUnlitVisibility')).toBeCloseTo(0.045)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
    expect(harness.gl.__calls.deletedPrograms).toBe(1)
    expect(harness.gl.__calls.deletedBuffers).toBe(2)
    expect(harness.gl.__calls.deletedVertexArrays).toBe(1)
  })

  it('renders all five authored patterns distinctly with the same 28 fixture identities and one reused GPU lease', () => {
    const harness = createHarness({ morphDuration: 0.25 })
    const initial = frame({ timeSec: 0 })
    update(harness, initial)
    execute(harness, initial)

    const fingerprints = new Set<string>()
    let timeSec = 1
    for (const pattern of CINEMA2_INTERLOCK_PATTERN_IDS) {
      const instances = finishTransition(harness, pattern, timeSec)
      fingerprints.add(instances.map(value => value.toFixed(3)).join('|'))
      expect(harness.resources.getSnapshot().activeLeaseCount).toBe(1)
      expect(harness.gl.__calls.createdPrograms).toBe(1)
      timeSec += 10
    }
    expect(fingerprints.size).toBe(CINEMA2_INTERLOCK_PATTERN_IDS.length)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('freezes a manual morph while animation is paused and resumes without recreating the renderer', () => {
    const harness = createHarness({ morphDuration: 2 })
    update(harness, frame({ timeSec: 0 }))
    execute(harness, frame({ timeSec: 0 }))

    harness.parameters.pattern = 'mechanicalIris'
    update(harness, frame({ timeSec: 0.5, deltaTimeSec: 0.5 }))
    execute(harness, frame({ timeSec: 0.5, deltaTimeSec: 0 }))
    const beforePause = lastUploadedInstances(harness.gl)

    const pausedTransport = {
      sourcePresent: true,
      playing: false,
      analysisActive: true,
      paused: true,
      animationActive: false,
      trackId: 'track-a',
      timeSec: 1.5,
    }
    update(harness, frame({ timeSec: 1.5, deltaTimeSec: 1, transport: pausedTransport }))
    execute(harness, frame({ timeSec: 1.5, deltaTimeSec: 0, transport: pausedTransport }))
    expect(lastUploadedInstances(harness.gl)).toEqual(beforePause)

    update(harness, frame({ timeSec: 2, deltaTimeSec: 0.5 }))
    execute(harness, frame({ timeSec: 2, deltaTimeSec: 0 }))
    expect(lastUploadedInstances(harness.gl)).not.toEqual(beforePause)
    expect(harness.gl.__calls.createdPrograms).toBe(1)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('resets transient interpolation on resize, backward seek, source replacement, and context generation without changing physical dimensions', () => {
    const harness = createHarness({ morphDuration: 8 })
    const initialViewport = { width: 1280, height: 720, dpr: 1 }
    update(harness, frame({ timeSec: 10, viewport: initialViewport }))
    harness.parameters.pattern = 'fourWayVortex'
    update(harness, frame({ timeSec: 11, deltaTimeSec: 1, viewport: initialViewport }))

    const resizedViewport = { width: 960, height: 540, dpr: 1.5 }
    update(harness, frame({ timeSec: 12, deltaTimeSec: 1, viewport: resizedViewport }))
    execute(harness, frame({ timeSec: 12, viewport: resizedViewport }))
    const resetInstances = lastUploadedInstances(harness.gl)
    const expectedLayout = resolveCinema2InterlockLayout('fourWayVortex', resizedViewport)
    expect(resetInstances[0]).toBeCloseTo(expectedLayout.fixtures[0].middle[0], 4)
    expect(resetInstances[1]).toBeCloseTo(expectedLayout.fixtures[0].middle[1], 4)
    expect(lastInstanceCount(harness.gl)).toBe(CINEMA2_INTERLOCK_FIXTURE_COUNT)

    update(harness, frame({
      timeSec: 4,
      deltaTimeSec: 0,
      viewport: resizedViewport,
      transport: { sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true, trackId: 'track-a', timeSec: 4 },
    }))
    update(harness, frame({
      timeSec: 5,
      deltaTimeSec: 0,
      viewport: resizedViewport,
      contextGeneration: 2,
      transport: { sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true, trackId: 'track-b', timeSec: 5 },
    }))
    execute(harness, frame({ timeSec: 5, viewport: resizedViewport, contextGeneration: 2 }))
    expect(lastInstanceCount(harness.gl)).toBe(CINEMA2_INTERLOCK_FIXTURE_COUNT)
    expect(harness.gl.__calls.createdPrograms).toBe(1)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('consumes live color/intensity changes without a duplicate runtime or GPU resource set', () => {
    const harness = createHarness()
    const currentFrame = frame({ timeSec: 0 })
    update(harness, currentFrame)
    execute(harness, currentFrame)

    harness.parameters.ledColor = [0.15, 0.8, 1, 1]
    harness.parameters.ledIntensity = 0.33
    update(harness, frame({ timeSec: 1 }))
    execute(harness, frame({ timeSec: 1 }))

    expect(lastUniformColor(harness.gl, 'uLedColor')).toEqual([0.15, 0.8, 1, 1])
    expect(lastUniformFloat(harness.gl, 'uLedIntensity')).toBeCloseTo(0.33)
    expect(harness.resources.getSnapshot().activeLeaseCount).toBe(1)
    expect(harness.gl.__calls.createdPrograms).toBe(1)
    expect(harness.gl.__calls.drawInstancedCount).toBe(2)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('switches all nine segment programs live while preserving one bounded 28-instance GPU pipeline', () => {
    const harness = createHarness()
    let timeSec = 0
    const fingerprints = new Set<number>()
    const programs = ['solid', 'forwardChase', 'reverseChase', 'centerOut', 'edgeIn', 'alternating', 'audioMeterFill', 'bankRipple', 'impactBurst'] as const
    for (const [index, program] of programs.entries()) {
      harness.parameters.segmentPattern = program
      const current = frame({ timeSec, deltaTimeSec: index === 0 ? 0 : 0.25, frameId: index + 1 })
      update(harness, current)
      execute(harness, current)
      fingerprints.add(lastUniformInt(harness.gl, 'uSegmentProgram') ?? -1)
      expect(lastInstanceCount(harness.gl)).toBe(CINEMA2_INTERLOCK_FIXTURE_COUNT)
      expect(harness.resources.getSnapshot().activeLeaseCount).toBe(1)
      timeSec += 0.25
    }
    expect(fingerprints.size).toBe(9)
    expect(harness.gl.__calls.createdPrograms).toBe(1)
    expect(harness.gl.__calls.createdBuffers).toBe(2)
    expect(harness.gl.__calls.createdVertexArrays).toBe(1)
    expect(harness.gl.__calls.drawInstancedCount).toBe(9)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('freezes deterministic segment phase while paused and resumes without a phase jump', () => {
    const harness = createHarness({ segmentPattern: 'forwardChase', segmentSpeed: 0.5 })
    const playing = frame({ timeSec: 1, deltaTimeSec: 1 })
    update(harness, playing)
    execute(harness, playing)
    const beforePause = lastUniformFloat(harness.gl, 'uSegmentPhase')

    const pausedTransport = {
      sourcePresent: true,
      playing: false,
      analysisActive: true,
      paused: true,
      animationActive: false,
      trackId: 'track-a',
      timeSec: 5,
    }
    const paused = frame({ timeSec: 5, deltaTimeSec: 4, transport: pausedTransport, frameId: 2 })
    update(harness, paused)
    execute(harness, paused)
    expect(lastUniformFloat(harness.gl, 'uSegmentPhase')).toBe(beforePause)

    const resumed = frame({ timeSec: 5.25, deltaTimeSec: 0.25, frameId: 3 })
    update(harness, resumed)
    execute(harness, resumed)
    expect(lastUniformFloat(harness.gl, 'uSegmentPhase')).not.toBe(beforePause)
    expect(harness.gl.__calls.createdPrograms).toBe(1)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('uses stable 24/32/48 cell metadata and mirrors segment direction without altering geometry', () => {
    const harness = createHarness({ mirrorSegmentDirection: true })
    const current = frame({ timeSec: 0 })
    update(harness, current)
    execute(harness, current)
    const mirrored = lastUploadedInstances(harness.gl)
    const cells = new Set<number>()
    const directions = new Set<number>()
    for (let index = 0; index < CINEMA2_INTERLOCK_FIXTURE_COUNT; index += 1) {
      cells.add(mirrored[index * 11 + 7]!)
      directions.add(mirrored[index * 11 + 8]!)
    }
    expect([...cells].sort((a, b) => a - b)).toEqual([24, 32, 48])
    expect([...directions].sort()).toEqual([-1, 1])

    harness.parameters.mirrorSegmentDirection = false
    update(harness, frame({ timeSec: 0.1, frameId: 2 }))
    execute(harness, frame({ timeSec: 0.1, frameId: 2 }))
    const synchronized = lastUploadedInstances(harness.gl)
    for (let index = 0; index < CINEMA2_INTERLOCK_FIXTURE_COUNT; index += 1) {
      expect(synchronized[index * 11 + 8]).toBe(1)
      expect(synchronized[index * 11]).toBeCloseTo(mirrored[index * 11]!, 5)
      expect(synchronized[index * 11 + 1]).toBeCloseTo(mirrored[index * 11 + 1]!, 5)
    }

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('maps Effects Intensity monotonically into LED afterglow and impact without rebuilding GPU resources', () => {
    const harness = createHarness({ segmentAfterglow: 0.8, segmentImpact: 0.6, effectsIntensity: 0 })
    const first = frame({ timeSec: 0 })
    update(harness, first)
    execute(harness, first)
    expect(lastUniformFloat(harness.gl, 'uSegmentAfterglow')).toBeCloseTo(0)
    expect(lastUniformFloat(harness.gl, 'uSegmentImpact')).toBeCloseTo(0)

    harness.parameters.effectsIntensity = 0.35
    const middle = frame({ timeSec: 0.1, frameId: 2 })
    update(harness, middle)
    execute(harness, middle)
    expect(lastUniformFloat(harness.gl, 'uSegmentAfterglow')).toBeCloseTo(0.28)
    expect(lastUniformFloat(harness.gl, 'uSegmentImpact')).toBeCloseTo(0.21)

    harness.parameters.effectsIntensity = 1
    const full = frame({ timeSec: 0.2, frameId: 3 })
    update(harness, full)
    execute(harness, full)
    expect(lastUniformFloat(harness.gl, 'uSegmentAfterglow')).toBeCloseTo(0.8)
    expect(lastUniformFloat(harness.gl, 'uSegmentImpact')).toBeCloseTo(0.6)
    expect(harness.resources.getSnapshot().activeLeaseCount).toBe(1)
    expect(harness.gl.__calls.createdPrograms).toBe(1)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

})
