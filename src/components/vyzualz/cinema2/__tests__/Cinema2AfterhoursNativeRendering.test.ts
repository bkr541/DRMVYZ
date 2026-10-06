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

interface SweepStep {
  readonly beat: number
  readonly count: number
  readonly beams: readonly { origin: string; target: readonly number[]; intensity: number }[]
}

type GlMocks = { drawArraysInstanced: { mockClear(): void; mock: { calls: unknown[] } }; bufferSubData: { mockClear(): void } }

/**
 * Runs the module through `beats` beats of music in 1/8-beat steps and records what was drawn at each step. Beams cue in bursts on the beat
 * grid, so a single frame shows only the groups that are lit at that instant; behavior is judged over a stretch of music instead.
 */
function sweepBeats(harness: ReturnType<typeof createHarness>, fromBeat: number, beats: number, withAudio = true, samplesPerBeat = 8): SweepStep[] {
  const steps: SweepStep[] = []
  const gl = harness.gl as unknown as GlMocks
  for (let index = 0; index <= beats * samplesPerBeat; index += 1) {
    const beat = fromBeat + index / samplesPerBeat
    const timeSec = beat / 2
    const current = frame({
      frameId: index + 1,
      timeSec,
      // A beat is half a second here, so this is the real time between two samples.
      deltaTimeSec: 0.5 / samplesPerBeat,
      audio: withAudio ? beatAudio(timeSec, false, Math.floor(beat), beat - Math.floor(beat), Math.floor(beat / 4)) : null,
    })
    gl.drawArraysInstanced.mockClear()
    gl.bufferSubData.mockClear()
    harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, current)
    const count = lastInstanceCount(harness.gl)
    const upload = count > 0 ? Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array) : []
    const beams = Array.from({ length: count }, (_, k) => ({
      origin: upload.slice(k * 14, k * 14 + 3).map(value => value.toFixed(3)).join(','),
      target: upload.slice(k * 14 + 3, k * 14 + 6),
      intensity: upload[k * 14 + 10]!,
    }))
    steps.push({ beat, count, beams })
  }
  return steps
}

const originsOf = (steps: readonly SweepStep[]) => new Set(steps.flatMap(step => step.beams.map(beam => beam.origin)))
/** Lasers lit in one frame (a laser firing a fan draws several beams from one origin). */
const litLasers = (step: SweepStep) => new Set(step.beams.map(beam => beam.origin)).size

