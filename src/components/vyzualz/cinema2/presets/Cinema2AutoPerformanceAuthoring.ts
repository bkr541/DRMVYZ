import {
  cinema2Ref,
  cinema2StableId,
  type Cinema2CapabilityId,
  type Cinema2CapabilityRequirement,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyActionManifest,
  type Cinema2ChoreographyConditionManifest,
  type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest,
  type Cinema2ChoreographySourceManifest,
  type Cinema2CameraId,
  type Cinema2EffectId,
  type Cinema2JsonValue,
  type Cinema2LightGroupId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'

/**
 * Auto Performance for presets whose music reactions live in the choreography system (rather than in a module-owned pattern controller).
 *
 * The toggle is a boolean Design > Master Controls parameter that is OFF by default and gates a small set of extra choreography rules through
 * `enabledParameter`. Nothing is added to the preset's existing rules, so with it off the preset behaves exactly as authored: its normal
 * animation, audio reactions, BPM Sync and any other toggle are untouched. With it on, the extra rules read the canonical shared signals
 * (the Visual Director's build, and the choreography engine's drop and downbeat events with their own identities, once per event) and write
 * only transient contributions through the shared target runtime, so authored parameter values are never rewritten and a seek, loop, track
 * change or stop clears them the same way it clears every other choreography contribution. No analyzer, drop detector or randomization is
 * created here.
 *
 * Each preset supplies what each of four musical moments does to its own parameters; the moments are:
 *  - `build`: while a build charges (continuous, follows the Director's build 0..1);
 *  - `peak`: each downbeat while the build is near its peak (a rising pulse into the drop);
 *  - `drop`: the canonical drop event;
 *  - `lift`: the downbeat that starts every fourth bar (a phrase-scale swell).
 */
export const CINEMA2_AUTO_PERFORMANCE_BUILD_PEAK_MIN = 0.7
export const CINEMA2_AUTO_PERFORMANCE_LIFT_EVERY_BARS = 4

export interface Cinema2AutoPerformanceGestures {
  /** Continuous additions that follow the build. */
  readonly build?: readonly Cinema2AutoAction[]
  /** Pulses fired on each downbeat while the build is at or above `CINEMA2_AUTO_PERFORMANCE_BUILD_PEAK_MIN`. */
  readonly peak?: readonly Cinema2AutoAction[]
  /** Pulses and extra strikes fired once per drop. */
  readonly drop?: readonly Cinema2AutoAction[]
  /** Slow swells fired on the downbeat that starts every fourth bar. */
  readonly lift?: readonly Cinema2AutoAction[]
}

export interface Cinema2AutoPerformanceSpec {
  /** Parameter id prefix: the toggle is `${prefix}-auto-performance`, and rule ids are `${prefix}-auto-…`. */
  readonly prefix: string
  readonly description: string
  /** Legacy group label (the Design workspace places it by `designParentGroup`). */
  readonly group?: string
  readonly order?: number
  /** The preset's own reactivity or intensity control; the added rules scale by it, so a control set to zero silences them. */
  readonly strengthParameter?: Cinema2ParameterId
  readonly gestures: Cinema2AutoPerformanceGestures
  /** Optional capabilities the added rules read that the preset does not already declare. */
  readonly capabilities?: readonly { readonly id: Cinema2CapabilityId; readonly purpose: string }[]
}

export interface Cinema2AutoAction {
  readonly id: string
  readonly target: Cinema2ChoreographyActionManifest['target']
  readonly operation: 'add' | 'envelope' | 'spawn'
  readonly value: Cinema2JsonValue
  /** Beats the pulse takes to fall away (envelope only). */
  readonly release?: number
  readonly hold?: number
}

const BUILD_SOURCE: Cinema2ChoreographySourceManifest = Object.freeze({
  signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 250, clamp: Object.freeze([0, 1] as const),
})
const DROP_SOURCE: Cinema2ChoreographySourceManifest = Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const })
const DOWNBEAT_SOURCE: Cinema2ChoreographySourceManifest = Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const })

const actionManifest = (rulePrefix: string, action: Cinema2AutoAction): Cinema2ChoreographyActionManifest => Object.freeze({
  id: cinema2StableId<Cinema2ChoreographyActionId>(`${rulePrefix}-${action.id}`),
  target: action.target,
  operation: action.operation,
  value: action.value,
  ...(action.operation === 'envelope'
    ? { composition: 'add' as const, envelope: Object.freeze({ attack: 0, hold: action.hold ?? 0.1, release: action.release ?? 1, unit: 'beats' as const }) }
    : {}),
})

const ONCE: Cinema2ChoreographyConditionManifest = Object.freeze({ kind: 'once-per-event' as const })

/** The toggle itself: boolean, Design > Master Controls, off by default, persisted and reset like every other preset control. */
export function createCinema2AutoPerformanceParameter(spec: Readonly<Pick<Cinema2AutoPerformanceSpec, 'prefix' | 'description' | 'group' | 'order'>>): Readonly<Cinema2ParameterManifest> {
  return Object.freeze({
    id: cinema2StableId<Cinema2ParameterId>(`${spec.prefix}-auto-performance`),
    label: 'Auto Performance',
    description: spec.description,
    type: 'boolean' as const,
    defaultValue: false,
    section: 'Design',
    group: spec.group ?? 'Performance',
    designParentGroup: 'master-controls' as const,
    order: spec.order ?? 90,
    exposure: 'primary' as const,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  })
}

