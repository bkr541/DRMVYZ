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
import { CINEMA2_INTERLOCK_RIG } from '../modules/interlock/Cinema2InterlockRig'

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
  // Native renderer unit tests exercise authored/manual geometry unless a test opts into Stage 6 Auto Performance.
  autoPerformance: false,
  patternChange: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.patternChange,
  masterReactivity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.masterReactivity,
  bassRotation: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.bassRotation,
  segmentReactivity: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentReactivity,
  transientPulse: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.transientPulse,
  highShimmer: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.highShimmer,
  buildTension: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.buildTension,
  vocalRestraint: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.vocalRestraint,
  trigger: CINEMA2_INTERLOCK_NATIVE_DEFAULTS.trigger,
  directorIntensity: 0, directorMomentum: 0, directorBuild: 0, directorImpact: 0, directorVariation: 0,
  subEnergy: 0, bassEnergy: 0, overallEnergy: 0, spectralFlux: 0, highEnergy: 0, airEnergy: 0, vocalPresence: 0,
  kickAccent: 0, snareAccent: 0, downbeatAccent: 0, barAccent: 0, phraseAccent: 0, sectionAccent: 0, dropAccent: 0,
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

function execute(harness: ReturnType<typeof createHarness>, currentFrame: Cinema2ModuleFrameReadContext, target: WebGLFramebuffer | null = null): void {
  harness.provider.execute({
    frame: currentFrame,
    target,
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

function uploadedFixtureAngle(instances: readonly number[], fixtureIndex: number): number {
  const offset = fixtureIndex * 11
  return Math.atan2(instances[offset + 3] ?? 0, instances[offset + 2] ?? 1)
}

function shortestAngleDelta(actual: number, expected: number): number {
  return Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected))
}

function fixtureIndex(predicate: (fixture: typeof CINEMA2_INTERLOCK_RIG.fixtures[number]) => boolean): number {
  const index = CINEMA2_INTERLOCK_RIG.fixtures.findIndex(predicate)
  if (index < 0) throw new Error('Expected Interlock fixture was not found in the stable rig.')
  return index
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
  it('binds the engine-supplied non-null framebuffer and target viewport without clearing it', () => {
    const harness = createHarness()
    const currentFrame = frame({ timeSec: 0, viewport: { width: 960, height: 540, dpr: 1 } })
    const target = { id: 'interlock-offscreen-target' } as unknown as WebGLFramebuffer
    update(harness, currentFrame)
    execute(harness, currentFrame, target)

    const framebufferCalls = (harness.gl.bindFramebuffer as unknown as { mock: { calls: unknown[][] } }).mock.calls
    expect(framebufferCalls.some(call => call[0] === harness.gl.FRAMEBUFFER && call[1] === target)).toBe(true)
    expect(harness.gl.viewport).toHaveBeenCalledWith(0, 0, 960, 540)
    expect(harness.gl.clear).not.toHaveBeenCalled()
    expect(lastInstanceCount(harness.gl)).toBe(CINEMA2_INTERLOCK_FIXTURE_COUNT)
    expect(framebufferCalls.at(-1)?.[1]).toBeNull()

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('keeps reactive runtime modulation identical when Auto Performance is off', () => {
    const reactiveOverrides = {
      directorIntensity: 0.8,
      directorMomentum: 0.7,
      directorBuild: 0.65,
      directorImpact: 0.6,
      overallEnergy: 0.9,
      subEnergy: 0.8,
      bassEnergy: 0.85,
      highEnergy: 0.7,
      airEnergy: 0.65,
      kickAccent: 0.9,
      snareAccent: 0.75,
      barAccent: 0.6,
    } satisfies Partial<Record<string, Cinema2JsonValue>>
    const manual = createHarness({ ...reactiveOverrides, autoPerformance: false })
    const automatic = createHarness({ ...reactiveOverrides, autoPerformance: true })
    const currentFrame = frame({ timeSec: 4 })

    update(manual, currentFrame)
    execute(manual, currentFrame)
    update(automatic, currentFrame)
    execute(automatic, currentFrame)

    for (const uniform of ['uLedIntensity', 'uSegmentEnergy', 'uSegmentImpact'] as const) {
      const manualValue = lastUniformFloat(manual.gl, uniform)
      const automaticValue = lastUniformFloat(automatic.gl, uniform)
      expect(manualValue, uniform).toBeDefined()
      expect(automaticValue, uniform).toBeDefined()
      expect(Number(manualValue), uniform).toBeCloseTo(Number(automaticValue), 6)
    }
    const manualSegmentEnergy = lastUniformFloat(manual.gl, 'uSegmentEnergy')
    const manualSegmentImpact = lastUniformFloat(manual.gl, 'uSegmentImpact')
    expect(manualSegmentEnergy).toBeDefined()
    expect(manualSegmentImpact).toBeDefined()
    expect(Number(manualSegmentEnergy)).toBeGreaterThan(CINEMA2_INTERLOCK_NATIVE_DEFAULTS.segmentEnergy)
    expect(Number(manualSegmentImpact)).toBeGreaterThan(0)

    const manualInstances = lastUploadedInstances(manual.gl)
    const automaticInstances = lastUploadedInstances(automatic.gl)
    const authored = resolveCinema2InterlockLayout('diamondTunnel', currentFrame.viewport).fixtures[0]!
    expect(uploadedFixtureAngle(manualInstances, 0)).toBeCloseTo(uploadedFixtureAngle(automaticInstances, 0), 5)
    expect(Math.abs(shortestAngleDelta(uploadedFixtureAngle(manualInstances, 0), authored.angleRad))).toBeGreaterThan(0.01)

    manual.instance.lifecycle.dispose()
    automatic.instance.lifecycle.dispose()
    manual.resources.disposeAll()
    automatic.resources.disposeAll()
  })

  it.each(['diamondTunnel', 'bassPortal', 'fourWayVortex'] as const)(
    'keeps settled %s geometry bass-reactive without requiring a layout transition',
    (pattern: typeof CINEMA2_INTERLOCK_PATTERN_IDS[number]) => {
      const harness = createHarness({
        pattern,
        rotationAmount: 1,
        masterReactivity: 1,
        bassRotation: 1,
        bassEnergy: 0.9,
      })
      const viewport = { width: 1280, height: 720, dpr: 1 }
      const authored = resolveCinema2InterlockLayout(pattern, viewport).fixtures[0]!

      const reactiveFrame = frame({ timeSec: 2, viewport })
      update(harness, reactiveFrame)
      execute(harness, reactiveFrame)
      const reactiveAngle = uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0)
      expect(Math.abs(shortestAngleDelta(reactiveAngle, authored.angleRad))).toBeGreaterThan(0.05)

      harness.parameters.bassRotation = 0
      const bassDisabledFrame = frame({ timeSec: 2.1, viewport, frameId: 2 })
      update(harness, bassDisabledFrame)
      execute(harness, bassDisabledFrame)
      expect(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad)).toBeCloseTo(0, 5)

      harness.parameters.bassRotation = 1
      harness.parameters.rotationAmount = 0
      const rotationDisabledFrame = frame({ timeSec: 2.2, viewport, frameId: 3 })
      update(harness, rotationDisabledFrame)
      execute(harness, rotationDisabledFrame)
      expect(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad)).toBeCloseTo(0, 5)

      harness.parameters.rotationAmount = 1
      harness.parameters.masterReactivity = 0
      const masterDisabledFrame = frame({ timeSec: 2.3, viewport, frameId: 4 })
      update(harness, masterDisabledFrame)
      execute(harness, masterDisabledFrame)
      expect(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad)).toBeCloseTo(0, 5)

      harness.instance.lifecycle.dispose()
      harness.resources.disposeAll()
    },
  )

  it('scales settled mechanical excursion with Rotation Amount and Bass Rotation while preserving authored rest geometry', () => {
    const harness = createHarness({ rotationAmount: 0.25, masterReactivity: 1, bassRotation: 0.5, bassEnergy: 1 })
    const viewport = { width: 1280, height: 720, dpr: 1 }
    const authored = resolveCinema2InterlockLayout('diamondTunnel', viewport).fixtures[0]!

    update(harness, frame({ timeSec: 1, viewport }))
    execute(harness, frame({ timeSec: 1, viewport }))
    const low = Math.abs(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad))

    harness.parameters.rotationAmount = 1
    harness.parameters.bassRotation = 1
    update(harness, frame({ timeSec: 1.1, viewport, frameId: 2 }))
    execute(harness, frame({ timeSec: 1.1, viewport, frameId: 2 }))
    const high = Math.abs(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad))
    expect(high).toBeGreaterThan(low * 3)
    expect(high).toBeLessThanOrEqual(Math.PI / 12 + 1e-5)

    harness.parameters.bassEnergy = 0
    update(harness, frame({ timeSec: 1.2, viewport, frameId: 3 }))
    execute(harness, frame({ timeSec: 1.2, viewport, frameId: 3 }))
    expect(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad)).toBeCloseTo(0, 5)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('combines approved build tension and vocal restraint with the final mechanical amplitude', () => {
    const viewport = { width: 1280, height: 720, dpr: 1 }
    const authored = resolveCinema2InterlockLayout('diamondTunnel', viewport).fixtures[0]!
    const harness = createHarness({
      rotationAmount: 1,
      masterReactivity: 1,
      bassRotation: 1,
      bassEnergy: 0,
      directorBuild: 1,
      buildTension: 1,
    })

    update(harness, frame({ timeSec: 1, viewport }))
    execute(harness, frame({ timeSec: 1, viewport }))
    const buildOnly = Math.abs(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad))
    expect(buildOnly).toBeGreaterThan(0.01)

    harness.parameters.buildTension = 0
    update(harness, frame({ timeSec: 1.1, viewport, frameId: 2 }))
    execute(harness, frame({ timeSec: 1.1, viewport, frameId: 2 }))
    expect(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad)).toBeCloseTo(0, 5)

    harness.parameters.directorBuild = 0
    harness.parameters.buildTension = 1
    harness.parameters.bassEnergy = 1
    harness.parameters.vocalPresence = 0
    harness.parameters.vocalRestraint = 1
    update(harness, frame({ timeSec: 1.2, viewport, frameId: 3 }))
    execute(harness, frame({ timeSec: 1.2, viewport, frameId: 3 }))
    const unrestricted = Math.abs(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad))

    harness.parameters.vocalPresence = 1
    update(harness, frame({ timeSec: 1.3, viewport, frameId: 4 }))
    execute(harness, frame({ timeSec: 1.3, viewport, frameId: 4 }))
    const restrained = Math.abs(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad))
    expect(restrained).toBeLessThan(unrestricted * 0.6)
    expect(restrained).toBeGreaterThan(0)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('holds a routed kick impulse mechanically still while transport animation is paused', () => {
    const harness = createHarness({ rotationAmount: 1, masterReactivity: 1, bassRotation: 1, kickAccent: 1 })
    const playing = frame({ timeSec: 2 })
    update(harness, playing)
    execute(harness, playing)
    const beforePause = lastUploadedInstances(harness.gl)

    const pausedTransport = {
      sourcePresent: true, playing: false, analysisActive: true, paused: true, animationActive: false,
      trackId: 'track-a', timeSec: 9,
    }
    const paused = frame({ timeSec: 9, deltaTimeSec: 7, transport: pausedTransport, frameId: 2 })
    update(harness, paused)
    execute(harness, paused)
    expect(lastUploadedInstances(harness.gl)).toEqual(beforePause)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('keeps the same continuous reactive offset across transition completion instead of snapping back to static geometry', () => {
    const controls = { rotationAmount: 1, masterReactivity: 1, bassRotation: 1, bassEnergy: 0.8, morphDuration: 0.25, segmentBankPhase: 0 }
    const transitioning = createHarness(controls)
    update(transitioning, frame({ timeSec: 0, deltaTimeSec: 0 }))
    transitioning.parameters.pattern = 'mechanicalIris'
    update(transitioning, frame({ timeSec: 0.01, deltaTimeSec: 0.01, frameId: 2 }))
    update(transitioning, frame({ timeSec: 1, deltaTimeSec: 0.99, frameId: 3 }))
    execute(transitioning, frame({ timeSec: 1, deltaTimeSec: 0, frameId: 4 }))
    const completed = lastUploadedInstances(transitioning.gl)

    const settled = createHarness({ ...controls, pattern: 'mechanicalIris' })
    update(settled, frame({ timeSec: 1, deltaTimeSec: 0 }))
    execute(settled, frame({ timeSec: 1, deltaTimeSec: 0 }))
    const expectedSettledReactive = lastUploadedInstances(settled.gl)

    expect(uploadedFixtureAngle(completed, 0)).toBeCloseTo(uploadedFixtureAngle(expectedSettledReactive, 0), 5)
    const authored = resolveCinema2InterlockLayout('mechanicalIris', { width: 1280, height: 720, dpr: 1 }).fixtures[0]!
    expect(Math.abs(shortestAngleDelta(uploadedFixtureAngle(completed, 0), authored.angleRad))).toBeGreaterThan(0.05)

    transitioning.instance.lifecycle.dispose()
    settled.instance.lifecycle.dispose()
    transitioning.resources.disposeAll()
    settled.resources.disposeAll()
  })

  it('suppresses stale kick rotation after a backward seek until the transient envelope has re-armed', () => {
    const harness = createHarness({
      rotationAmount: 1,
      masterReactivity: 1,
      bassRotation: 1,
      bassEnergy: 0,
      kickAccent: 1,
    })
    const viewport = { width: 1280, height: 720, dpr: 1 }
    const authored = resolveCinema2InterlockLayout('diamondTunnel', viewport).fixtures[0]!

    update(harness, frame({ timeSec: 4, viewport }))
    execute(harness, frame({ timeSec: 4, viewport }))
    expect(Math.abs(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad))).toBeGreaterThan(0.01)

    update(harness, frame({ timeSec: 1, deltaTimeSec: 0, viewport, frameId: 2 }))
    execute(harness, frame({ timeSec: 1, deltaTimeSec: 0, viewport, frameId: 2 }))
    expect(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad)).toBeCloseTo(0, 5)

    harness.parameters.kickAccent = 0
    update(harness, frame({ timeSec: 1.1, viewport, frameId: 3 }))
    harness.parameters.kickAccent = 1
    update(harness, frame({ timeSec: 1.2, viewport, frameId: 4 }))
    execute(harness, frame({ timeSec: 1.2, viewport, frameId: 4 }))
    expect(Math.abs(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad))).toBeGreaterThan(0.01)

    const replacementTransport = {
      sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true,
      trackId: 'track-b', timeSec: 1.3,
    }
    update(harness, frame({ timeSec: 1.3, viewport, transport: replacementTransport, frameId: 5 }))
    execute(harness, frame({ timeSec: 1.3, viewport, transport: replacementTransport, frameId: 5 }))
    expect(shortestAngleDelta(uploadedFixtureAngle(lastUploadedInstances(harness.gl), 0), authored.angleRad)).toBeCloseTo(0, 5)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

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

  it('consumes Bank Stagger live as relative Bank Ripple separation without rebuilding GPU resources', () => {
    const harness = createHarness({ segmentPattern: 'bankRipple', segmentBankPhase: 0, segmentSpeed: 0 })
    const first = frame({ timeSec: 0 })
    update(harness, first)
    execute(harness, first)
    expect(lastUniformFloat(harness.gl, 'uSegmentBankPhase')).toBeCloseTo(0)

    harness.parameters.segmentBankPhase = 0.5
    const second = frame({ timeSec: 0.1, frameId: 2 })
    update(harness, second)
    execute(harness, second)
    expect(lastUniformFloat(harness.gl, 'uSegmentBankPhase')).toBeCloseTo(0.5)
    expect(harness.resources.getSnapshot().activeLeaseCount).toBe(1)
    expect(harness.gl.__calls.createdPrograms).toBe(1)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('uses Bank Stagger as real deterministic inter-bank layout delay across the full 0..1 control range', () => {
    const innerIndex = fixtureIndex(fixture => fixture.bank === 'inner' && fixture.quadrant === 'topLeft')
    const edgeIndex = fixtureIndex(fixture => fixture.bank === 'edge' && fixture.quadrant === 'topLeft')
    const separations: number[] = []

    for (const bankStagger of [0, 0.25, 0.5, 0.75, 1]) {
      const harness = createHarness({ morphDuration: 4, rotationAmount: 0, segmentBankPhase: bankStagger })
      update(harness, frame({ timeSec: 0, deltaTimeSec: 0, frameId: 1 }))
      harness.parameters.pattern = 'doubleWing'
      update(harness, frame({ timeSec: 0, deltaTimeSec: 0, frameId: 2 }))
      update(harness, frame({ timeSec: 2, deltaTimeSec: 2, frameId: 3 }))
      execute(harness, frame({ timeSec: 2, deltaTimeSec: 0, frameId: 4 }))

      const instances = lastUploadedInstances(harness.gl)
      const innerAngle = uploadedFixtureAngle(instances, innerIndex)
      const edgeAngle = uploadedFixtureAngle(instances, edgeIndex)
      const separation = Math.abs(innerAngle - edgeAngle)
      separations.push(separation)
      if (bankStagger === 0) expect(separation).toBeCloseTo(0, 5)

      harness.instance.lifecycle.dispose()
      harness.resources.disposeAll()
    }

    for (let index = 1; index < separations.length; index += 1) {
      expect(separations[index]!).toBeGreaterThan(separations[index - 1]!)
    }
  })

  it.each([60, 120, 128, 150, 180])('keeps synchronized bank-transition progress equivalent at %i BPM', (bpm: number) => {
    const harness = createHarness({ morphDuration: 8, rotationAmount: 0, segmentBankPhase: 1 })
    const syncedTransport = (beatPosition: number) => ({
      sourcePresent: true,
      playing: true,
      analysisActive: true,
      paused: false,
      animationActive: true,
      trackId: 'track-a',
      timeSec: beatPosition * 60 / bpm,
      bpm,
      bpmSync: true,
    })

    update(harness, frame({ timeSec: 0, deltaTimeSec: 0, transport: syncedTransport(0), frameId: 1 }))
    harness.parameters.pattern = 'doubleWing'
    update(harness, frame({ timeSec: 0, deltaTimeSec: 0, transport: syncedTransport(0), frameId: 2 }))
    update(harness, frame({
      timeSec: 60 / bpm,
      deltaTimeSec: 60 / bpm,
      transport: syncedTransport(1),
      frameId: 3,
    }))
    update(harness, frame({
      timeSec: 120 / bpm,
      deltaTimeSec: 60 / bpm,
      transport: syncedTransport(2),
      frameId: 4,
    }))
    execute(harness, frame({ timeSec: 120 / bpm, deltaTimeSec: 0, transport: syncedTransport(2), frameId: 5 }))

    const innerIndex = fixtureIndex(fixture => fixture.bank === 'inner' && fixture.quadrant === 'topLeft')
    const instances = lastUploadedInstances(harness.gl)
    // One canonical beat into a two-beat transition resolves the same pose at
    // every BPM; only real-world seconds differ.
    expect(uploadedFixtureAngle(instances, innerIndex)).toBeCloseTo(-Math.PI / 8, 4)

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('freezes a staggered transition on pause, survives rapid Sync toggles, and converges exactly after resume', () => {
    const harness = createHarness({ morphDuration: 4, rotationAmount: 0, segmentBankPhase: 1 })
    update(harness, frame({ timeSec: 0, deltaTimeSec: 0, frameId: 1 }))
    harness.parameters.pattern = 'doubleWing'
    update(harness, frame({ timeSec: 0, deltaTimeSec: 0, frameId: 2 }))
    update(harness, frame({ timeSec: 1.5, deltaTimeSec: 1.5, frameId: 3 }))
    execute(harness, frame({ timeSec: 1.5, deltaTimeSec: 0, frameId: 4 }))
    const beforePause = lastUploadedInstances(harness.gl)

    const pausedTransport = {
      sourcePresent: true, playing: false, analysisActive: true, paused: true, animationActive: false,
      trackId: 'track-a', timeSec: 20, bpm: 150, bpmSync: true,
    }
    update(harness, frame({ timeSec: 20, deltaTimeSec: 18.5, transport: pausedTransport, frameId: 5 }))
    execute(harness, frame({ timeSec: 20, deltaTimeSec: 0, transport: pausedTransport, frameId: 6 }))
    expect(lastUploadedInstances(harness.gl)).toEqual(beforePause)

    const syncOffTransport = { ...pausedTransport, playing: true, paused: false, animationActive: true, timeSec: 20.25, bpmSync: false }
    update(harness, frame({ timeSec: 20.25, deltaTimeSec: 0.25, transport: syncOffTransport, frameId: 7 }))
    const syncOnTransport = { ...syncOffTransport, timeSec: 20.5, bpmSync: true }
    update(harness, frame({ timeSec: 20.5, deltaTimeSec: 0.25, transport: syncOnTransport, frameId: 8 }))
    update(harness, frame({ timeSec: 25, deltaTimeSec: 4.5, transport: { ...syncOffTransport, timeSec: 25 }, frameId: 9 }))
    execute(harness, frame({ timeSec: 25, deltaTimeSec: 0, transport: { ...syncOffTransport, timeSec: 25 }, frameId: 10 }))

    const expected = resolveCinema2InterlockLayout('doubleWing', { width: 1280, height: 720, dpr: 1 })
    const instances = lastUploadedInstances(harness.gl)
    for (let index = 0; index < CINEMA2_INTERLOCK_FIXTURE_COUNT; index += 1) {
      const fixture = expected.fixtures[index]!
      const offset = index * 11
      const dx = fixture.bottom[0] - fixture.top[0]
      const dy = fixture.bottom[1] - fixture.top[1]
      const length = Math.hypot(dx, dy)
      expect(instances[offset]).toBeCloseTo(fixture.middle[0], 4)
      expect(instances[offset + 1]).toBeCloseTo(fixture.middle[1], 4)
      expect(instances[offset + 2]).toBeCloseTo(dx / length, 4)
      expect(instances[offset + 3]).toBeCloseTo(dy / length, 4)
    }

    harness.instance.lifecycle.dispose()
    harness.resources.disposeAll()
  })

  it('replays the same staggered transition deterministically and remains bounded through rapid manual layout changes', () => {
    const run = () => {
      const harness = createHarness({ morphDuration: 3, rotationAmount: 0, segmentBankPhase: 0.75 })
      update(harness, frame({ timeSec: 0, deltaTimeSec: 0, frameId: 1 }))
      harness.parameters.pattern = 'mechanicalIris'
      update(harness, frame({ timeSec: 0, deltaTimeSec: 0, frameId: 2 }))
      update(harness, frame({ timeSec: 0.8, deltaTimeSec: 0.8, frameId: 3 }))
      harness.parameters.pattern = 'bassPortal'
      update(harness, frame({ timeSec: 0.8, deltaTimeSec: 0, frameId: 4 }))
      update(harness, frame({ timeSec: 1.4, deltaTimeSec: 0.6, frameId: 5 }))
      harness.parameters.pattern = 'doubleWing'
      update(harness, frame({ timeSec: 1.4, deltaTimeSec: 0, frameId: 6 }))
      update(harness, frame({ timeSec: 5.5, deltaTimeSec: 4.1, frameId: 7 }))
      execute(harness, frame({ timeSec: 5.5, deltaTimeSec: 0, frameId: 8 }))
      const instances = lastUploadedInstances(harness.gl)
      expect(instances.every(Number.isFinite)).toBe(true)
      expect(lastInstanceCount(harness.gl)).toBe(CINEMA2_INTERLOCK_FIXTURE_COUNT)
      harness.instance.lifecycle.dispose()
      harness.resources.disposeAll()
      return instances
    }

    expect(run()).toEqual(run())
  })

  it('re-anchors stagger timing on source removal and replacement without preserving transient transition progress', () => {
    const harness = createHarness({ morphDuration: 6, rotationAmount: 0, segmentBankPhase: 1 })
    update(harness, frame({ timeSec: 0, deltaTimeSec: 0, frameId: 1 }))
    harness.parameters.pattern = 'fourWayVortex'
    update(harness, frame({ timeSec: 0, deltaTimeSec: 0, frameId: 2 }))
    update(harness, frame({ timeSec: 1, deltaTimeSec: 1, frameId: 3 }))

    const removedTransport = {
      sourcePresent: false, playing: false, analysisActive: false, paused: false, animationActive: true,
      trackId: null, timeSec: 0,
    }
    update(harness, frame({ timeSec: 0, deltaTimeSec: 0, transport: removedTransport, frameId: 4 }))
    execute(harness, frame({ timeSec: 0, deltaTimeSec: 0, transport: removedTransport, frameId: 5 }))
    expect(lastUploadedInstances(harness.gl).every(Number.isFinite)).toBe(true)

    const replacementTransport = {
      sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true,
      trackId: 'track-b', timeSec: 0.25,
    }
    update(harness, frame({ timeSec: 0.25, deltaTimeSec: 0.25, transport: replacementTransport, frameId: 6 }))
    update(harness, frame({ timeSec: 7, deltaTimeSec: 6.75, transport: { ...replacementTransport, timeSec: 7 }, frameId: 7 }))
    execute(harness, frame({ timeSec: 7, deltaTimeSec: 0, transport: { ...replacementTransport, timeSec: 7 }, frameId: 8 }))
    expect(lastInstanceCount(harness.gl)).toBe(CINEMA2_INTERLOCK_FIXTURE_COUNT)
    expect(lastUploadedInstances(harness.gl).every(Number.isFinite)).toBe(true)

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
