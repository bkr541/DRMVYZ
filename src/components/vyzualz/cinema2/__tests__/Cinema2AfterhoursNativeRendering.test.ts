import { describe, expect, it } from 'vitest'

import { createCinemaMockWebGL, type CinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  cinema2StableId,
  type Cinema2JsonValue,
  type Cinema2ModuleId,
  type Cinema2ModuleManifest,
} from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_AFTERHOURS_HARD_CUT_ACTION,
  CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID,
  CINEMA2_AFTERHOURS_NATIVE_MODULE_VERSION,
  cinema2AfterhoursNativeModuleDefinition,
} from '../modules/Cinema2AfterhoursNativeModule'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleFrameReadContext,
  Cinema2ModuleResourceFacet,
} from '../modules/Cinema2ModuleContracts'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { multiplyCinema2Matrix4, type Cinema2Matrix4 } from '../scene/Cinema2SceneGraph'
import { createCinema2PerspectiveProjection, type Cinema2CameraFrame } from '../spatial/Cinema2CameraRuntime'

const MODULE_ID = cinema2StableId<Cinema2ModuleId>('afterhours-native-test')
const BASE_PARAMETERS: Record<string, Cinema2JsonValue> = {
  pattern: 'wideFan',
  autoPerformance: false,
  beamCount: 8,
  symmetry: true,
  sideLasers: true,
  topLasers: true,
  spread: 0.65,
  colorMode: 'manual',
  primaryColor: [0.45, 0.96, 1, 1],
  accentColor: [1, 1, 1, 1],
  accentMix: 0.25,
  atmosphere: 0.55,
  bpmSync: true,
  masterIntensity: 0.75,
  trigger: 'beat',
  pulseAmount: 0.65,
  pulseDecay: 0.45,
  motionAmount: 0.55,
  patternChange: 'off',
  blackoutAmount: 0.25,
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
  const parameters: Record<string, Cinema2JsonValue> = { ...BASE_PARAMETERS }
  for (const [name, value] of Object.entries(overrides)) if (value !== undefined) parameters[name] = value
  const module: Cinema2ModuleManifest = {
    id: MODULE_ID,
    typeId: CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_AFTERHOURS_NATIVE_MODULE_VERSION,
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
      sample: (purpose, index = 0, substream) => deterministicSample(`${purpose}:${substream ?? ''}:${index}`),
      probability: (purpose, probability, index = 0, substream) => deterministicSample(`${purpose}:${substream ?? ''}:${index}`) < probability,
      stream: () => ({ next: () => 0.5, nextInt: () => 0, probability: () => false }) as never,
      eventStream: () => ({ next: () => 0.5, nextInt: () => 0, probability: () => false }) as never,
    },
  }
  const instance = cinema2AfterhoursNativeModuleDefinition.create(context)
  const provider = instance.render?.providers[0]
  if (!provider) throw new Error('Expected Afterhours native render provider')
  return { gl, parameters, parameterFacet, targetFacet, resources, instance, provider }
}