function drawnLaserCount(gl: CinemaMockWebGL): number {
  const count = lastInstanceCount(gl)
  if (count === 0) return 0
  const upload = Array.from(lastMockArgument(gl.bufferSubData, 2) as Float32Array)
  return new Set(Array.from({ length: count }, (_, k) => upload.slice(k * 14, k * 14 + 3).map(value => value.toFixed(3)).join(','))).size
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
    // Beat 4 (2 s at the free-running 120 BPM): every group starts a burst on a multiple of a bar.
    const current = frame({
      timeSec: 2,
      transport: { sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: false, trackId: null, timeSec: 0 },
    })
    harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, current)

    expect(lastInstanceCount(harness.gl)).toBeGreaterThan(0)
    expect(harness.gl.blendFunc).toHaveBeenCalledWith(harness.gl.ONE, harness.gl.ONE)
    expect(harness.gl.blendFunc).not.toHaveBeenCalledWith(harness.gl.SRC_ALPHA, harness.gl.ONE)
    const masterLocation = uniformLocationFor(harness.gl, 'uMasterIntensity')
    expect(masterLocation).not.toBeNull()
    expect(harness.gl.uniform1f).toHaveBeenCalledWith(masterLocation, 0)

    harness.parameters.masterIntensity = 1
    const restored = frame({
      frameId: 2,
      timeSec: 4,
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

  it.each(['wideFan', 'splitWings', 'crossCanopy', 'diamondStar', 'chevronRoof', 'radialCrown', 'sparseArchitecture', 'fullRig', 'pyramidSheet', 'buildRiser'])(
    'renders %s through a world provider as one instanced draw per frame within Laser Count',
    (pattern: string) => {
      const harness = createHarness({ pattern, beamCount: 8 })
      const steps = sweepBeats(harness, 8, 16)
      expect(harness.provider.intent).toBe('world')
      expect(steps.some(step => step.count > 0)).toBe(true)
      expect(Math.max(...steps.map(litLasers))).toBeLessThanOrEqual(8)
      harness.instance.lifecycle.dispose()
      harness.resources.disposeAll()
    },
  )

  it('honors Laser Count from 2 up to the whole 46-laser rig, and a laser can fire a whole fan of beams', () => {
    for (const beamCount of [2, 16, 46]) {
      const harness = createHarness({ beamCount, symmetry: false, pattern: 'fullRig' })
      const steps = sweepBeats(harness, 8, 16)
      expect(Math.max(...steps.map(litLasers))).toBeLessThanOrEqual(beamCount)
      expect(Math.max(...steps.map(litLasers))).toBeGreaterThanOrEqual(Math.min(beamCount, 28))
      // More beams than lasers: fans.
      expect(Math.max(...steps.map(step => step.count))).toBeGreaterThan(Math.max(...steps.map(litLasers)))
      harness.instance.lifecycle.dispose()
      harness.resources.disposeAll()
    }
  })

  it('lands hits exactly on the beat and can change the look on every beat', () => {
    const harness = createHarness({ pattern: 'beatJump', beamCount: 46, symmetry: true, pulseAmount: 0, bpmSync: true })
    // Sampled at 30 frames a beat (the real frame rate at 120 BPM), because a laser that has to travel to its next point is dark for a few frames.
    const steps = sweepBeats(harness, 8, 8, true, 30)
    const onBeat = steps.filter(step => Number.isInteger(step.beat))
    const countAt = (beat: number) => steps.find(step => Math.abs(step.beat - beat) < 1e-6)!.count
    for (const beat of [9, 10, 11]) {
      // The trip is dark: shortly before a beat that moves the lasers, the lasers that have to travel switch off…
      const dip = Math.min(...steps.filter(step => step.beat >= beat - 0.15 && step.beat < beat - 0.01).map(step => step.count))
      expect(dip, `beat ${beat}`).toBeLessThan(countAt(beat + 0.1))
      // …and they are all back on, at their new points, exactly on the beat: the look is complete on it.
      expect(countAt(beat), `beat ${beat}`).toBe(countAt(beat + 0.1))
    }
    const floorLaser = onBeat[0]!.beams[0]!.origin
    const aims = onBeat.map(step => step.beams.find(beam => beam.origin === floorLaser)?.target.map(value => value.toFixed(2)).join(','))
    expect(new Set(aims).size).toBeGreaterThanOrEqual(onBeat.length - 1)
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('holds some lasers on one look for the bar while others change within it', () => {
    const harness = createHarness({ pattern: 'fanRow', beamCount: 46, symmetry: true, pulseAmount: 0, bpmSync: true })
    // Bar 3 of the pattern: the mid-height row holds a fan while the floor beams re-aim every 8th note.
    const steps = sweepBeats(harness, 8, 4).slice(0, 31)
    const aimsOf = (y: string) => {
      const beams = steps.flatMap(step => step.beams.filter(beam => beam.origin.split(',')[1] === y))
      const origin = beams[0]!.origin
      return new Set(beams.filter(beam => beam.origin === origin).map(beam => beam.target.map(value => value.toFixed(2)).join(',')))
    }
    // One mid-row laser keeps the same seven-beam fan all bar; one floor laser jumps between its endpoints.
    expect(aimsOf((3.8).toFixed(3)).size).toBe(7)
    expect(aimsOf((0.35).toFixed(3)).size).toBeGreaterThanOrEqual(2)
    // The held row is lit in every sampled frame of the bar.
    expect(steps.every(step => step.beams.some(beam => beam.origin.split(',')[1] === (3.8).toFixed(3)))).toBe(true)
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('keeps mirrored pairs together: a beam and its mirror image always fire on the same frames', () => {
    const harness = createHarness({ pattern: 'wideFan', beamCount: 16, symmetry: true, sideLasers: true, topLasers: true })
    const steps = sweepBeats(harness, 8, 32)
    const mirror = (origin: string) => origin.split(',').map((value, index) => (index === 0 ? (-Number(value)).toFixed(3).replace('-0.000', '0.000') : value)).join(',')
    for (const step of steps) {
      const lit = new Set(step.beams.map(beam => beam.origin))
      for (const origin of lit) expect(lit.has(mirror(origin)), `${step.beat} ${origin}`).toBe(true)
    }
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('moves a laser between its endpoints, and Motion Amount 0 fires every hit at the first endpoint', () => {
    const moving = createHarness({ pattern: 'gridStep', beamCount: 2, symmetry: false, motionAmount: 0.55, pulseAmount: 0, bpmSync: true })
    const movingSteps = sweepBeats(moving, 8, 16)
    const firstLaser = [...originsOf(movingSteps)][0]!
    const movingAims = new Set(movingSteps.flatMap(step => step.beams.filter(beam => beam.origin === firstLaser).map(beam => beam.target.map(value => value.toFixed(2)).join(','))))
    expect(movingAims.size).toBeGreaterThan(2)
    moving.instance.lifecycle.dispose()
    moving.resources.disposeAll()

    const still = createHarness({ pattern: 'gridStep', beamCount: 2, symmetry: false, motionAmount: 0, pulseAmount: 0, bpmSync: true })
    const stillSteps = sweepBeats(still, 8, 16)
    const stillFirst = [...originsOf(stillSteps)][0]!
    const stillAims = new Set(stillSteps.flatMap(step => step.beams.filter(beam => beam.origin === stillFirst).map(beam => beam.target.map(value => value.toFixed(3)).join(','))))
    expect(stillAims.size).toBe(1)
    still.instance.lifecycle.dispose()
    still.resources.disposeAll()
  })

  it('still cues at a steady 120 BPM when there is no beat tracking at all', () => {
    const free = createHarness({ pattern: 'wideFan', beamCount: 46, symmetry: true })
    const freeSteps = sweepBeats(free, 8, 16, false)
    expect(freeSteps.some(step => step.count > 0)).toBe(true)
    expect(new Set(freeSteps.map(step => step.beams.map(beam => beam.target.join(',')).join('|'))).size).toBeGreaterThan(2)
    free.instance.lifecycle.dispose()
    free.resources.disposeAll()
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

  it('switches patterns cleanly within Laser Count and survives hard cuts and lifecycle invalidation', () => {
    const harness = createHarness({ symmetry: false, beamCount: 8 })
    const run = (frameId: number, timeSec: number, options: Partial<Cinema2ModuleFrameReadContext> = {}, currentCamera = camera()) => {
      const current = frame({ frameId, timeSec, ...options })
      harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
      execute(harness, current, currentCamera)
      expect(drawnLaserCount(harness.gl)).toBeLessThanOrEqual(8)
      if (lastInstanceCount(harness.gl) > 0) expect(Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array).every(Number.isFinite)).toBe(true)
    }
    run(500, 20)
    run(501, 20.08)
    harness.parameters.pattern = 'crossCanopy'
    run(502, 20.12)
    run(503, 20.29)
    harness.instance.handleAction?.(CINEMA2_AFTERHOURS_HARD_CUT_ACTION, {} as never)
    run(504, 20.31)
    run(505, 20.35, { viewport: { width: 1920, height: 1080, dpr: 1 } }, camera(16 / 9, 0.4))
    run(506, 20.4, { contextGeneration: 2 }, camera(16 / 9, 0.4))
    run(507, 24, { contextGeneration: 2, audio: beatAudio(24, true) }, camera(16 / 9, 0.4))
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('shows a Pattern edit at once while nothing plays instead of freezing it halfway through a morph', () => {
    const harness = createHarness({ symmetry: false, beamCount: 8 })
    const idle = { sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: false, trackId: null, timeSec: 0 }
    const draw = (frameId: number, wallClockSec: number) => {
      const current = frame({ frameId, timeSec: wallClockSec, elapsedTimeSec: 0, transport: idle })
      harness.gl.bufferSubData.mockClear()
      harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
      execute(harness, current)
      return lastInstanceCount(harness.gl) > 0 ? Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array) : []
    }
    draw(1, 10)
    harness.parameters.pattern = 'crossCanopy'
    const first = draw(2, 10.016)
    // Visual time is frozen, so a real morph would sit at its first frame forever. The edited layout is what is drawn, and it stays put.
    expect(draw(3, 11)).toEqual(first)
    expect(draw(4, 15)).toEqual(first)
  })

  it('preserves mirrored pairs while enforcing an odd authored Laser Count', () => {
    const harness = createHarness({ symmetry: true, beamCount: 7, pattern: 'wideFan' })
    const steps = sweepBeats(harness, 8, 16)
    expect(steps.every(step => litLasers(step) <= 6 && litLasers(step) % 2 === 0)).toBe(true)
    harness.parameters.pattern = 'fullRig'
    const after = sweepBeats(harness, 40, 8)
    expect(after.every(step => litLasers(step) <= 6 && litLasers(step) % 2 === 0)).toBe(true)
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('holds perfectly still with no source however much wall-clock time passes, cues once a source plays, holds still while paused, and disposes GPU leases cleanly', () => {
    const harness = createHarness({ beamCount: 2, symmetry: false })
    const glMocks = harness.gl as unknown as GlMocks
    const noSource = { sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: false, trackId: null, timeSec: 0 }
    // The host freezes visual time (elapsedTimeSec) while nothing plays, but the wall clock (timestampMs) keeps running.
    const idleDraws: number[][] = []
    for (let index = 0; index <= 64; index += 1) {
      const current = frame({ frameId: index + 1, timeSec: 2 + index / 8, elapsedTimeSec: 0, transport: noSource })
      glMocks.drawArraysInstanced.mockClear()
      glMocks.bufferSubData.mockClear()
      harness.instance.lifecycle.update({ frame: current, parameters: harness.parameterFacet, targets: harness.targetFacet })
      execute(harness, current)
      idleDraws.push(lastInstanceCount(harness.gl) > 0 ? Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array) : [])
    }
    // Eight seconds of wall clock, and every idle frame is the same frame: no cueing, no aim change, no brightness change.
    for (const draw of idleDraws) expect(draw).toEqual(idleDraws[0])

    const active = frame({ frameId: 100, timeSec: 20, elapsedTimeSec: 0, audio: beatAudio(20, false, 8, 0.5) })
    harness.instance.lifecycle.update({ frame: active, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, active)
    const activeCount = lastInstanceCount(harness.gl)

    const pausedTransport = { sourcePresent: true, playing: false, analysisActive: true, paused: true, animationActive: false, trackId: 'track-a', timeSec: 3.08 }
    const draws: number[][] = []
    for (const [index, timeSec] of [21, 30].entries()) {
      glMocks.drawArraysInstanced.mockClear()
      glMocks.bufferSubData.mockClear()
      const paused = frame({ frameId: 101 + index, timeSec, elapsedTimeSec: 0, transport: pausedTransport })
      harness.instance.lifecycle.update({ frame: paused, parameters: harness.parameterFacet, targets: harness.targetFacet })
      execute(harness, paused)
      expect(lastInstanceCount(harness.gl)).toBe(activeCount)
      draws.push(activeCount > 0 ? Array.from(lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array) : [])
    }
    // Paused: the same beams at the same aim and brightness however much time passes.
    expect(draws[1]).toEqual(draws[0])

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
