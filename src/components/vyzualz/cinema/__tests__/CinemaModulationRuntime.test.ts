import { describe, expect, it } from 'vitest'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  type CinemaCompositionDefinition,
  type CinemaModulationRouteDefinition,
  type CinemaParameterDefinition,
  type CinemaParameterValue,
} from '../CinemaDomain'
import { CINEMA_MODULATION_SOURCE_IDS } from '../CinemaModulationSources'
import { CinemaModulationRuntime } from '../CinemaModulationRuntime'
import {
  cinemaNamespacedId,
  cinemaStableId,
  createCinemaParameterPath,
  type CinemaControlPointId,
  type CinemaEventId,
  type CinemaModulationRouteId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaRendererPluginId,
} from '../CinemaIdentifiers'
import { createCinemaNodeDefinitionRegistry, type CinemaNodeRegistryEntry } from '../CinemaNodeRegistry'
import { resolveCinemaParameterSnapshot } from '../CinemaParameterResolver'
import { CINEMA_SAFE_OUTPUT_DESCRIPTOR, type CinemaFrameContext } from '../CinemaRendererContracts'

const NODE_ID = cinemaStableId<CinemaNodeId>('modulated-node', 'node')
const NODE_TYPE_ID = cinemaNamespacedId<CinemaNodeTypeId>('drmvyz.cinema.effect.modulation-test', 'node type')
const PLUGIN_ID = cinemaNamespacedId<CinemaRendererPluginId>('drmvyz.cinema.renderer.modulation-test', 'renderer plugin')
const AMOUNT_ID = cinemaStableId<CinemaParameterId>('deformation', 'parameter')
const TRIGGER_ID = cinemaStableId<CinemaParameterId>('palette-step', 'parameter')
const AMOUNT_PATH = createCinemaParameterPath('effects', AMOUNT_ID, NODE_ID)
const TRIGGER_PATH = createCinemaParameterPath('effects', TRIGGER_ID, NODE_ID)

const AMOUNT_SCHEMA: Extract<CinemaParameterDefinition, { type: 'float' }> = {
  id: AMOUNT_ID,
  label: 'Deformation',
  type: 'float',
  default: 2,
  min: 0,
  max: 20,
  modulatable: true,
}

const TRIGGER_SCHEMA: Extract<CinemaParameterDefinition, { type: 'trigger' }> = {
  id: TRIGGER_ID,
  label: 'Palette Step',
  type: 'trigger',
  modulatable: false,
}

const REGISTRY_ENTRY: CinemaNodeRegistryEntry = {
  definition: {
    typeId: NODE_TYPE_ID,
    version: 1,
    label: 'Modulation Test',
    family: 'effect',
    inputPorts: [],
    outputPorts: [],
    parameters: [AMOUNT_SCHEMA, TRIGGER_SCHEMA],
    capabilities: {
      backends: ['webgl2'],
      canvas2d: { compatibility: 'unsupported', preservesPremultipliedAlpha: true },
      camera: { mode: 'none', controls: [], autoDirector: false },
      requires: {},
      fallbacks: [],
    },
    cost: {
      cpu: 'minimal',
      gpu: 'minimal',
      estimatedPassCount: 1,
      persistentTargetCount: 0,
      pingPongPairCount: 0,
    },
    seekPolicy: { mode: 'stateless' },
    output: CINEMA_SAFE_OUTPUT_DESCRIPTOR,
  },
  rendererPlugin: { id: PLUGIN_ID, available: true },
  source: { kind: 'built-in', id: 'modulation-test' },
  quality: {
    minimumTier: 'low',
    maximumTier: 'ultra',
    adaptive: true,
    maximumEstimatedPassCount: 1,
    maximumPersistentTargetCount: 0,
    maximumPingPongPairCount: 0,
  },
}

const REGISTRY = createCinemaNodeDefinitionRegistry([REGISTRY_ENTRY]).registry

function route(
  id: string,
  overrides: Partial<CinemaModulationRouteDefinition> = {},
): CinemaModulationRouteDefinition {
  return {
    id: cinemaStableId<CinemaModulationRouteId>(id, 'modulation route'),
    sourceId: CINEMA_MODULATION_SOURCE_IDS.audioBass,
    destination: AMOUNT_PATH,
    mode: 'add',
    amount: 2,
    enabled: true,
    ...overrides,
  }
}

