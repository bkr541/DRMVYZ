import { describe, expect, it, vi } from 'vitest'

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
  directorIntensity: 0,
  directorBuild: 0,
  directorImpact: 0,
  vocalPresence: 0,
  kickAccent: 0,
  snareAccent: 0,
  downbeatAccent: 0,
  phraseAccent: 0,
  sectionAccent: 0,
  dropAccent: 0,
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

  reportGpuBytes(): void {}

  getSnapshot() {
    return { activeLeaseCount: this.leases.size, disposedLeaseCount: this.disposedLeaseCount, estimatedGpuBytes: 0 }
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


function beatAudio(timeSec: number, discontinuity = false, beatIndex = 8, beatPhase = 0, barIndex = 2) {
  return {
    upstream: { timeSec },
    discontinuity: { occurred: discontinuity, reason: discontinuity ? 'seek' : null, generation: discontinuity ? 2 : 1 },
    rhythm: {
      beat: { id: 'beat-stable', strength: 1 },
      bpm: { available: true, value: 120 },
      beatIndex: { available: true, value: beatIndex },
      beatPhase: { available: true, value: beatPhase },
      barIndex: { available: true, value: barIndex },
    },
    structure: {
      analyzedPhrases: { available: false, value: null },
      semanticMoments: { available: false, value: null },
    },
  } as never
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

function shaderSources(gl: CinemaMockWebGL): readonly string[] {
  const calls = (gl.shaderSource as unknown as { mock: { calls: unknown[][] } }).mock.calls
  return calls.map(call => String(call[1] ?? ''))
}

function uniformLocationFor(gl: CinemaMockWebGL, name: string): WebGLUniformLocation | null {
  const mock = gl.getUniformLocation as unknown as {
    mock: { calls: unknown[][]; results: Array<{ value: unknown }> }
  }
  const index = mock.mock.calls.findIndex(call => call[1] === name)
  return index >= 0 ? mock.mock.results[index]?.value as WebGLUniformLocation : null
}

function beamProfileStrength(side: number, atmosphere: number, longitudinal = 0.5): number {
  const boundedSide = Math.max(0, Math.min(1, Math.abs(side)))
  const core = Math.exp(-boundedSide * boundedSide * 118)
  const body = Math.exp(-boundedSide * boundedSide * 34)
  const halo = Math.exp(-boundedSide * boundedSide * 6.4)
  const sourceBloom = Math.exp(-longitudinal * 56)
  return core * 1.72 + body * 0.40 + halo * atmosphere * 0.22 + sourceBloom * (0.22 + atmosphere * 0.12)
}

describe('Cinema 2.0 Afterhours native 3D renderer', () => {
  it('preserves signed beam-side interpolation through zero and keeps the optical center stronger than the edges', () => {
    const harness = createHarness()
    const sources = shaderSources(harness.gl)
    const vertex = sources.find(source => source.includes('layout(location = 0) in vec2 aCorner')) ?? ''
    const fragment = sources.find(source => source.includes('out vec4 outColor')) ?? ''

    expect(vertex).toContain('vSide = aCorner.y;')
    expect(vertex).not.toContain('vSide = abs(aCorner.y);')
    expect(vertex).toContain('viewportExitScale')
    expect(vertex).toContain('extendedTargetNdc')
    expect(vertex).toContain('worldClip.xy += (extendedCenterNdc - authoredCenterNdc) * worldClip.w;')
    expect(fragment).toContain('float side = clamp(abs(vSide), 0.0, 1.0);')
    expect(beamProfileStrength(0, 0.55)).toBeGreaterThan(beamProfileStrength(1, 0.55))

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('uses additive blending without reapplying alpha and honors Master Intensity at its zero boundary', () => {
    const harness = createHarness({ masterIntensity: 0, beamCount: 2, symmetry: false })
    const current = frame({
      timeSec: 1,
      transport: { sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: false, trackId: null, timeSec: 0 },
    })
    harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, current)

    expect(lastInstanceCount(harness.gl)).toBe(2)
    expect(harness.gl.blendFunc).toHaveBeenCalledWith(harness.gl.ONE, harness.gl.ONE)
    expect(harness.gl.blendFunc).not.toHaveBeenCalledWith(harness.gl.SRC_ALPHA, harness.gl.ONE)
    const masterLocation = uniformLocationFor(harness.gl, 'uMasterIntensity')
    expect(masterLocation).not.toBeNull()
    expect(harness.gl.uniform1f).toHaveBeenCalledWith(masterLocation, 0)

    harness.parameters.masterIntensity = 1
    const restored = frame({
      frameId: 2,
      timeSec: 2,
      transport: { sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: false, trackId: null, timeSec: 0 },
    })
    harness.instance.lifecycle.update({ frame: restored, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, restored)
    expect(harness.gl.uniform1f).toHaveBeenCalledWith(masterLocation, 1)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('surfaces silent WebGL draw errors from the native laser renderer', () => {
    const harness = createHarness({ beamCount: 2, symmetry: false })
    const current = frame({ timeSec: 1 })
    harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
    vi.mocked(harness.gl.getError).mockReturnValueOnce(0x0502).mockReturnValue(0)

    expect(() => execute(harness, current)).toThrow(/Afterhours native laser draw.*INVALID_OPERATION/)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

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

  it('produces substantial beat-domain scanner travel for an authored pattern while playback is active', () => {
    const harness = createHarness({ pattern: 'wideFan', beamCount: 2, symmetry: false, motionAmount: 1, pulseAmount: 0, bpmSync: true })
    const first = frame({ frameId: 1, timeSec: 3, audio: beatAudio(3, false, 8, 0) })
    harness.instance.lifecycle.update({ frame: first, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, first)
    const firstUpload = Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array)

    const second = frame({ frameId: 2, timeSec: 3.25, audio: beatAudio(3.25, false, 8, 0.5) })
    harness.instance.lifecycle.update({ frame: second, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, second)
    const secondUpload = Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array)

    const targetDelta = Math.hypot(
      secondUpload[3]! - firstUpload[3]!,
      secondUpload[4]! - firstUpload[4]!,
      secondUpload[5]! - firstUpload[5]!,
    )
    expect(targetDelta).toBeGreaterThan(0.35)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
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

  it('smoothly morphs topology changes without exceeding Beam Count and supports explicit hard cuts/lifecycle invalidation', () => {
    const harness = createHarness({ symmetry: false, beamCount: 8 })
    const first = frame({ timeSec: 1 })
    harness.instance.lifecycle.update({ frame: first, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, first)
    expect(lastInstanceCount(harness.gl)).toBe(8)

    const second = frame({ frameId: 2, timeSec: 1.08 })
    harness.instance.lifecycle.update({ frame: second, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, second)
    expect(lastInstanceCount(harness.gl)).toBe(8)

    harness.parameters.pattern = 'crossCanopy'
    const morph = frame({ frameId: 3, timeSec: 1.12 })
    harness.instance.lifecycle.update({ frame: morph, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, morph)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)
    const morphUpload = lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array
    expect(Array.from(morphUpload).every(Number.isFinite)).toBe(true)

    const morphMid = frame({ frameId: 4, timeSec: 1.29 })
    harness.instance.lifecycle.update({ frame: morphMid, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, morphMid)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)

    harness.instance.handleAction?.(CINEMA2_AFTERHOURS_HARD_CUT_ACTION, {} as never)
    const cut = frame({ frameId: 5, timeSec: 1.31 })
    harness.instance.lifecycle.update({ frame: cut, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, cut)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)

    const resized = frame({ frameId: 6, timeSec: 1.35, viewport: { width: 1920, height: 1080, dpr: 1 } })
    harness.instance.lifecycle.update({ frame: resized, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, resized, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)

    const regenerated = frame({ frameId: 7, timeSec: 1.4, contextGeneration: 2, viewport: resized.viewport })
    harness.instance.lifecycle.update({ frame: regenerated, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, regenerated, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBe(8)

    const discontinuity = frame({
      frameId: 8,
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

  it('preserves mirrored pairs while enforcing an odd authored Beam Count during topology morphs', () => {
    const harness = createHarness({ symmetry: true, beamCount: 7, pattern: 'wideFan' })
    const first = frame({ timeSec: 1 })
    harness.instance.lifecycle.update({ frame: first, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, first)
    expect(lastInstanceCount(harness.gl)).toBe(6)

    harness.parameters.pattern = 'fullRig'
    const morph = frame({ frameId: 2, timeSec: 1.17 })
    harness.instance.lifecycle.update({ frame: morph, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, morph)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(6)
    expect(lastInstanceCount(harness.gl) % 2).toBe(0)

    const morphMid = frame({ frameId: 3, timeSec: 1.34 })
    harness.instance.lifecycle.update({ frame: morphMid, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, morphMid)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(6)
    expect(lastInstanceCount(harness.gl) % 2).toBe(0)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('keeps no-source motion extremely small, paused transport static, and disposes GPU leases cleanly', () => {
    const harness = createHarness({ beamCount: 2, symmetry: false })
    const idleA = frame({ timeSec: 1, elapsedTimeSec: 0, transport: { sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: false, trackId: null, timeSec: 0 } })
    harness.instance.lifecycle.update({ frame: idleA, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, idleA)
    const firstUpload = Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array)
    const idleB = frame({ frameId: 2, timeSec: 2, elapsedTimeSec: 0, transport: { sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: false, trackId: null, timeSec: 0 } })
    harness.instance.lifecycle.update({ frame: idleB, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, idleB)
    const secondUpload = Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array)
    const targetDelta = Math.hypot(secondUpload[3]! - firstUpload[3]!, secondUpload[4]! - firstUpload[4]!, secondUpload[5]! - firstUpload[5]!)
    expect(targetDelta).toBeGreaterThan(0)
    expect(targetDelta).toBeLessThan(0.08)

    const active = frame({ frameId: 3, timeSec: 3, elapsedTimeSec: 0, audio: beatAudio(3) })
    harness.instance.lifecycle.update({ frame: active, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, active)
    const activeLater = frame({ frameId: 4, timeSec: 3.08, elapsedTimeSec: 0, audio: beatAudio(3.08) })
    harness.instance.lifecycle.update({ frame: activeLater, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, activeLater)
    expect(lastInstanceCount(harness.gl)).toBe(2)

    const paused = frame({ frameId: 5, timeSec: 9, elapsedTimeSec: 0, transport: { sourcePresent: true, playing: false, analysisActive: true, paused: true, animationActive: false, trackId: 'track-a', timeSec: 3.08 } })
    harness.instance.lifecycle.update({ frame: paused, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, paused)
    expect(lastInstanceCount(harness.gl)).toBe(2)
    const pausedA = Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array)
    const pausedLater = frame({ frameId: 6, timeSec: 10, elapsedTimeSec: 0, transport: { sourcePresent: true, playing: false, analysisActive: true, paused: true, animationActive: false, trackId: 'track-a', timeSec: 3.08 } })
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

  it('deduplicates repeated Trigger event IDs, respects Pulse Amount, and resets pulse state on discontinuity', () => {
    const harness = createHarness({ beamCount: 2, symmetry: false, motionAmount: 0, pulseAmount: 1, pulseDecay: 1, trigger: 'beat' })
    const first = frame({ frameId: 1, timeSec: 1, audio: beatAudio(1) })
    harness.instance.lifecycle.update({ frame: first, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, first)
    const firstUpload = lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array
    const firstIntensity = firstUpload[10]!

    const repeated = frame({ frameId: 2, timeSec: 1.4, audio: beatAudio(1.4) })
    harness.instance.lifecycle.update({ frame: repeated, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, repeated)
    const repeatedUpload = lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array
    const repeatedIntensity = repeatedUpload[10]!
    expect(repeatedIntensity).toBeLessThan(firstIntensity)

    harness.parameters.pulseAmount = 0
    const pulseDisabled = frame({ frameId: 3, timeSec: 1.45, audio: beatAudio(1.45) })
    harness.instance.lifecycle.update({ frame: pulseDisabled, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, pulseDisabled)
    const disabledUpload = lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array
    expect(disabledUpload[10]!).toBeLessThan(firstIntensity)

    harness.parameters.pulseAmount = 1
    const seek = frame({ frameId: 4, timeSec: 1.5, audio: beatAudio(1.5, true) })
    harness.instance.lifecycle.update({ frame: seek, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, seek)
    const seekUpload = lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array
    expect(seekUpload[10]!).toBeGreaterThan(repeatedIntensity)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

})
