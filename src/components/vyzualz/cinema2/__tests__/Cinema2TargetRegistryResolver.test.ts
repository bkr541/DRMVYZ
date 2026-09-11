import { describe, expect, it, vi } from 'vitest'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2EffectId,
  type Cinema2EffectTypeId,
  type Cinema2LayerId,
  type Cinema2LightId,
  type Cinema2MediaSlotId,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2SceneNodeId,
  type Cinema2VariationId,
} from '../contracts/Cinema2NativePresetManifest'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import {
  Cinema2FinalValueResolver,
  type Cinema2CompiledTargetPlan,
  type Cinema2TargetHandle,
  type Cinema2TargetId,
} from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

const presetId = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.target-test')
const intensityId = cinema2StableId<Cinema2ParameterId>('intensity')
const triggerId = cinema2StableId<Cinema2ParameterId>('flash')
const layerId = cinema2StableId<Cinema2LayerId>('hero-layer')
const moduleId = cinema2StableId<Cinema2ModuleId>('hero-module')
const nodeId = cinema2StableId<Cinema2SceneNodeId>('hero-node')
const cameraId = cinema2StableId<Cinema2CameraId>('main-camera')
const lightId = cinema2StableId<Cinema2LightId>('key-light')
const effectId = cinema2StableId<Cinema2EffectId>('bloom')
const mediaId = cinema2StableId<Cinema2MediaSlotId>('hero-media')
const variationId = cinema2StableId<Cinema2VariationId>('drop')
const ruleId = cinema2StableId<Cinema2ChoreographyRuleId>('beat-rule')
const valueActionId = cinema2StableId<Cinema2ChoreographyActionId>('boost')
const triggerActionId = cinema2StableId<Cinema2ChoreographyActionId>('flash-action')

function manifest(): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: presetId,
    revision: 1,
    metadata: { name: 'Target Resolver Test' },
    parameters: [
      { id: intensityId, label: 'Intensity', type: 'float', defaultValue: 0.4, min: 0, max: 1, step: 0.05, choreographable: true },
      { id: triggerId, label: 'Flash', type: 'trigger', choreographable: true },
    ],
    mediaSlots: [{ id: mediaId, label: 'Hero Media', accepts: ['image', 'video'] }],
    modules: [{
      id: moduleId,
      typeId: cinema2StableId<Cinema2ModuleTypeId>('generator'),
      version: 1,
      parameters: { gain: 0.75, enabledMask: true },
    }],
    scene: { nodes: [{ id: nodeId, kind: 'module', module: cinema2Ref(moduleId) }] },
    layers: [{ id: layerId, label: 'Hero', source: cinema2Ref(nodeId), opacity: 0.8 }],
    cameras: [{ id: cameraId, label: 'Main', projection: 'perspective', fovDegrees: 55 }],
    lighting: { lights: [{ id: lightId, type: 'point', intensity: 2 }] },
    environment: { exposure: 1.2, backgroundColor: [0, 0, 0, 1] },
    effects: [{
      id: effectId,
      typeId: cinema2StableId<Cinema2EffectTypeId>('bloom'),
      version: 1,
      parameters: { amount: 0.5 },
    }],
    variations: [{ id: variationId, label: 'Drop' }],
    choreography: {
      rules: [{
        id: ruleId,
        priority: 1,
        source: { signal: 'beat', capability: 'music.beat' },
        actions: [
          { id: valueActionId, target: { kind: 'parameter', ref: cinema2Ref(intensityId) }, operation: 'add', value: 0.1 },
          { id: triggerActionId, target: { kind: 'parameter', ref: cinema2Ref(triggerId) }, operation: 'trigger' },
        ],
      }],
    },
  }
}

function compilePlan() {
  const result = compileCinema2NativePreset(manifest())
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  return result.plan
}

function target(plan: Readonly<Cinema2CompiledTargetPlan>, ownerId: string, property: string): Readonly<Cinema2TargetHandle> {
  const found = plan.targets.find(entry => entry.ownerId === ownerId && entry.property === property)
  if (!found) throw new Error(`Missing target ${ownerId}.${property}`)
  return found
}