function composition(routes: readonly CinemaModulationRouteDefinition[]): CinemaCompositionDefinition {
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: 'modulation-runtime-test' as CinemaCompositionDefinition['id'],
    revision: 1,
    metadata: { name: 'Modulation Runtime Test' },
    nodes: [{
      id: NODE_ID,
      typeId: NODE_TYPE_ID,
      typeVersion: 1,
      family: 'effect',
      enabled: true,
      opacity: 1,
      parameterValues: { [AMOUNT_ID]: 2, [TRIGGER_ID]: false },
    }],
    connections: [],
    outputNodeId: NODE_ID,
    masterParameters: [],
    masterValues: {},
    cameras: [],
    assetBindings: [],
    modulationRoutes: routes,
    performanceRules: [],
  }
}

function baseValues(fixture: CinemaCompositionDefinition): Readonly<Record<string, CinemaParameterValue>> {
  return resolveCinemaParameterSnapshot({ composition: fixture, registry: REGISTRY }).values
}

function frame(overrides: {
  bass?: number
  audioAvailable?: boolean
  playing?: boolean
  paused?: boolean
  reset?: boolean
  resetGeneration?: number
  vocalsActive?: boolean
  snare?: boolean
  snareEventId?: string | null
  bar8?: boolean
  bar8EventId?: string | null
  deltaTimeSec?: number
  trackId?: string
} = {}): Readonly<CinemaFrameContext> {
  const playing = overrides.playing ?? true
  const paused = overrides.paused ?? false
  const reset = overrides.reset ?? false
  const eventId = (value: string | null | undefined) => value == null ? null : value as CinemaEventId
  const clock = (id: 'beat' | 'beat2' | 'beat4' | 'bar' | 'bar4' | 'bar8' | 'phrase') => ({
    available: true,
    spanBeats: id === 'bar8' ? 32 : 1,
    index: id === 'bar8' ? 1 : 32,
    phase: 0,
    hit: id === 'bar8' ? overrides.bar8 === true : false,
    eventId: id === 'bar8' ? eventId(overrides.bar8EventId) : null,
  })
  return Object.freeze({
    version: 1,
    viewport: { width: 1280, height: 720, dpr: 1 },
    timing: {
      frameIndex: 1,
      elapsedTimeSec: 1,
      deltaTimeSec: overrides.deltaTimeSec ?? 1 / 60,
      seeds: { composition: 1, track: 2, musicalPosition: 3, event: 4 },
    },
    transport: {
      trackId: overrides.trackId ?? 'track-a',
      audioTimeSec: 1,
      durationSec: 120,
      playing,
      paused,
      seeking: reset,
      looped: false,
      visibilitySuspended: false,
      discontinuity: reset,
      discontinuityReasons: reset ? ['seek'] : [],
      reset: {
        required: reset,
        reconstruct: reset,
        generation: overrides.resetGeneration ?? (reset ? 1 : 0),
        reasons: reset ? ['seek'] : [],
        actionIds: reset ? ['cinema.reset.seek'] : [],
        identity: reset ? 'seek:1' : null,
      },
    },
    audio: {
      available: overrides.audioAvailable ?? true,
      volume: 0.5,
      rms: 0.5,
      energy: 0.5,
      bass: overrides.bass ?? 0.5,
      mid: 0.25,
      high: 0.25,
      sub: 0.25,
      centroid: 0.25,
      flux: 0.25,
      harmonicity: 0.25,
      complexity: 0.25,
      tension: 0.25,
      buildProgress: 0,
      dropImpact: 0,
      vocalPresence: overrides.vocalsActive ? 0.8 : 0,
      fft: null,
      waveform: null,
    },
    music: {
      available: true,
      source: 'music-intelligence',
      bpm: 120,
      beatIndex: 32,
      beatPhase: 0,
      beatInBar: 0,
      barIndex: 8,
      phraseIndex: 2,
      sectionId: 'section-a',
      sectionType: 'verse',
      sectionProgress: 0.5,
      clocks: {
        beat: false,
        beat2: false,
        beat4: false,
        bar: false,
        bar4: false,
        bar8: overrides.bar8 === true,
        phrase: false,
        states: {
          beat: clock('beat'),
          beat2: clock('beat2'),
          beat4: clock('beat4'),
          bar: clock('bar'),
          bar4: clock('bar4'),
          bar8: clock('bar8'),
          phrase: clock('phrase'),
        },
      },
    },
    impulses: {
      beat: false,
      downbeat: false,
      kick: false,
      snare: overrides.snare === true,
      transient: overrides.snare === true,
      sectionStart: false,
      dropStart: false,
      lyricCue: false,
      lyricWord: false,
      phrase4: false,
      phrase8: overrides.bar8 === true,
      eventIds: {
        beat: null,
        downbeat: null,
        kick: null,
        snare: eventId(overrides.snareEventId),
        transient: eventId(overrides.snareEventId),
        sectionStart: null,
        dropStart: null,
        lyricCue: null,
        lyricWord: null,
        phrase4: null,
        phrase8: eventId(overrides.bar8EventId),
      },
    },
    lyrics: {
      available: true,
      sourceIdentity: 'lyrics-a',
      lineId: overrides.vocalsActive ? 'line-a' : null,
      lineText: overrides.vocalsActive ? 'Line' : null,
      wordId: null,
      wordText: null,
      lineProgress: 0.25,
      wordProgress: 0,
      vocalsActive: overrides.vocalsActive === true,
    },
    performance: { actionIds: [], toggleStates: {} },
    brand: { available: false, colors: {} },
    capabilities: {
      analyser: true,
      musicIntelligence: true,
      beatGrid: true,
      authoritativeSections: true,
      lyrics: true,
      brandKit: false,
      sharedPerformance: false,
      mediaAssets: false,
    },
    activeCameraId: null,
    camera: null,
  }) as unknown as Readonly<CinemaFrameContext>

}