/** The gated rules for the gestures a preset authored. Every rule is enabled only while the toggle is on. */
export function createCinema2AutoPerformanceRules(spec: Readonly<Cinema2AutoPerformanceSpec>): readonly Cinema2ChoreographyRuleManifest[] {
  const enabledParameter = cinema2Ref(cinema2StableId<Cinema2ParameterId>(`${spec.prefix}-auto-performance`))
  const strengthParameter = spec.strengthParameter ? cinema2Ref(spec.strengthParameter) : undefined
  const rules: Cinema2ChoreographyRuleManifest[] = []
  const add = (name: string, priority: number, source: Cinema2ChoreographySourceManifest, conditions: readonly Cinema2ChoreographyConditionManifest[] | undefined, actions: readonly Cinema2AutoAction[] | undefined) => {
    if (!actions || actions.length === 0) return
    const ruleName = `${spec.prefix}-auto-${name}`
    rules.push(Object.freeze({
      id: cinema2StableId<Cinema2ChoreographyRuleId>(ruleName),
      priority,
      enabledParameter,
      ...(strengthParameter ? { strengthParameter } : {}),
      source,
      ...(conditions ? { conditions: Object.freeze([...conditions]) } : {}),
      actions: Object.freeze(actions.map(action => actionManifest(ruleName, action))),
    }))
  }
  add('build-rise', 60, BUILD_SOURCE, undefined, spec.gestures.build)
  add('build-peak', 61, DOWNBEAT_SOURCE, [ONCE, { kind: 'build', min: CINEMA2_AUTO_PERFORMANCE_BUILD_PEAK_MIN }], spec.gestures.peak)
  add('drop-hit', 62, DROP_SOURCE, [ONCE], spec.gestures.drop)
  add('phrase-lift', 63, DOWNBEAT_SOURCE, [ONCE, { kind: 'beat-interval', every: CINEMA2_AUTO_PERFORMANCE_LIFT_EVERY_BARS, phase: 0, unit: 'bar' }], spec.gestures.lift)
  return Object.freeze(rules)
}

/**
 * Returns the manifest with Auto Performance added: the toggle, its gated rules, and any capability the rules read that was not yet declared.
 * Everything else on the manifest, including every existing rule, is carried over unchanged.
 */
export function withCinema2AutoPerformance(
  manifest: Readonly<Cinema2NativePresetManifest>,
  spec: Readonly<Cinema2AutoPerformanceSpec>,
): Readonly<Cinema2NativePresetManifest> {
  const parameter = createCinema2AutoPerformanceParameter(spec)
  if (manifest.parameters?.some(candidate => candidate.id === parameter.id)) {
    throw new Error(`Cinema 2.0 preset "${manifest.id}" already declares ${parameter.id}.`)
  }
  const declared = new Set((manifest.capabilities ?? []).map(capability => capability.id))
  const addedCapabilities: Cinema2CapabilityRequirement[] = (spec.capabilities ?? [])
    .filter(capability => !declared.has(capability.id))
    .map(capability => Object.freeze({ id: capability.id, requirement: 'optional' as const, purpose: capability.purpose }))
  return Object.freeze({
    ...manifest,
    // The revision is deliberately unchanged: saved parameter state is bound to it, so older saved settings keep loading. They simply lack the
    // new parameter, which restores to its authored default (off).
    revision: manifest.revision,
    capabilities: Object.freeze([...(manifest.capabilities ?? []), ...addedCapabilities]),
    parameters: Object.freeze([...(manifest.parameters ?? []), parameter]),
    choreography: Object.freeze({
      ...(manifest.choreography ?? {}),
      rules: Object.freeze([...(manifest.choreography?.rules ?? []), ...createCinema2AutoPerformanceRules(spec)]),
    }),
  })
}

/** Small target builders so each preset reads as a list of what moves. */
export const cinema2AutoTargets = Object.freeze({
  module: (id: string, property: string): Cinema2AutoAction['target'] => Object.freeze({ kind: 'module' as const, ref: cinema2Ref(cinema2StableId<Cinema2ModuleId>(id)), property }),
  effect: (id: string, property: string): Cinema2AutoAction['target'] => Object.freeze({ kind: 'effect' as const, ref: cinema2Ref(cinema2StableId<Cinema2EffectId>(id)), property }),
  camera: (id: string, property: string): Cinema2AutoAction['target'] => Object.freeze({ kind: 'camera' as const, ref: cinema2Ref(cinema2StableId<Cinema2CameraId>(id)), property }),
  lightGroup: (id: string): Cinema2AutoAction['target'] => Object.freeze({ kind: 'light-group' as const, ref: cinema2Ref(cinema2StableId<Cinema2LightGroupId>(id)), property: 'intensity' }),
  parameter: (id: string): Cinema2AutoAction['target'] => Object.freeze({ kind: 'parameter' as const, ref: cinema2Ref(cinema2StableId<Cinema2ParameterId>(id)) }),
})
