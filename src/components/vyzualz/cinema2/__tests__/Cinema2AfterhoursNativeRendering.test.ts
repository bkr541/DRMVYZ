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
function sweepBeats(harness: ReturnType<typeof createHarness>, fromBeat: number, beats: number, withAudio = true): SweepStep[] {
  const steps: SweepStep[] = []
  const gl = harness.gl as unknown as GlMocks
  for (let index = 0; index <= beats * 8; index += 1) {
    const beat = fromBeat + index / 8
    const timeSec = beat / 2
    const current = frame({
      frameId: index + 1,
      timeSec,
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

/** The longest stretch, in beats, one beam stays lit and the longest it stays dark. */
function longestRuns(steps: readonly SweepStep[], origin: string): { lit: number; dark: number } {
  let lit = 0, dark = 0, currentLit = 0, currentDark = 0
  for (const step of steps) {
    if (step.beams.some(beam => beam.origin === origin)) { currentLit += 1 / 8; currentDark = 0 } else { currentDark += 1 / 8; currentLit = 0 }
    lit = Math.max(lit, currentLit)
    dark = Math.max(dark, currentDark)
  }
  return { lit, dark }
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

  it.each([
    ['wideFan', 8], ['splitWings', 8], ['crossCanopy', 8], ['diamondStar', 8],
    ['chevronRoof', 8], ['radialCrown', 8], ['sparseArchitecture', 4], ['fullRig', 8],
  ] as const)('renders %s through a world provider with fixed 3D instances', (pattern: string, expectedCount: number) => {
    const harness = createHarness({ pattern, beamCount: 8 })
    // Over a scene of music every fixture of the pattern takes its turn; a frame is one instanced draw at most.
    const steps = sweepBeats(harness, 8, 16)
    expect(harness.provider.intent).toBe('world')
    expect(originsOf(steps).size).toBe(expectedCount)
    expect(steps.some(step => step.count > 0)).toBe(true)
    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('honors the 2/16 Beam Count ceiling and uses one instanced draw instead of one module per beam', () => {
    for (const beamCount of [2, 16]) {
      const harness = createHarness({ beamCount, symmetry: false, pattern: 'fullRig' })
      const steps = sweepBeats(harness, 8, 16)
      expect(originsOf(steps).size).toBe(beamCount)
      expect(Math.max(...steps.map(step => step.count))).toBeLessThanOrEqual(beamCount)
      harness.instance.lifecycle.dispose()
      harness.resources.disposeAll()
    }
  })

  it('fires its lasers in bursts on the beat grid: dark between bursts, and no laser lit or dark for longer than a bar', () => {
    const harness = createHarness({ pattern: 'fullRig', beamCount: 16, symmetry: true, motionAmount: 0.8, pulseAmount: 0, bpmSync: true })
    const steps = sweepBeats(harness, 8, 64)
    const origins = [...originsOf(steps)]
    expect(origins.length).toBe(16)
    expect(steps.some(step => step.count < 16)).toBe(true)
    expect(steps.some(step => step.count > 0)).toBe(true)
    for (const origin of origins) {
      const runs = longestRuns(steps, origin)
      // Never lit for longer than one bar (4 beats, plus one sample of tolerance) and never dark for longer than a bar.
      expect(runs.lit, origin).toBeLessThanOrEqual(4 + 1 / 8)
      expect(runs.dark, origin).toBeLessThanOrEqual(4 + 1 / 8)
      expect(runs.lit, origin).toBeGreaterThan(0)
    }
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

  it('moves each group to a new position between bursts, and Motion Amount 0 fires every burst at the home position', () => {
    const moving = createHarness({ pattern: 'wideFan', beamCount: 2, symmetry: false, motionAmount: 1, pulseAmount: 0, bpmSync: true })
    const movingSteps = sweepBeats(moving, 8, 64)
    const firstBeam = [...originsOf(movingSteps)][0]!
    const lit = (step: SweepStep | undefined) => step?.beams.some(beam => beam.origin === firstBeam) === true
    const burstStarts = movingSteps.filter((step, index) => lit(step) && !lit(movingSteps[index - 1]))
    const distinctAims = new Set(burstStarts.map(step => step.beams.find(beam => beam.origin === firstBeam)!.target.map(value => value.toFixed(2)).join(',')))
    expect(burstStarts.length).toBeGreaterThan(4)
    expect(distinctAims.size).toBeGreaterThan(2)
    moving.instance.lifecycle.dispose()
    moving.resources.disposeAll()

    const still = createHarness({ pattern: 'wideFan', beamCount: 2, symmetry: false, motionAmount: 0, pulseAmount: 0, bpmSync: true })
    const stillSteps = sweepBeats(still, 8, 64)
    const stillFirst = [...originsOf(stillSteps)][0]!
    const stillAims = new Set(stillSteps.flatMap(step => step.beams.filter(beam => beam.origin === stillFirst).map(beam => beam.target.map(value => value.toFixed(3)).join(','))))
    expect(stillAims.size).toBe(1)
    still.instance.lifecycle.dispose()
    still.resources.disposeAll()
  })

  it('still cues at a steady 120 BPM when there is no beat tracking at all', () => {
    const free = createHarness({ pattern: 'wideFan', beamCount: 8, symmetry: true })
    const freeSteps = sweepBeats(free, 8, 16, false)
    expect(freeSteps.some(step => step.count < 8)).toBe(true)
    expect(originsOf(freeSteps).size).toBe(8)
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

  it('smoothly morphs topology changes without exceeding Beam Count and supports explicit hard cuts/lifecycle invalidation', () => {
    const harness = createHarness({ symmetry: false, beamCount: 8 })
    // Beams cue in bursts, so a single frame lights only some groups: over a scene of music all eight fixtures fire.
    expect(originsOf(sweepBeats(harness, 8, 16)).size).toBe(8)
    const first = frame({ frameId: 500, timeSec: 20 })
    harness.instance.lifecycle.update({ frame: first, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, first)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)

    const second = frame({ frameId: 501, timeSec: 20.08 })
    harness.instance.lifecycle.update({ frame: second, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, second)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)

    harness.parameters.pattern = 'crossCanopy'
    const morph = frame({ frameId: 502, timeSec: 20.12 })
    harness.instance.lifecycle.update({ frame: morph, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, morph)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)
    const morphUpload = lastMockArgument(harness.gl.bufferSubData, 2) as Float32Array
    expect(Array.from(morphUpload).every(Number.isFinite)).toBe(true)

    const morphMid = frame({ frameId: 503, timeSec: 20.29 })
    harness.instance.lifecycle.update({ frame: morphMid, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, morphMid)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)

    harness.instance.handleAction?.(CINEMA2_AFTERHOURS_HARD_CUT_ACTION, {} as never)
    const cut = frame({ frameId: 504, timeSec: 20.31 })
    harness.instance.lifecycle.update({ frame: cut, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, cut)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)

    const resized = frame({ frameId: 505, timeSec: 20.35, viewport: { width: 1920, height: 1080, dpr: 1 } })
    harness.instance.lifecycle.update({ frame: resized, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, resized, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)

    const regenerated = frame({ frameId: 506, timeSec: 20.4, contextGeneration: 2, viewport: resized.viewport })
    harness.instance.lifecycle.update({ frame: regenerated, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, regenerated, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)

    const discontinuity = frame({
      frameId: 507,
      timeSec: 24,
      contextGeneration: 2,
      viewport: resized.viewport,
      audio: { discontinuity: { occurred: true, reason: 'seek', generation: 2 } } as never,
    })
    harness.instance.lifecycle.update({ frame: discontinuity, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, discontinuity, camera(16 / 9, 0.4))
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(8)
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

  it('preserves mirrored pairs while enforcing an odd authored Beam Count during topology morphs', () => {
    const harness = createHarness({ symmetry: true, beamCount: 7, pattern: 'wideFan' })
    // Seven beams with symmetry on come out as three mirrored pairs; over a scene of music six distinct fixtures fire.
    expect(originsOf(sweepBeats(harness, 8, 16)).size).toBe(6)

    harness.parameters.pattern = 'fullRig'
    const morph = frame({ frameId: 1000, timeSec: 20 })
    harness.instance.lifecycle.update({ frame: morph, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, morph)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(6)
    expect(lastInstanceCount(harness.gl) % 2).toBe(0)

    const morphMid = frame({ frameId: 1001, timeSec: 20.17 })
    harness.instance.lifecycle.update({ frame: morphMid, parameters: harness.parameterFacet, targets: harness.targetFacet })
    execute(harness, morphMid)
    expect(lastInstanceCount(harness.gl)).toBeLessThanOrEqual(6)
    expect(lastInstanceCount(harness.gl) % 2).toBe(0)

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
