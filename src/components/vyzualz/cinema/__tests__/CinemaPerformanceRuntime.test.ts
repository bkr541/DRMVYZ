import { describe, expect, it } from 'vitest'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
  type CinemaCompositionDefinition,
  type CinemaPerformanceAction,
  type CinemaPerformanceRuleDefinition,
} from '../CinemaDomain'
import {
  createCinemaParameterPath,
  type CinemaActionId,
  type CinemaCameraId,
  type CinemaEventId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaPerformanceRuleId,
} from '../CinemaIdentifiers'
import { CinemaPerformanceRuntime, validateCinemaPerformanceRules } from '../CinemaPerformanceRuntime'
import type { CinemaFrameContext } from '../CinemaRendererContracts'

const NODE_ID = 'particles-node' as CinemaNodeId
const EFFECT_ID = 'feedback-node' as CinemaNodeId
const CAMERA_ID = 'push-camera' as CinemaCameraId
const INTENSITY_ID = 'intensity' as CinemaParameterId
const FEEDBACK_ID = 'feedback-amount' as CinemaParameterId
const INTENSITY_PATH = createCinemaParameterPath('master', INTENSITY_ID)
const FEEDBACK_PATH = createCinemaParameterPath('effects', FEEDBACK_ID, EFFECT_ID)

const action = <Action extends Omit<CinemaPerformanceAction, 'schemaVersion' | 'id'>>(
  id: string,
  value: Action,
): CinemaPerformanceAction => ({
  schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  id: id as CinemaActionId,
  ...value,
}) as unknown as CinemaPerformanceAction

function rule(
  id: string,
  priority: number,
  event: CinemaPerformanceRuleDefinition['condition']['event'],
  actions: readonly CinemaPerformanceAction[],
): CinemaPerformanceRuleDefinition {
  return {
    schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
    id: id as CinemaPerformanceRuleId,
    label: id,
    priority,
    enabled: true,
    condition: { schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION, event },
    actions,
  }
}

function composition(performanceRules: readonly CinemaPerformanceRuleDefinition[]): CinemaCompositionDefinition {
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: 'performance-runtime-test' as CinemaCompositionDefinition['id'],
    revision: 1,
    metadata: { name: 'Performance Runtime Test' },
    nodes: [
      node(NODE_ID, 'drmvyz.cinema.procedural.performance-test' as CinemaNodeTypeId, 'procedural'),
      node(EFFECT_ID, 'drmvyz.cinema.effect.performance-test' as CinemaNodeTypeId, 'effect'),
    ],
    connections: [],
    outputNodeId: NODE_ID,
    masterParameters: [{
      id: INTENSITY_ID,
      label: 'Intensity',
      type: 'float',
      default: 0.5,
      min: 0,
      max: 1,
      modulatable: true,
    }],
    masterValues: { [INTENSITY_ID]: 0.5 },
    cameras: [{ id: CAMERA_ID, label: 'Push', mode: 'dolly', parameterValues: {} }],
    assetBindings: [],
    modulationRoutes: [],
    performanceRules,
  }
}

function node(id: CinemaNodeId, typeId: CinemaNodeTypeId, family: 'procedural' | 'effect') {
  return { id, typeId, typeVersion: 1, family, enabled: true, opacity: 1, parameterValues: {} }
}

