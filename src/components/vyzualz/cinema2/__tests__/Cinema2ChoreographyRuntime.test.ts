import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver, type Cinema2TargetHandle } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset, type Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'

const MAP_ID = cinema2StableId<Cinema2ParameterId>('map-output')
const ADD_ID = cinema2StableId<Cinema2ParameterId>('add-output')
const MULTIPLY_ID = cinema2StableId<Cinema2ParameterId>('multiply-output')
const REPLACE_ID = cinema2StableId<Cinema2ParameterId>('replace-output')
const EVENT_ID = cinema2StableId<Cinema2ParameterId>('event-output')
const TOGGLE_ID = cinema2StableId<Cinema2ParameterId>('toggle-output')
const TRIGGER_ID = cinema2StableId<Cinema2ParameterId>('trigger-output')

function ruleId(value: string) {
  return cinema2StableId<Cinema2ChoreographyRuleId>(value)
}

function actionId(value: string) {
  return cinema2StableId<Cinema2ChoreographyActionId>(value)
}

function baseManifest(rules: Cinema2NativePresetManifest['choreography'] extends infer _T ? NonNullable<Cinema2NativePresetManifest['choreography']>['rules'] : never): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.choreography-test'),
    revision: 1,
    metadata: { name: 'Choreography Runtime Test' },
    capabilities: [
      { id: 'audio.features', requirement: 'optional' },
      { id: 'music.rhythm-events', requirement: 'optional' },
      { id: 'music.beat', requirement: 'optional' },
      { id: 'visual-director.significance', requirement: 'optional' },
    ],
    parameters: [
      { id: MAP_ID, label: 'Map', type: 'float', defaultValue: 1, min: -20, max: 20 },
      { id: ADD_ID, label: 'Add', type: 'float', defaultValue: 0.5, min: -20, max: 20 },
      { id: MULTIPLY_ID, label: 'Multiply', type: 'float', defaultValue: 2, min: -20, max: 20 },
      { id: REPLACE_ID, label: 'Replace', type: 'float', defaultValue: 0.25, min: -20, max: 20 },
      { id: EVENT_ID, label: 'Event', type: 'float', defaultValue: 0.2, min: -20, max: 20 },
      { id: TOGGLE_ID, label: 'Toggle', type: 'boolean', defaultValue: false },
      { id: TRIGGER_ID, label: 'Trigger', type: 'trigger' },
    ],
    choreography: { rules },
  }
}

function compile(manifest: Cinema2NativePresetManifest): Readonly<Cinema2CompiledPresetPlan> {
  const result = compileCinema2NativePreset(manifest, {
    availableCapabilities: ['audio.features', 'music.rhythm-events', 'music.beat', 'visual-director.significance'],
  })
  if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n'))
  return result.plan
}

function targetFor(plan: Readonly<Cinema2CompiledPresetPlan>, parameterId: Cinema2ParameterId): Readonly<Cinema2TargetHandle> {
  const target = plan.targets.targets.find(candidate => candidate.kind === 'parameter' && candidate.ownerId === parameterId && candidate.property === 'value')
  if (!target) throw new Error(`Missing target for ${parameterId}`)
  return target
}

function harness(manifest: Cinema2NativePresetManifest) {
  const plan = compile(manifest)
  const parameterState = new Cinema2ParameterState(plan.parameters)
  const dispatched: string[] = []
  const resolver = new Cinema2FinalValueResolver(plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : parameterState.getValue(target.parameterId),
    dispatchAction: event => dispatched.push(event.eventId),
  })
  const runtime = new Cinema2ChoreographyRuntime(plan, parameterState, resolver)
  const director = new Cinema2VisualDirector()
  let sourceFrame = {
    ...DEFAULT_MI_FRAME,
    frameId: 1,
    sourceId: 'cinema2-choreography-test',
    timeSec: 1,
    energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.5, buildProgress: 0.5, dropImpact: 0.5 },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.95,
      beatIndex: 2,
      beatPhase: 0,
      beatInBar: 2,
      barIndex: 0,
      transientConfidence: 0.95,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.95 },
  }
  let publicationSequence = 1
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => sourceFrame,
    getPublicationMeta: () => ({
      sequence: publicationSequence,
      publishedAtMs: sourceFrame.timeSec * 1000,
      publisherId: 'cinema2-choreography-test',
      kind: 'frame' as const,
    }),
  })
  let visualFrameId = 0
  let priorTimestampMs = sourceFrame.timeSec * 1000

  const nextFrame = (timestampMs = sourceFrame.timeSec * 1000): Readonly<Cinema2ModuleFrameReadContext> => {
    const audio = bridge.capture(++visualFrameId)
    const frame = Object.freeze({
      frameId: visualFrameId,
      timestampMs,
      deltaTimeSec: Math.max(0, (timestampMs - priorTimestampMs) / 1000),
      elapsedTimeSec: timestampMs / 1000,
      viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }),
      contextGeneration: 1,
      audio,
      director: director.capture(audio),
    })
    priorTimestampMs = timestampMs
    return frame
  }

  const updateSource = (patch: Partial<typeof sourceFrame>) => {
    publicationSequence += 1
    sourceFrame = {
      ...sourceFrame,
      ...patch,
      frameId: patch.frameId ?? sourceFrame.frameId + 1,
    }
  }

  return { plan, parameterState, resolver, runtime, dispatched, nextFrame, updateSource, getSource: () => sourceFrame }
}