describe('Cinema 2.0 target registry and final value resolver', () => {
  it('creates stable namespaced entity identities and compiles authored target refs to typed handles', () => {
    const plan = compilePlan()
    const kinds = new Set(plan.targets.entities.map(entity => entity.kind))
    expect(kinds).toEqual(new Set([
      'preset', 'parameter', 'action', 'media', 'module', 'scene-node', 'layer', 'camera', 'light', 'environment', 'effect', 'variation',
    ]))
    expect(plan.targets.entities.every(entity => entity.id.startsWith(`${presetId}/target/`))).toBe(true)

    expect(plan.targets.choreographyTargets).toEqual([
      expect.objectContaining({ actionId: valueActionId, target: target(plan.targets, intensityId, 'value'), operation: 'add' }),
      expect.objectContaining({ actionId: triggerActionId, target: target(plan.targets, triggerId, 'invoke'), operation: 'action' }),
    ])
  })

  it('keeps persistent base state separate while resolving additive, multiplicative and safety-clamped runtime contributions', () => {
    const plan = compilePlan()
    const state = new Cinema2ParameterState(plan.parameters)
    expect(state.setPersistentValue(intensityId, 0.45).ok).toBe(true)
    const resolver = new Cinema2FinalValueResolver(plan.targets, {
      resolveBaseValue: handle => handle.parameterId == null ? handle.authoredBaseValue : state.getValue(handle.parameterId),
    })
    const handle = target(plan.targets, intensityId, 'value')

    const result = resolver.resolve(handle.id, [
      { contributorId: 'z-multiply', operation: 'multiply', value: 2 },
      { contributorId: 'a-add', operation: 'add', value: 0.2 },
    ])

    expect(result).toMatchObject({ ok: true, value: 1 })
    expect(state.getValue(intensityId)).toBe(0.45)
  })

  it('reports equal-priority replacement conflicts but selects the same deterministic winner regardless of iteration order', () => {
    const plan = compilePlan()
    const resolver = new Cinema2FinalValueResolver(plan.targets)
    const handle = target(plan.targets, intensityId, 'value')
    const contributions = [
      { contributorId: 'writer-b', operation: 'replace' as const, value: 0.8, priority: 7 },
      { contributorId: 'writer-a', operation: 'replace' as const, value: 0.3, priority: 7 },
    ]

    const first = resolver.resolve(handle.id, contributions)
    const second = resolver.resolve(handle.id, [...contributions].reverse())

    expect(first.value).toBeCloseTo(0.3)
    expect(second.value).toBeCloseTo(0.3)
    expect(first.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_TARGET_REPLACE_PRIORITY_CONFLICT' }),
    ]))
    expect(second.diagnostics).toEqual(first.diagnostics)
  })

  it('enforces scalar/action separation and dispatches action events deterministically', () => {
    const plan = compilePlan()
    const dispatched = vi.fn()
    const resolver = new Cinema2FinalValueResolver(plan.targets, { dispatchAction: dispatched })
    const valueHandle = target(plan.targets, intensityId, 'value')
    const actionHandle = target(plan.targets, triggerId, 'invoke')

    expect(resolver.resolve(actionHandle.id).diagnostics[0]?.code).toBe('CINEMA2_TARGET_SCALAR_ACTION_MISMATCH')
    expect(resolver.dispatch(valueHandle.id, [{ contributorId: 'bad', operation: 'action', eventId: 'event' }]).diagnostics[0]?.code).toBe('CINEMA2_TARGET_SCALAR_ACTION_MISMATCH')

    const result = resolver.dispatch(actionHandle.id, [
      { contributorId: 'b', operation: 'action', eventId: 'event-b', priority: 1, value: { amount: 2 } },
      { contributorId: 'a', operation: 'action', eventId: 'event-a', priority: 2 },
    ])
    expect(result.ok).toBe(true)
    expect(result.events.map(event => event.eventId)).toEqual(['event-a', 'event-b'])
    expect(dispatched).toHaveBeenCalledTimes(2)
  })

  it('supports explicit base, scale and lock user-authority semantics', () => {
    const plan = compilePlan()
    const resolver = new Cinema2FinalValueResolver(plan.targets)
    const handle = target(plan.targets, intensityId, 'value')
    const contribution = [{ contributorId: 'mod', operation: 'add' as const, value: 0.5 }]

    expect(resolver.resolve(handle.id, contribution, 'base').value).toBe(0.9)
    expect(resolver.resolve(handle.id, contribution, 'scale').value).toBe(0.6)
    expect(resolver.resolve(handle.id, contribution, 'lock').value).toBe(0.4)
  })

  it('fails predictably for unknown targets and incompatible composition', () => {
    const plan = compilePlan()
    const resolver = new Cinema2FinalValueResolver(plan.targets)
    const unknown = `${presetId}/target/module/missing/property/gain` as Cinema2TargetId
    expect(resolver.resolve(unknown).diagnostics[0]?.code).toBe('CINEMA2_TARGET_UNKNOWN')

    const visible = target(plan.targets, layerId, 'visible')
    const incompatible = resolver.resolve(visible.id, [{ contributorId: 'bad', operation: 'add', value: 1 }])
    expect(incompatible.ok).toBe(false)
    expect(incompatible.value).toBe(true)
    expect(incompatible.diagnostics[0]?.code).toBe('CINEMA2_TARGET_COMPOSITION_INCOMPATIBLE')
  })

  it('keeps capability-gated targets explicitly unavailable and materializes one-shot capability inputs once', () => {
    const gated = manifest()
    gated.parameters = gated.parameters?.map(definition => definition.id === intensityId
      ? { ...definition, capabilities: [{ id: 'music.beat', requirement: 'optional' as const }] }
      : definition)

    const unavailable = compileCinema2NativePreset(gated, { availableCapabilities: [] })
    expect(unavailable.ok).toBe(true)
    if (!unavailable.ok) throw new Error('Expected optional missing capability to compile safely.')
    const unavailableHandle = target(unavailable.plan.targets, intensityId, 'value')
    expect(unavailableHandle.capabilityAvailability).toBe('unavailable')
    expect(new Cinema2FinalValueResolver(unavailable.plan.targets).resolve(unavailableHandle.id).diagnostics[0]?.code)
      .toBe('CINEMA2_TARGET_CAPABILITY_UNAVAILABLE')

    function * capabilities() {
      yield 'music.beat' as const
    }
    const available = compileCinema2NativePreset(gated, { availableCapabilities: capabilities() })
    expect(available.ok).toBe(true)
    if (!available.ok) throw new Error('Expected supplied capability generator to compile.')
    const availableHandle = target(available.plan.targets, intensityId, 'value')
    expect(availableHandle.capabilityAvailability).toBe('available')
    expect(available.plan.capabilities.available).toContain('music.beat')
  })

  it('rejects unsupported authored target properties and scalar/action operation mismatches at compile time', () => {
    const badProperty = manifest()
    badProperty.choreography = {
      rules: [{
        id: ruleId,
        priority: 1,
        source: { signal: 'beat', capability: 'music.beat' },
        actions: [{
          id: valueActionId,
          target: { kind: 'module', ref: cinema2Ref(moduleId), property: 'not-authored' },
          operation: 'set',
          value: 1,
        }],
      }],
    }
    const missing = compileCinema2NativePreset(badProperty)
    expect(missing.ok).toBe(false)
    expect(missing.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_TARGET_UNKNOWN_OR_UNSUPPORTED' }),
    ]))

    const mismatch = manifest()
    mismatch.choreography = {
      rules: [{
        id: ruleId,
        priority: 1,
        source: { signal: 'beat', capability: 'music.beat' },
        actions: [{
          id: triggerActionId,
          target: { kind: 'parameter', ref: cinema2Ref(triggerId) },
          operation: 'set',
          value: true,
        }],
      }],
    }
    const mismatchResult = compileCinema2NativePreset(mismatch)
    expect(mismatchResult.ok).toBe(false)
    expect(mismatchResult.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_TARGET_SCALAR_ACTION_MISMATCH' }),
    ]))
  })
})