describe('Cinema modulation runtime', () => {
  it('maps bass into a stable destination and leaves authored values unchanged', () => {
    const fixture = composition([route('bass-deformation')])
    const before = JSON.stringify(fixture)
    const runtime = new CinemaModulationRuntime({ composition: fixture, registry: REGISTRY })
    const modulation = runtime.evaluate(frame({ bass: 0.5 }), baseValues(fixture))

    expect(modulation.values[AMOUNT_PATH]).toBe(3)
    expect(modulation.activeRouteCount).toBe(1)
    expect(Object.isFrozen(modulation)).toBe(true)
    expect(JSON.stringify(fixture)).toBe(before)
  })

  it('resolves authored route order across ranges, curves, replace, multiply, add, and clamps', () => {
    const curve = [
      { id: cinemaStableId<CinemaControlPointId>('curve-start', 'control point'), position: 0, value: 0, interpolation: 'smooth' as const },
      { id: cinemaStableId<CinemaControlPointId>('curve-end', 'control point'), position: 1, value: 1, interpolation: 'linear' as const },
    ]
    const fixture = composition([
      route('replace-range', {
        mode: 'replace',
        inputRange: [0.25, 0.75],
        outputRange: [2, 4],
        amount: 1,
        offset: 1,
        curve,
        clamp: [0, 4],
      }),
      route('multiply-range', { mode: 'multiply', amount: 1 }),
      route('add-range', { mode: 'add', amount: 2 }),
    ])
    const runtime = new CinemaModulationRuntime({ composition: fixture, registry: REGISTRY })

    expect(runtime.evaluate(frame({ bass: 0.5 }), baseValues(fixture)).values[AMOUNT_PATH]).toBe(7)
  })

  it('applies deterministic smoothing after the first sampled value', () => {
    const fixture = composition([route('smoothed-signal', { amount: 1, smoothing: 0.5 })])
    const runtime = new CinemaModulationRuntime({ composition: fixture, registry: REGISTRY })
    const baseline = baseValues(fixture)

    expect(runtime.evaluate(frame({ bass: 0 }), baseline).values[AMOUNT_PATH]).toBe(2)
    expect(runtime.evaluate(frame({ bass: 1, deltaTimeSec: 1 / 60 }), baseline).values[AMOUNT_PATH]).toBeCloseTo(2.5)
  })

  it('fires a snare impulse once per deterministic event identity', () => {
    const fixture = composition([route('snare-hit', {
      sourceId: CINEMA_MODULATION_SOURCE_IDS.impulseSnare,
      mode: 'add',
      amount: 1,
    })])
    const runtime = new CinemaModulationRuntime({ composition: fixture, registry: REGISTRY })
    const baseline = baseValues(fixture)

    expect(runtime.evaluate(frame({ snare: true, snareEventId: 'event-snare-1' }), baseline).values[AMOUNT_PATH]).toBe(3)
    expect(runtime.evaluate(frame({ snare: true, snareEventId: 'event-snare-1' }), baseline).values[AMOUNT_PATH]).toBeUndefined()
    expect(runtime.evaluate(frame({ snare: true, snareEventId: 'event-snare-2' }), baseline).values[AMOUNT_PATH]).toBe(3)
  })

  it('fires an eight-bar trigger once at the intended musical identity', () => {
    const fixture = composition([route('palette-event', {
      sourceId: CINEMA_MODULATION_SOURCE_IDS.clockBar8,
      destination: TRIGGER_PATH,
      mode: 'trigger',
      amount: 1,
    })])
    const runtime = new CinemaModulationRuntime({ composition: fixture, registry: REGISTRY })
    const baseline = baseValues(fixture)

    expect(runtime.evaluate(frame({ bar8: true, bar8EventId: 'event-bar8-1' }), baseline).values[TRIGGER_PATH]).toBe(true)
    expect(runtime.evaluate(frame({ bar8: true, bar8EventId: 'event-bar8-1' }), baseline).values[TRIGGER_PATH]).toBeUndefined()
  })

  it('honors vocal conditions without disabling unrelated routes', () => {
    const fixture = composition([
      route('vocal-bass', { condition: { vocalsActive: true } }),
      route('always-bass', { amount: 1 }),
    ])
    const runtime = new CinemaModulationRuntime({ composition: fixture, registry: REGISTRY })
    const baseline = baseValues(fixture)

    expect(runtime.evaluate(frame({ bass: 0.5, vocalsActive: false }), baseline).values[AMOUNT_PATH]).toBe(2.5)
    expect(runtime.evaluate(frame({ bass: 0.5, vocalsActive: true }), baseline).values[AMOUNT_PATH]).toBe(3.5)
  })

  it('resets deterministic envelopes on seek and freezes them while paused', () => {
    const fixture = composition([route('smoothed-bass', { attackMs: 1000, releaseMs: 1000, amount: 1 })])
    const runtime = new CinemaModulationRuntime({ composition: fixture, registry: REGISTRY })
    const baseline = baseValues(fixture)

    const first = runtime.evaluate(frame({ bass: 1, deltaTimeSec: 0.25 }), baseline)
    const advanced = runtime.evaluate(frame({ bass: 1, deltaTimeSec: 0.25 }), baseline)
    const paused = runtime.evaluate(frame({ bass: 0, playing: false, paused: true, deltaTimeSec: 0 }), baseline)
    const released = runtime.evaluate(frame({ bass: 0, deltaTimeSec: 0.25 }), baseline)
    const sought = runtime.evaluate(frame({ bass: 1, reset: true, resetGeneration: 4, deltaTimeSec: 0.25 }), baseline)

    expect(first.values[AMOUNT_PATH]).toBeCloseTo(2.25)
    expect(advanced.values[AMOUNT_PATH]).toBeCloseTo(2.5)
    expect(paused.values[AMOUNT_PATH]).toBeCloseTo(2.5)
    expect(released.values[AMOUNT_PATH]).toBeCloseTo(2.375)
    expect(sought.values[AMOUNT_PATH]).toBeCloseTo(2.25)
  })

  it('uses a neutral snapshot and a disabled reason when source capability is unavailable', () => {
    const fixture = composition([route('unavailable-bass')])
    const runtime = new CinemaModulationRuntime({ composition: fixture, registry: REGISTRY })
    const evaluated = runtime.evaluate(frame({ audioAvailable: false }), baseValues(fixture))

    expect(evaluated.values).toEqual({})
    expect(evaluated.diagnostics.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_MODULATION_SOURCE_UNAVAILABLE')).toBe(true)
  })

  it('removes deleted routes and diagnoses invalid routes without disabling valid routes', () => {
    const invalid = route('missing-source', {
      sourceId: 'drmvyz.cinema.audio.not-registered' as CinemaModulationRouteDefinition['sourceId'],
    })
    const fixture = composition([invalid, route('valid-bass', { amount: 1 })])
    const runtime = new CinemaModulationRuntime({ composition: fixture, registry: REGISTRY })
    const evaluated = runtime.evaluate(frame({ bass: 0.5 }), baseValues(fixture))

    expect(evaluated.values[AMOUNT_PATH]).toBe(2.5)
    expect(evaluated.diagnostics.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_MODULATION_SOURCE_UNKNOWN')).toBe(true)

    const withoutRoutes = composition([])
    const replaced = new CinemaModulationRuntime({ composition: withoutRoutes, registry: REGISTRY })
    expect(replaced.evaluate(frame({ bass: 1 }), baseValues(withoutRoutes)).values).toEqual({})
  })
})