describe('Cinema 2.0 deterministic choreography runtime', () => {
  it('composes map/add/multiply/replace continuous mappings without mutating persistent state', () => {
    const h = harness(baseManifest([
      {
        id: ruleId('continuous'),
        priority: 10,
        source: { signal: 'continuous', capability: 'audio.features', path: 'audio.features.overallEnergy' },
        actions: [
          { id: actionId('map'), target: { kind: 'parameter', ref: cinema2Ref(MAP_ID) }, operation: 'map', map: { outputMin: 2, outputMax: 4 } },
          { id: actionId('add'), target: { kind: 'parameter', ref: cinema2Ref(ADD_ID) }, operation: 'add', value: 2 },
          { id: actionId('multiply'), target: { kind: 'parameter', ref: cinema2Ref(MULTIPLY_ID) }, operation: 'multiply', value: 3 },
          { id: actionId('replace'), target: { kind: 'parameter', ref: cinema2Ref(REPLACE_ID) }, operation: 'replace', value: 4 },
        ],
      },
    ]))
    const serializedBefore = h.parameterState.serialize()
    h.runtime.update(h.nextFrame())

    expect(h.resolver.resolve(targetFor(h.plan, MAP_ID).id).value).toBeCloseTo(3)
    expect(h.resolver.resolve(targetFor(h.plan, ADD_ID).id).value).toBeCloseTo(1.5)
    expect(h.resolver.resolve(targetFor(h.plan, MULTIPLY_ID).id).value).toBeCloseTo(4)
    expect(h.resolver.resolve(targetFor(h.plan, REPLACE_ID).id).value).toBeCloseTo(2)
    expect(h.parameterState.serialize()).toBe(serializedBefore)
    expect(h.runtime.getSnapshot().activeContributionCount).toBe(4)
  })

  it('deduplicates a stable kick event across render frames and advances its attack/hold/release envelope', () => {
    const h = harness(baseManifest([
      {
        id: ruleId('kick-envelope'),
        priority: 20,
        source: { signal: 'kick', capability: 'music.rhythm-events' },
        actions: [{
          id: actionId('kick-envelope-action'),
          target: { kind: 'parameter', ref: cinema2Ref(EVENT_ID) },
          operation: 'envelope',
          composition: 'add',
          value: 0.6,
          envelope: { attack: 0, hold: 0.5, release: 0.5, unit: 'beats' },
          retrigger: 'restart',
        }],
      },
    ]))
    const source = h.getSource()
    h.updateSource({
      timeSec: 1,
      rhythm: { ...source.rhythm, kickHit: true, kickStrength: 1, transientConfidence: 0.95 },
    })
    h.runtime.update(h.nextFrame(1000))
    const target = targetFor(h.plan, EVENT_ID)
    expect(h.resolver.resolve(target.id).value).toBeCloseTo(0.8)
    expect(h.runtime.getSnapshot()).toMatchObject({ activeEnvelopeCount: 1, seenEventCount: 1 })

    h.runtime.update(h.nextFrame(1100))
    expect(h.runtime.getSnapshot().deduplicatedEventCount).toBe(1)
    expect(h.runtime.getSnapshot().activeEnvelopeCount).toBe(1)

    const current = h.getSource()
    h.updateSource({
      timeSec: 1.375,
      rhythm: { ...current.rhythm, kickHit: false, beatPhase: 0.75 },
    })
    h.runtime.update(h.nextFrame(1375))
    expect(h.resolver.resolve(target.id).value).toBeCloseTo(0.5, 5)
  })

  it('honors cooldown and quantization before dispatching action-channel events', () => {
    const h = harness(baseManifest([
      {
        id: ruleId('quantized-trigger'),
        priority: 10,
        source: { signal: 'kick', capability: 'music.rhythm-events' },
        actions: [{
          id: actionId('quantized-trigger-action'),
          target: { kind: 'parameter', ref: cinema2Ref(TRIGGER_ID) },
          operation: 'trigger',
          quantizeBeats: 1,
          cooldownBeats: 1,
        }],
      },
    ]))
    const first = h.getSource()
    h.updateSource({
      timeSec: 1.1,
      rhythm: { ...first.rhythm, kickHit: true, kickStrength: 1, beatIndex: 2, beatPhase: 0.2, transientConfidence: 0.95 },
    })
    h.runtime.update(h.nextFrame(1100))
    expect(h.runtime.getSnapshot().pendingEventCount).toBe(1)
    expect(h.dispatched).toHaveLength(0)

    const second = h.getSource()
    h.updateSource({ timeSec: 1.5, rhythm: { ...second.rhythm, kickHit: false, beatIndex: 3, beatPhase: 0 } })
    h.runtime.update(h.nextFrame(1500))
    expect(h.runtime.getSnapshot().pendingEventCount).toBe(0)
    expect(h.dispatched).toHaveLength(1)

    const third = h.getSource()
    h.updateSource({ timeSec: 1.7, rhythm: { ...third.rhythm, kickHit: true, kickStrength: 1, beatIndex: 3, beatPhase: 0.4 } })
    h.runtime.update(h.nextFrame(1700))
    const fourth = h.getSource()
    h.updateSource({ timeSec: 2, rhythm: { ...fourth.rhythm, kickHit: false, beatIndex: 4, beatPhase: 0 } })
    h.runtime.update(h.nextFrame(2000))
    expect(h.dispatched).toHaveLength(1)

    const fifth = h.getSource()
    h.updateSource({ timeSec: 2.1, rhythm: { ...fifth.rhythm, kickHit: true, kickStrength: 1, beatIndex: 4, beatPhase: 0.2 } })
    h.runtime.update(h.nextFrame(2100))
    const sixth = h.getSource()
    h.updateSource({ timeSec: 2.5, rhythm: { ...sixth.rhythm, kickHit: false, beatIndex: 5, beatPhase: 0 } })
    h.runtime.update(h.nextFrame(2500))
    expect(h.dispatched).toHaveLength(2)
  })

  it('gates events by capability, confidence, and Director phase', () => {
    const h = harness(baseManifest([
      {
        id: ruleId('gated-trigger'),
        priority: 10,
        source: { signal: 'kick', capability: 'music.rhythm-events' },
        conditions: [
          { kind: 'capability', capability: 'music.rhythm-events', available: true },
          { kind: 'confidence', min: 0.9 },
          { kind: 'director-phase', phases: ['peak'] },
        ],
        actions: [{ id: actionId('gated-trigger-action'), target: { kind: 'parameter', ref: cinema2Ref(TRIGGER_ID) }, operation: 'trigger' }],
      },
    ]))
    const source = h.getSource()
    h.updateSource({
      rhythm: { ...source.rhythm, kickHit: true, kickStrength: 1, transientConfidence: 0.5 },
    })
    const lowConfidence = h.nextFrame()
    h.runtime.update({
      ...lowConfidence,
      director: lowConfidence.director ? { ...lowConfidence.director, phase: { ...lowConfidence.director.phase, available: true, value: 'peak', confidence: 1 } } : null,
    })
    expect(h.dispatched).toHaveLength(0)

    const next = h.getSource()
    h.updateSource({ rhythm: { ...next.rhythm, kickHit: true, kickStrength: 1, transientConfidence: 0.95 } })
    const wrongPhase = h.nextFrame()
    h.runtime.update({
      ...wrongPhase,
      director: wrongPhase.director ? { ...wrongPhase.director, phase: { ...wrongPhase.director.phase, available: true, value: 'steady', confidence: 1 } } : null,
    })
    expect(h.dispatched).toHaveLength(0)

    const final = h.getSource()
    h.updateSource({ rhythm: { ...final.rhythm, kickHit: true, kickStrength: 1, transientConfidence: 0.95 } })
    const passing = h.nextFrame()
    h.runtime.update({
      ...passing,
      director: passing.director ? { ...passing.director, phase: { ...passing.director.phase, available: true, value: 'peak', confidence: 1 } } : null,
    })
    expect(h.dispatched).toHaveLength(1)
  })

  it('clears transient toggle state and resolver contributions on an audio discontinuity', () => {
    const h = harness(baseManifest([
      {
        id: ruleId('toggle'),
        priority: 10,
        source: { signal: 'kick', capability: 'music.rhythm-events' },
        actions: [{ id: actionId('toggle-action'), target: { kind: 'parameter', ref: cinema2Ref(TOGGLE_ID) }, operation: 'toggle' }],
      },
    ]))
    const source = h.getSource()
    h.updateSource({ timeSec: 2, rhythm: { ...source.rhythm, kickHit: true, kickStrength: 1 } })
    h.runtime.update(h.nextFrame(2000))
    const target = targetFor(h.plan, TOGGLE_ID)
    expect(h.resolver.resolve(target.id).value).toBe(true)
    expect(h.runtime.getSnapshot().activeToggleCount).toBe(1)

    const next = h.getSource()
    h.updateSource({ timeSec: 0.1, rhythm: { ...next.rhythm, kickHit: false } })
    h.runtime.update(h.nextFrame(2100))
    expect(h.runtime.getSnapshot().resetCount).toBeGreaterThan(0)
    expect(h.runtime.getSnapshot().activeToggleCount).toBe(0)
    expect(h.resolver.resolve(target.id).value).toBe(false)
  })

  it('rejects spawn on scalar targets but accepts spawn on action-channel targets at compile time', () => {
    const scalar = compileCinema2NativePreset(baseManifest([
      {
        id: ruleId('spawn-scalar'),
        priority: 1,
        source: { signal: 'kick', capability: 'music.rhythm-events' },
        actions: [{ id: actionId('spawn-scalar-action'), target: { kind: 'parameter', ref: cinema2Ref(EVENT_ID) }, operation: 'spawn' }],
      },
    ]))
    expect(scalar.ok).toBe(false)
    expect(scalar.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_TARGET_SCALAR_ACTION_MISMATCH' }),
    ]))

    const action = compileCinema2NativePreset(baseManifest([
      {
        id: ruleId('spawn-action'),
        priority: 1,
        source: { signal: 'kick', capability: 'music.rhythm-events' },
        actions: [{ id: actionId('spawn-action-action'), target: { kind: 'parameter', ref: cinema2Ref(TRIGGER_ID) }, operation: 'spawn' }],
      },
    ]))
    expect(action.ok).toBe(true)
  })

  it('applies authored event probability deterministically before dispatch', () => {
    const h = harness(baseManifest([
      {
        id: ruleId('probability'),
        priority: 10,
        source: { signal: 'kick', capability: 'music.rhythm-events' },
        actions: [
          {
            id: actionId('always-reject'),
            target: { kind: 'parameter', ref: cinema2Ref(TRIGGER_ID) },
            operation: 'trigger',
            probability: 0,
          },
          {
            id: actionId('always-accept'),
            target: { kind: 'parameter', ref: cinema2Ref(TRIGGER_ID) },
            operation: 'trigger',
            probability: 1,
          },
        ],
      },
    ]))
    const source = h.getSource()
    h.updateSource({
      timeSec: 2,
      rhythm: { ...source.rhythm, kickHit: true, kickStrength: 1, transientConfidence: 0.95 },
    })
    h.runtime.update(h.nextFrame(2000))

    expect(h.dispatched).toHaveLength(1)
    expect(h.dispatched[0]).toContain('always-accept')
    expect(h.runtime.getSnapshot()).toMatchObject({
      probabilityDecisionCount: 2,
      probabilityRejectedCount: 1,
    })
  })

  it('rejects malformed authored probability at the compile boundary', () => {
    const result = compileCinema2NativePreset(baseManifest([
      {
        id: ruleId('bad-probability'),
        priority: 1,
        source: { signal: 'kick', capability: 'music.rhythm-events' },
        actions: [{
          id: actionId('bad-probability-action'),
          target: { kind: 'parameter', ref: cinema2Ref(TRIGGER_ID) },
          operation: 'trigger',
          probability: 1.1,
        }],
      },
    ]))

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PRESET_CHOREOGRAPHY_PROBABILITY_INVALID' }),
    ]))
  })

})