function deterministicSample(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
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

function camera(aspect = 16 / 9, x = 0): Cinema2CameraFrame {
  const position = Object.freeze([x, 3.2, 18]) as readonly [number, number, number]
  const target = Object.freeze([0, 3.2, 6]) as readonly [number, number, number]
  const view = Object.freeze([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    -x, -3.2, -18, 1,
  ]) as Cinema2Matrix4
  const projection = createCinema2PerspectiveProjection(50, aspect, 0.1, 100)
  return Object.freeze({
    version: 1,
    cameraId: null,
    source: 'implicit-safe',
    projection: 'perspective',
    rig: 'static',
    position,
    target,
    fovDegrees: 50,
    orthographicHeight: 5,
    near: 0.1,
    far: 100,
    aspect,
    viewMatrix: view,
    projectionMatrix: projection,
    viewProjectionMatrix: multiplyCinema2Matrix4(projection, view),
    corrected: false,
  })
}

function execute(harness: ReturnType<typeof createHarness>, currentFrame: Cinema2ModuleFrameReadContext, currentCamera = camera()) {
  harness.provider.execute({
    frame: currentFrame,
    target: null,
    width: currentFrame.viewport.width,
    height: currentFrame.viewport.height,
    depthAvailable: true,
    camera: currentCamera,
  })
}

function lastMockArgument(mockFn: unknown, argumentIndex: number): unknown {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls
  return calls[calls.length - 1]?.[argumentIndex]
}

function lastInstanceCount(gl: CinemaMockWebGL): number {
  return Number(lastMockArgument(gl.drawArraysInstanced, 3) ?? 0)
}

describe('Cinema 2.0 Afterhours native 3D renderer', () => {
  it('registers the stable native type and rejects incomplete authoring before WebGL activation', () => {
    const registry = new Cinema2ModuleRegistry()
    expect(registry.register(cinema2AfterhoursNativeModuleDefinition).ok).toBe(true)
    const incomplete: Cinema2ModuleManifest = {
      id: MODULE_ID,
      typeId: CINEMA2_AFTERHOURS_NATIVE_MODULE_TYPE_ID,
      version: CINEMA2_AFTERHOURS_NATIVE_MODULE_VERSION,
      parameters: { pattern: 'not-a-pattern' },
    }
    const validation = registry.validateModules([incomplete])
    expect(validation.ok).toBe(false)
    expect(validation.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_AFTERHOURS_PATTERN_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_AFTERHOURS_MODULE_PARAMETER_MISSING' }),
    ]))
  })

  it.each([
    ['wideFan', 8], ['splitWings', 8], ['crossCanopy', 8], ['diamondStar', 8],
    ['chevronRoof', 8], ['radialCrown', 8], ['sparseArchitecture', 4], ['fullRig', 8],
  ] as const)('renders %s through a world provider with fixed 3D instances', (pattern: string, expectedCount: number) => {
    const harness = createHarness({ pattern, beamCount: 8 })
    const current = frame({ timeSec: 1 })
    harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, current)
    expect(harness.provider.intent).toBe('world')
    expect(lastInstanceCount(harness.gl)).toBe(expectedCount)
    expect(harness.gl.__calls.drawInstancedCount).toBe(1)
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('honors the 2/16 Beam Count ceiling and uses one instanced draw instead of one module per beam', () => {
    for (const beamCount of [2, 16]) {
      const harness = createHarness({ beamCount, symmetry: false, pattern: 'fullRig' })
      const current = frame({ timeSec: 1 })
      harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
      execute(harness, current)
      expect(lastInstanceCount(harness.gl)).toBe(beamCount)
      expect(harness.gl.__calls.drawInstancedCount).toBe(1)
      harness.instance.lifecycle.dispose()
      harness.resources.disposeAll()
    }
  })

  it('consumes final camera matrices and remains finite across pose/aspect changes', () => {
    const harness = createHarness()
    const current = frame({ timeSec: 1 })
    harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, current, camera(16 / 9, 0))
    execute(harness, { ...current, viewport: { width: 900, height: 900, dpr: 1 } }, camera(1, 1.2))
    const matrixCalls = (harness.gl.uniformMatrix4fv as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const firstMatrix = Array.from(matrixCalls[0]?.[2] as Float32Array)
    const secondMatrix = Array.from(matrixCalls[1]?.[2] as Float32Array)
    expect(firstMatrix.every(Number.isFinite)).toBe(true)
    expect(secondMatrix.every(Number.isFinite)).toBe(true)
    expect(secondMatrix).not.toEqual(firstMatrix)
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('smoothly morphs topology changes, supports explicit hard cuts, and clears temporal exposure on discontinuity/context/viewport invalidation', () => {
    const harness = createHarness({ symmetry: false, beamCount: 8 })
    const first = frame({ timeSec: 1 })
    harness.instance.lifecycle.update({ frame: first, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, first)
    expect(lastInstanceCount(harness.gl)).toBe(8)

    const second = frame({ frameId: 2, timeSec: 1.08 })
    harness.instance.lifecycle.update({ frame: second, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, second)
    expect(lastInstanceCount(harness.gl)).toBeGreaterThan(8)

    harness.parameters.pattern = 'crossCanopy'
    const morph = frame({ frameId: 3, timeSec: 1.12 })
    harness.instance.lifecycle.update({ frame: morph, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, morph)
    const morphUpload = lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array
    expect(Array.from(morphUpload).every(Number.isFinite)).toBe(true)

    harness.instance.handleAction?.(CINEMA2_AFTERHOURS_HARD_CUT_ACTION, {} as never)
    const cut = frame({ frameId: 4, timeSec: 1.14 })
    harness.instance.lifecycle.update({ frame: cut, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, cut)

    const resized = frame({ frameId: 5, timeSec: 1.18, viewport: { width: 1920, height: 1080, dpr: 1 } })
    harness.instance.lifecycle.update({ frame: resized, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, resized, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBe(8)

    const refill = frame({ frameId: 6, timeSec: 1.26, viewport: resized.viewport })
    harness.instance.lifecycle.update({ frame: refill, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, refill, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBeGreaterThan(8)

    const regenerated = frame({ frameId: 7, timeSec: 1.3, contextGeneration: 2, viewport: resized.viewport })
    harness.instance.lifecycle.update({ frame: regenerated, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, regenerated, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBe(8)

    const refillAgain = frame({ frameId: 8, timeSec: 1.38, contextGeneration: 2, viewport: resized.viewport })
    harness.instance.lifecycle.update({ frame: refillAgain, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, refillAgain, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBeGreaterThan(8)

    const discontinuity = frame({
      frameId: 9,
      timeSec: 4,
      contextGeneration: 2,
      viewport: resized.viewport,
      audio: { discontinuity: { occurred: true, reason: 'seek', generation: 2 } } as never,
    })
    harness.instance.lifecycle.update({ frame: discontinuity, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, discontinuity, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBe(8)
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('keeps no-source motion extremely small, paused transport static, and disposes GPU leases cleanly', () => {
    const harness = createHarness({ beamCount: 2, symmetry: false })
    const idleA = frame({ timeSec: 1, elapsedTimeSec: 1, transport: { sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: true, trackId: null, timeSec: 0 } })
    harness.instance.lifecycle.update({ frame: idleA, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, idleA)
    const firstUpload = Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array)
    const idleB = frame({ frameId: 2, timeSec: 2, elapsedTimeSec: 2, transport: { sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: true, trackId: null, timeSec: 0 } })
    harness.instance.lifecycle.update({ frame: idleB, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, idleB)
    const secondUpload = Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array)
    const targetDelta = Math.hypot(secondUpload[3]! - firstUpload[3]!, secondUpload[4]! - firstUpload[4]!, secondUpload[5]! - firstUpload[5]!)
    expect(targetDelta).toBeGreaterThan(0)
    expect(targetDelta).toBeLessThan(0.08)

    const paused = frame({ frameId: 3, timeSec: 9, elapsedTimeSec: 9, transport: { sourcePresent: true, playing: false, analysisActive: true, paused: true, animationActive: false, trackId: 'track-a', timeSec: 3 } })
    harness.instance.lifecycle.update({ frame: paused, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, paused)
    const pausedA = Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array)
    const pausedLater = frame({ frameId: 4, timeSec: 10, elapsedTimeSec: 10, transport: { sourcePresent: true, playing: false, analysisActive: true, paused: true, animationActive: false, trackId: 'track-a', timeSec: 3 } })
    harness.instance.lifecycle.update({ frame: pausedLater, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, pausedLater)
    const pausedB = Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array)
    expect(pausedB.slice(0, 6)).toEqual(pausedA.slice(0, 6))

    expect(harness.resources.getSnapshot().activeLeaseCount).toBe(1)
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
    expect(harness.gl.__calls.deletedPrograms).toBe(1)
    expect(harness.gl.__calls.deletedBuffers).toBe(2)
    expect(harness.gl.__calls.deletedVertexArrays).toBe(1)
  })
})
