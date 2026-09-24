import { describe, expect, it, vi } from 'vitest'

import { createCinemaMockWebGL, type CinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  Cinema2ParameterState,
  CINEMA2_HUMN_BPM_SYNC_ID,
  CINEMA2_HUMN_FRAGMENT_SOURCE,
  CINEMA2_HUMN_MOTION_AMOUNT_ID,
  CINEMA2_HUMN_MOTION_RATE_ID,
  CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
  CINEMA2_HUMN_NATIVE_MODULE_VERSION,
  CINEMA2_HUMN_PRESET_ID,
  CINEMA2_HUMN_PRESET_MANIFEST,
  cinema2NativePresetRegistry,
  createCinema2DesignParentGroupModel,
  resolveCinema2HumNFigureScale,
} from '..'
import {
  cinema2StableId,
  type Cinema2JsonValue,
  type Cinema2ModuleId,
  type Cinema2ModuleManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { cinema2HumNNativeModuleDefinition } from '../modules/Cinema2HumNNativeModule'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleFrameReadContext,
  Cinema2ModuleResourceFacet,
} from '../modules/Cinema2ModuleContracts'

const MODULE_ID = cinema2StableId<Cinema2ModuleId>('hum-n-native-motion-test')

const BASE_PARAMETERS: Record<string, Cinema2JsonValue> = {
  masterIntensity: 1,
  bpmSync: true,
  motionAmount: 0,
  motionRate: '1x',
  figureScale: 1,
  gridPresence: 1,
  linePresence: 1,
  lineWeight: 1,
  fragmentation: 0.55,
  meshDetail: 'Reference',
  facetFill: 0,
  fillStyle: 'Mixed',
  backgroundColor: [0, 0, 0, 1],
  wireframeColor: [245 / 255, 247 / 255, 250 / 255, 1],
  patternInk: [1, 1, 1, 1],
  skinPrimary: [72 / 255, 240 / 255, 221 / 255, 1],
  skinSecondary: [1, 61 / 255, 200 / 255, 1],
  skinAccent: [200 / 255, 1, 74 / 255, 1],
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
    typeId: CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_HUMN_NATIVE_MODULE_VERSION,
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
  const instance = cinema2HumNNativeModuleDefinition.create(context)
  const provider = instance.render?.providers[0]
  if (!provider) throw new Error('Expected HUM:N native render provider')
  return { gl, parameters, resources, parameterFacet, targetFacet, instance, provider }
}

function bpmAudio(value: number | null, available = value != null): Cinema2ModuleFrameReadContext['audio'] {
  return {
    rhythm: {
      bpm: { available, value, confidence: available ? 0.95 : null, source: available ? 'test-analysis' : null, provenance: null },
    },
  } as unknown as Cinema2ModuleFrameReadContext['audio']
}