describe('CinemaPerformanceRuntime', () => {
  it('coordinates a drop, resolves priority deterministically, and expires beat durations', () => {
    const fixture = composition([
      rule('low-priority-drop', 10, 'dropStart', [
        action('low-intensity', { type: 'set-parameter', destination: INTENSITY_PATH, value: 0.2, duration: { value: 2, unit: 'beats' } }),
      ]),
      rule('hero-drop', 100, 'dropStart', [
        action('hero-intensity', { type: 'set-parameter', destination: INTENSITY_PATH, value: 0.95, duration: { value: 2, unit: 'beats' } }),
        action('hero-camera', { type: 'select-camera', cameraId: CAMERA_ID, duration: { value: 2, unit: 'beats' } }),
        action('hero-particles', { type: 'set-node-enabled', nodeId: NODE_ID, enabled: true, duration: { value: 2, unit: 'beats' } }),
        action('hero-feedback-hold', { type: 'set-parameter', destination: FEEDBACK_PATH, value: 0.85, duration: { value: 2, unit: 'beats' } }),
        action('hero-feedback', { type: 'resetFeedback', nodeId: EFFECT_ID }),
      ]),
    ])
    const runtime = new CinemaPerformanceRuntime(fixture)

    const first = runtime.evaluate(frame({ beatIndex: 32, dropStart: true, dropEventId: 'drop:track-a:32' }))
    expect(first.parameterOverrides[INTENSITY_PATH]).toBe(0.95)
    expect(first.activeCameraId).toBe(CAMERA_ID)
    expect(first.nodeEnabledOverrides[NODE_ID]).toBe(true)
    expect(first.parameterOverrides[FEEDBACK_PATH]).toBe(0.85)
    expect(first.stateCommands).toMatchObject([{ type: 'resetFeedback', nodeId: EFFECT_ID }])

    const duplicate = runtime.evaluate(frame({ beatIndex: 32, dropStart: true, dropEventId: 'drop:track-a:32', frameIndex: 2 }))
    expect(duplicate.stateCommands).toHaveLength(0)
    expect(duplicate.parameterOverrides[INTENSITY_PATH]).toBe(0.95)

    const secondBeat = runtime.evaluate(frame({ beatIndex: 33, frameIndex: 3 }))
    expect(secondBeat.parameterOverrides[INTENSITY_PATH]).toBe(0.95)
    expect(secondBeat.parameterOverrides[FEEDBACK_PATH]).toBe(0.85)

    const expired = runtime.evaluate(frame({ beatIndex: 34, frameIndex: 4 }))
    expect(expired.parameterOverrides[INTENSITY_PATH]).toBeUndefined()
    expect(expired.parameterOverrides[FEEDBACK_PATH]).toBeUndefined()
    expect(expired.activeCameraId).toBeNull()
  })


  it('uses the normalized bar span for authored bar durations', () => {
    const runtime = new CinemaPerformanceRuntime(composition([
      rule('three-four-hold', 30, 'bar', [
        action('three-four-intensity', {
          type: 'set-parameter',
          destination: INTENSITY_PATH,
          value: 0.75,
          duration: { value: 1, unit: 'bars' },
        }),
      ]),
    ]))

    const first = runtime.evaluate(frame({ beatIndex: 12, bar: true, barEventId: 'bar:track-a:4', barSpanBeats: 3 }))
    expect(first.parameterOverrides[INTENSITY_PATH]).toBe(0.75)
    expect(runtime.evaluate(frame({ beatIndex: 14, frameIndex: 2, barSpanBeats: 3 })).parameterOverrides[INTENSITY_PATH]).toBe(0.75)
    expect(runtime.evaluate(frame({ beatIndex: 15, frameIndex: 3, barSpanBeats: 3 })).parameterOverrides[INTENSITY_PATH]).toBeUndefined()
  })

  it('starts a fresh deterministic event pass on loop wrap without duplicating the reset frame', () => {
    const runtime = new CinemaPerformanceRuntime(composition([
      rule('loop-drop', 20, 'dropStart', [action('loop-reset', { type: 'resetNodeState', nodeId: NODE_ID })]),
    ]))
    const firstPass = frame({ beatIndex: 64, dropStart: true, dropEventId: 'drop:track-a:64' })
    expect(runtime.evaluate(firstPass).stateCommands).toHaveLength(1)
    expect(runtime.evaluate(firstPass).stateCommands).toHaveLength(0)

    const loopFrame = frame({
      beatIndex: 64,
      frameIndex: 2,
      dropStart: true,
      dropEventId: 'drop:track-a:64',
      resetReason: 'loop-wrap',
      resetGeneration: 2,
    })
    expect(runtime.evaluate(loopFrame).stateCommands).toHaveLength(1)
    expect(runtime.evaluate(loopFrame).stateCommands).toHaveLength(0)
  })

  it('consumes rapid manual actions once by sequence identity without collapsing duplicates', () => {
    const fixture = composition([{
      ...rule('manual-reset', 50, 'manual', [action('manual-reseed', { type: 'reseedSimulation', nodeId: NODE_ID })]),
      condition: {
        schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
        event: 'manual',
        manualActionIds: ['pad-hit' as CinemaActionId],
      },
    }])
    const runtime = new CinemaPerformanceRuntime(fixture)
    const manualFrame = frame({
      events: [
        { actionId: 'pad-hit' as CinemaActionId, sequence: 41 },
        { actionId: 'pad-hit' as CinemaActionId, sequence: 42 },
      ],
    })

    const first = runtime.evaluate(manualFrame)
    expect(first.stateCommands.map(command => command.eventIdentity)).toEqual([
      'manual:41:pad-hit',
      'manual:42:pad-hit',
    ])
    expect(runtime.evaluate(manualFrame).stateCommands).toHaveLength(0)
  })

  it('reports malformed action payloads without throwing during graph validation', () => {
    const malformed = structuredClone(composition([])) as unknown as {
      performanceRules: unknown[]
    }
    malformed.performanceRules = [{
      schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
      id: 'malformed-rule',
      label: 'Malformed Rule',
      priority: 1,
      enabled: true,
      condition: { schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION, event: 'dropStart' },
      actions: [{
        schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
        id: 'malformed-palette',
        type: 'set-palette',
        colors: null,
      }],
    }]

    const diagnostics = validateCinemaPerformanceRules(malformed as unknown as CinemaCompositionDefinition)
    expect(diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_PERFORMANCE_RULE_INVALID')).toBe(true)
  })

  it('does not refire historical transient commands after a seek', () => {
    const runtime = new CinemaPerformanceRuntime(composition([
      rule('seek-safe-drop', 20, 'dropStart', [action('seek-safe-reset', { type: 'resetNodeState', nodeId: NODE_ID })]),
    ]))
    const event = frame({ beatIndex: 64, dropStart: true, dropEventId: 'drop:track-a:64' })
    expect(runtime.evaluate(event).stateCommands).toHaveLength(1)
    expect(runtime.evaluate(frame({
      beatIndex: 64,
      dropStart: true,
      dropEventId: 'drop:track-a:64',
      resetReason: 'seek',
      resetGeneration: 1,
      frameIndex: 2,
    })).stateCommands).toHaveLength(0)
  })
})

function frame(options: {
  beatIndex?: number
  frameIndex?: number
  dropStart?: boolean
  dropEventId?: string
  bar?: boolean
  barEventId?: string
  barSpanBeats?: number
  resetReason?: 'seek' | 'loop-wrap' | 'playback-restart'
  resetGeneration?: number
  events?: readonly { actionId: CinemaActionId; sequence: number }[]
} = {}): Readonly<CinemaFrameContext> {
  const beatIndex = options.beatIndex ?? 16
  const dropEventId = options.dropEventId as CinemaEventId | undefined
  const barEventId = options.barEventId as CinemaEventId | undefined
  const reset = options.resetReason != null
  const resetGeneration = options.resetGeneration ?? (reset ? 1 : 0)
  const clock = (spanBeats: number, eventId: CinemaEventId | null = null) => ({
    available: true,
    spanBeats,
    index: beatIndex,
    phase: 0,
    hit: eventId != null,
    eventId,
  })
  return {
    version: 1,
    viewport: { width: 1280, height: 720, dpr: 1 },
    timing: {
      frameIndex: options.frameIndex ?? 1,
      elapsedTimeSec: beatIndex / 2,
      deltaTimeSec: 1 / 60,
      seeds: { composition: 1, track: 2, musicalPosition: beatIndex, event: 4 },
    },
    transport: {
      trackId: 'track-a', audioTimeSec: beatIndex / 2, durationSec: 120, playing: true, paused: false,
      seeking: reset, looped: false, visibilitySuspended: false, discontinuity: reset,
      discontinuityReasons: reset ? ['seek'] : [],
      reset: {
        required: reset,
        reconstruct: reset,
        generation: resetGeneration,
        reasons: options.resetReason ? [options.resetReason] : [],
        actionIds: reset ? [`cinema.reset.${options.resetReason}`] : [],
        identity: reset ? `${options.resetReason}:${resetGeneration}` : null,
      },
    },
    audio: {
      available: true, volume: 0.5, rms: 0.5, energy: 0.6, bass: 0.5, mid: 0.5, high: 0.5,
      sub: 0.5, centroid: 0.5, flux: 0.5, harmonicity: 0.5, complexity: 0.5, tension: 0.5,
      buildProgress: 0, dropImpact: options.dropStart ? 1 : 0, vocalPresence: 0, fft: null, waveform: null,
    },
    music: {
      available: true, source: 'music-intelligence', bpm: 120, beatIndex, beatPhase: 0, beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4), phraseIndex: Math.floor(beatIndex / 16), sectionId: 'drop-section',
      sectionType: 'drop', sectionProgress: 0.5,
      clocks: {
        beat: false, beat2: false, beat4: false, bar: options.bar === true, bar4: false, bar8: false, phrase: false,
        states: {
          beat: clock(1),
          beat2: clock(2),
          beat4: clock(4),
          bar: clock(options.barSpanBeats ?? 4, barEventId ?? null),
          bar4: clock((options.barSpanBeats ?? 4) * 4),
          bar8: clock((options.barSpanBeats ?? 4) * 8),
          phrase: clock((options.barSpanBeats ?? 4) * 8),
        },
      },
    },
    lyrics: { available: false, vocalsActive: false, cue: null, word: null },
    impulses: {
      beat: false, downbeat: false, sectionStart: false, dropStart: options.dropStart === true,
      lyricCue: false, lyricWord: false,
      eventIds: { beat: null, downbeat: null, sectionStart: null, dropStart: dropEventId ?? null, lyricCue: null, lyricWord: null },
    },
    performance: {
      events: options.events ?? [],
      actionIds: (options.events ?? []).map(event => event.actionId),
      toggleStates: {},
    },
    brand: { available: false, palette: {}, logoAssetId: null },
    capabilities: { analyser: true, musicIntelligence: true, authoritativeSections: true, lyrics: false, sharedPerformance: true, brandKit: false },
  } as unknown as Readonly<CinemaFrameContext>
}