function frame(options: {
  frameId?: number
  timeSec?: number
  deltaTimeSec?: number
  contextGeneration?: number
  trackId?: string | null
  paused?: boolean
  animationActive?: boolean
  bpmSync?: boolean
  bpm?: number | null
  analyzedBpm?: number | null
} = {}): Cinema2ModuleFrameReadContext {
  const timeSec = options.timeSec ?? 0
  const paused = options.paused ?? false
  return {
    frameId: options.frameId ?? 1,
    timestampMs: timeSec * 1000,
    deltaTimeSec: options.deltaTimeSec ?? 0.1,
    elapsedTimeSec: timeSec,
    viewport: { width: 1280, height: 720, dpr: 1 },
    contextGeneration: options.contextGeneration ?? 1,
    transport: {
      sourcePresent: options.trackId !== null,
      playing: !paused,
      analysisActive: true,
      paused,
      animationActive: options.animationActive ?? !paused,
      trackId: options.trackId === undefined ? 'track-a' : options.trackId,
      timeSec,
      bpmSync: options.bpmSync ?? true,
      bpm: options.bpm ?? 120,
    },
    audio: bpmAudio(options.analyzedBpm ?? null),
    director: null,
  }
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

function lastUniformFloat(gl: CinemaMockWebGL, name: string): number | undefined {
  const calls = (gl.uniform1f as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .filter(call => (call[0] as { name?: string } | null)?.name === name)
  return calls.length > 0 ? calls[calls.length - 1]?.[1] as number | undefined : undefined
}

describe('Cinema 2.0 HUM:N Phase C native motion and BPM Sync', () => {
  it('projects the approved controls into flat Master Controls and Design > Motion with exact defaults and authority', () => {
    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_HUMN_PRESET_ID, { availableCapabilities: ['render.webgl2'] })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return

    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const definitions = new Map(compiled.plan.parameters.definitions.map(definition => [definition.id, definition]))
    expect(definitions.get(CINEMA2_HUMN_BPM_SYNC_ID)).toMatchObject({
      label: 'BPM Sync', type: 'boolean', defaultValue: true, designParentGroup: 'master-controls',
      modulatable: false, choreographable: false, automatable: false,
    })
    expect(definitions.get(CINEMA2_HUMN_MOTION_AMOUNT_ID)).toMatchObject({
      label: 'Motion Amount', type: 'float', defaultValue: 0, min: 0, max: 1, step: 0.01,
      group: 'Motion', designParentGroup: 'design', modulatable: true, choreographable: false, automatable: false,
    })
    expect(definitions.get(CINEMA2_HUMN_MOTION_RATE_ID)).toMatchObject({
      label: 'Motion Rate', type: 'enum', defaultValue: '1x', group: 'Motion', designParentGroup: 'design',
      modulatable: false, choreographable: false, automatable: false,
    })
    expect(definitions.get(CINEMA2_HUMN_MOTION_RATE_ID)?.options?.map(option => option.value)).toEqual(['1/2x', '1x', '2x', '4x'])

    const design = createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot())
    const master = design.find(parent => parent.id === 'master-controls')
    expect(master?.groups).toEqual([])
    expect(master?.controls.map(control => control.definition.label)).toEqual(expect.arrayContaining(['Master Intensity', 'BPM Sync']))
    expect(design.find(parent => parent.id === 'design')?.groups.find(group => group.label === 'Motion')?.controls.map(control => control.definition.label)).toEqual(['Motion Amount', 'Motion Rate'])

    const module = CINEMA2_HUMN_PRESET_MANIFEST.modules?.[0]
    expect(module?.parameters).toMatchObject({ bpmSync: true, motionAmount: 0, motionRate: '1x' })
    expect(module?.parameterBindings).toMatchObject({
      bpmSync: { $ref: CINEMA2_HUMN_BPM_SYNC_ID },
      motionAmount: { $ref: CINEMA2_HUMN_MOTION_AMOUNT_ID },
      motionRate: { $ref: CINEMA2_HUMN_MOTION_RATE_ID },
    })
  })

  it('keeps Motion Amount 0 as an exact static branch and emits authored motion only above zero', () => {
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('if (amount <= 0.000001) return p;')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('p = applyHumNNativeMotion(p);')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).not.toContain('u_audio')

    const frozen = createHarness({ motionAmount: 0 })
    execute(frozen, frame({ timeSec: 1, deltaTimeSec: 0.1, analyzedBpm: 180 }))
    execute(frozen, frame({ frameId: 2, timeSec: 1.1, deltaTimeSec: 0.1, analyzedBpm: 180 }))
    expect(lastUniformFloat(frozen.gl, 'u_motionAmount')).toBe(0)
    expect(lastUniformFloat(frozen.gl, 'u_motionTime')).toBeCloseTo(0.3, 6)
    expect(frozen.gl.__calls.drawCount).toBe(2)

    const moving = createHarness({ motionAmount: 1 })
    execute(moving, frame({ timeSec: 1, deltaTimeSec: 0.1, analyzedBpm: 180 }))
    const first = lastUniformFloat(moving.gl, 'u_motionTime')
    execute(moving, frame({ frameId: 2, timeSec: 1.1, deltaTimeSec: 0.1, analyzedBpm: 180 }))
    const second = lastUniformFloat(moving.gl, 'u_motionTime')
    expect(lastUniformFloat(moving.gl, 'u_motionAmount')).toBe(1)
    expect(second).toBeGreaterThan(first ?? 0)
  })

  it('reserves a motion-dependent safe-frame envelope without changing the approved static scale', () => {
    const staticScale = resolveCinema2HumNFigureScale(1.3, 1280, 720, 0)
    const legacyStaticCall = resolveCinema2HumNFigureScale(1.3, 1280, 720)
    const movingScale = resolveCinema2HumNFigureScale(1.3, 1280, 720, 1)
    expect(staticScale).toBeCloseTo(legacyStaticCall, 10)
    expect(movingScale).toBeLessThan(staticScale)
    expect(movingScale).toBeGreaterThanOrEqual(0.7)
  })

  it('applies every Motion Rate as a phase multiplier', () => {
    const cases = [['1/2x', 0.05], ['1x', 0.1], ['2x', 0.2], ['4x', 0.4]] as const
    for (const [motionRate, expected] of cases) {
      const harness = createHarness({ motionAmount: 1, motionRate, bpmSync: false })
      execute(harness, frame({ timeSec: 1, deltaTimeSec: 0.1, bpmSync: true, bpm: 180 }))
      expect(lastUniformFloat(harness.gl, 'u_motionTime')).toBeCloseTo(expected, 6)
    }
  })

  it('uses analyzed BPM first, falls back to transport BPM, and visibly differs when preset BPM Sync is off', () => {
    const analyzed = createHarness({ motionAmount: 1, bpmSync: true })
    execute(analyzed, frame({ timeSec: 1, deltaTimeSec: 0.1, bpmSync: true, bpm: 90, analyzedBpm: 180 }))
    expect(lastUniformFloat(analyzed.gl, 'u_motionTime')).toBeCloseTo(0.15, 6)

    const fallback = createHarness({ motionAmount: 1, bpmSync: true })
    execute(fallback, frame({ timeSec: 1, deltaTimeSec: 0.1, bpmSync: true, bpm: 90, analyzedBpm: null }))
    expect(lastUniformFloat(fallback.gl, 'u_motionTime')).toBeCloseTo(0.075, 6)

    const free = createHarness({ motionAmount: 1, bpmSync: false })
    execute(free, frame({ timeSec: 1, deltaTimeSec: 0.1, bpmSync: true, bpm: 90, analyzedBpm: 180 }))
    expect(lastUniformFloat(free.gl, 'u_motionTime')).toBeCloseTo(0.1, 6)
  })

  it('freezes on pause and resets deterministically on seek, source replacement, and context generation changes', () => {
    const harness = createHarness({ motionAmount: 1, bpmSync: true })
    execute(harness, frame({ frameId: 1, timeSec: 10, deltaTimeSec: 0.1, analyzedBpm: 120 }))
    expect(lastUniformFloat(harness.gl, 'u_motionTime')).toBeCloseTo(0.1, 6)

    execute(harness, frame({ frameId: 2, timeSec: 10, deltaTimeSec: 2, paused: true, animationActive: false, analyzedBpm: 120 }))
    expect(lastUniformFloat(harness.gl, 'u_motionTime')).toBeCloseTo(0.1, 6)

    execute(harness, frame({ frameId: 3, timeSec: 10.1, deltaTimeSec: 0.1, analyzedBpm: 120 }))
    expect(lastUniformFloat(harness.gl, 'u_motionTime')).toBeCloseTo(0.2, 6)

    execute(harness, frame({ frameId: 4, timeSec: 2, deltaTimeSec: 0.1, analyzedBpm: 120 }))
    expect(lastUniformFloat(harness.gl, 'u_motionTime')).toBeCloseTo(0.1, 6)

    execute(harness, frame({ frameId: 5, timeSec: 2.1, deltaTimeSec: 0.1, trackId: 'track-b', analyzedBpm: 120 }))
    expect(lastUniformFloat(harness.gl, 'u_motionTime')).toBeCloseTo(0.1, 6)

    execute(harness, frame({ frameId: 6, timeSec: 2.2, deltaTimeSec: 0.1, trackId: 'track-b', contextGeneration: 2, analyzedBpm: 120 }))
    expect(lastUniformFloat(harness.gl, 'u_motionTime')).toBeCloseTo(0.1, 6)
  })

  it('re-enters deterministically with the same first native motion phase after switch-away/dispose', () => {
    const first = createHarness({ motionAmount: 0.7, motionRate: '2x', bpmSync: true })
    const firstFrame = frame({ frameId: 1, timeSec: 0.1, deltaTimeSec: 0.1, analyzedBpm: 150 })
    execute(first, firstFrame)
    const firstPhase = lastUniformFloat(first.gl, 'u_motionTime')
    first.instance.lifecycle.dispose()
    first.resources.disposeAll()

    const reentered = createHarness({ motionAmount: 0.7, motionRate: '2x', bpmSync: true })
    execute(reentered, firstFrame)
    expect(lastUniformFloat(reentered.gl, 'u_motionTime')).toBeCloseTo(firstPhase ?? -1, 6)
    expect(lastUniformFloat(reentered.gl, 'u_motionAmount')).toBeCloseTo(0.7, 6)
  })
})
