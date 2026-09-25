import {
  cinema2Ref,
  cinema2StableId,
  type Cinema2BeatIntervalUnit,
  type Cinema2CapabilityId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyActionManifest,
  type Cinema2ChoreographyContinuousSourcePath,
  type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest,
  type Cinema2LightGroupId,
  type Cinema2LightGroupStaggerManifest,
  type Cinema2ParameterRef,
} from '../contracts/Cinema2NativePresetManifest'

/**
 * Performance light rig vocabulary. Each helper returns ordinary choreography rules that address named
 * `lighting.groups`; nothing here is runtime state. All of it composes with the Visual Director gating
 * already present in the choreography runtime (envelopes restart instead of stacking, drops/phrases
 * fire once per event, and everything degrades to "no action" while beat timing is unavailable).
 */

interface RigRuleOptions {
  /** Prefix for generated rule/action ids. Must be a stable id fragment. */
  id: string
  /** Higher priority wins when several rules replace the same target. Default 40. */
  priority?: number
  /** Route strength control; scales every action in the rule. */
  strengthParameter?: Cinema2ParameterRef
}

const ruleId = (value: string) => cinema2StableId<Cinema2ChoreographyRuleId>(value)
const actionId = (value: string) => cinema2StableId<Cinema2ChoreographyActionId>(value)
const groupTarget = (group: Cinema2LightGroupId, property: string, stagger?: Cinema2LightGroupStaggerManifest) => Object.freeze({
  kind: 'light-group' as const,
  ref: cinema2Ref(group),
  property,
  ...(stagger ? { stagger: Object.freeze({ ...stagger }) } : {}),
})

function rule(
  options: RigRuleOptions,
  suffix: string,
  source: Cinema2ChoreographyRuleManifest['source'],
  actions: readonly Cinema2ChoreographyActionManifest[],
  conditions: Cinema2ChoreographyRuleManifest['conditions'] = [],
): Cinema2ChoreographyRuleManifest {
  return Object.freeze({
    id: ruleId(`${options.id}-${suffix}`),
    priority: options.priority ?? 40,
    ...(options.strengthParameter ? { strengthParameter: options.strengthParameter } : {}),
    source: Object.freeze(source),
    ...(conditions.length > 0 ? { conditions: Object.freeze([...conditions]) } : {}),
    actions: Object.freeze(actions),
  })
}

export interface Cinema2LightRigAlternateOptions extends RigRuleOptions {
  /** Groups take turns in this order; one lights up while the others rest at their base intensity. */
  groups: readonly Cinema2LightGroupId[]
  /** How many beats each group stays lit before the next takes over. Default 2. */
  everyBeats?: number
  /** Intensity of the lit group. Resting groups fall back to the lights' authored base intensity. */
  peak: number
  /** Light property to drive. Default `intensity`. */
  property?: string
  capability?: Cinema2CapabilityId
}

/**
 * "Colors alternate every two beats": with N groups and `everyBeats` = B, group i is lit for B beats
 * starting at beat index `i * B` of every `N * B`-beat cycle. The lit value scales with the beat
 * event's strength, so a weak beat lights the group less.
 */
export function cinema2LightRigAlternate(options: Cinema2LightRigAlternateOptions): readonly Cinema2ChoreographyRuleManifest[] {
  const every = Math.max(1, Math.floor(options.everyBeats ?? 2))
  const cycle = every * options.groups.length
  return Object.freeze(options.groups.map((group, index) => rule(
    options,
    `alternate-${group}`,
    { signal: 'beat', capability: options.capability ?? 'music.beat' },
    [{
      id: actionId(`${options.id}-alternate-${group}-on`),
      target: groupTarget(group, options.property ?? 'intensity'),
      operation: 'set-for-duration',
      composition: 'replace',
      value: options.peak,
      durationBeats: every,
    }],
    [{ kind: 'beat-interval', every: cycle, phase: index * every, unit: 'beat' }],
  )))
}

export interface Cinema2LightRigHitOptions extends RigRuleOptions {
  group: Cinema2LightGroupId
  /** Musical event that triggers the hit. Default `downbeat`. */
  signal?: 'beat' | 'downbeat' | 'bar' | 'phrase' | 'kick' | 'snare' | 'drop'
  /** Intensity added at the envelope's peak. */
  peak: number
  /** Envelope in beats. Defaults: instant attack, 0.1 hold, 0.9 release. */
  attack?: number
  hold?: number
  release?: number
  /** Sweep the hit across the group's members. */
  stagger?: Cinema2LightGroupStaggerManifest
  /** Only fire on every Nth counter of `unit` (e.g. every 2nd bar). */
  every?: number
  phase?: number
  unit?: Cinema2BeatIntervalUnit
  property?: string
  capability?: Cinema2CapabilityId
}

const SIGNAL_CAPABILITY: Readonly<Record<NonNullable<Cinema2LightRigHitOptions['signal']>, Cinema2CapabilityId>> = Object.freeze({
  beat: 'music.beat',
  downbeat: 'music.downbeat',
  bar: 'music.bar',
  phrase: 'music.phrase',
  kick: 'music.rhythm-events',
  snare: 'music.rhythm-events',
  drop: 'music.drop',
})

/** "Big beam moments": a beat-timed envelope on a group, optionally swept across its members. */
export function cinema2LightRigHit(options: Cinema2LightRigHitOptions): readonly Cinema2ChoreographyRuleManifest[] {
  const signal = options.signal ?? 'downbeat'
  const conditions: NonNullable<Cinema2ChoreographyRuleManifest['conditions']>[number][] = [{ kind: 'once-per-event' }]
  if (options.every != null) conditions.push({ kind: 'beat-interval', every: options.every, phase: options.phase ?? 0, unit: options.unit ?? 'beat' })
  return Object.freeze([rule(
    options,
    `${signal}-hit`,
    { signal, capability: options.capability ?? SIGNAL_CAPABILITY[signal] },
    [{
      id: actionId(`${options.id}-${signal}-hit-envelope`),
      target: groupTarget(options.group, options.property ?? 'intensity', options.stagger),
      operation: 'envelope',
      composition: 'add',
      value: options.peak,
      envelope: { attack: options.attack ?? 0, hold: options.hold ?? 0.1, release: options.release ?? 0.9, unit: 'beats' },
      retrigger: 'restart',
    }],
    conditions,
  )])
}

export interface Cinema2LightRigPhraseArrangementOptions extends RigRuleOptions {
  /** Groups to drop out (intensity 0) for whole phrases. */
  groups: readonly Cinema2LightGroupId[]
  /** Blackout every Nth phrase (of 16 beats), on phrase index `phase`. Default every 2, phase 1. */
  every?: number
  phase?: number
  /** Blackout length in phrases. Default 1. */
  phrases?: number
  property?: string
  capability?: Cinema2CapabilityId
}

/**
 * "Arrangement changes per phrase": the listed groups go dark for whole phrases on a repeating pattern,
 * so the rig alternates between a full and a reduced arrangement. Use a priority above the
 * alternation/hit rules so the blackout wins the replace.
 */
export function cinema2LightRigPhraseArrangement(options: Cinema2LightRigPhraseArrangementOptions): readonly Cinema2ChoreographyRuleManifest[] {
  return Object.freeze(options.groups.map(group => rule(
    { priority: 60, ...options },
    `phrase-${group}`,
    { signal: 'phrase', capability: options.capability ?? 'music.phrase' },
    [{
      id: actionId(`${options.id}-phrase-${group}-blackout`),
      target: groupTarget(group, options.property ?? 'intensity'),
      operation: 'set-for-duration',
      composition: 'replace',
      value: 0,
      durationBeats: 16 * Math.max(1, options.phrases ?? 1),
    }],
    [
      { kind: 'once-per-event' },
      { kind: 'beat-interval', every: options.every ?? 2, phase: options.phase ?? 1, unit: 'phrase' },
    ],
  )))
}

export interface Cinema2LightRigRampOptions extends RigRuleOptions {
  groups: readonly Cinema2LightGroupId[]
  /** Continuous source that climbs during a build and falls in the release. Default `director.intensity`. */
  source?: Extract<Cinema2ChoreographyContinuousSourcePath, 'director.intensity' | 'director.build' | 'audio.features.buildProgress' | 'audio.features.tension'>
  /** Intensity added when the source reaches 1. */
  lift: number
  smoothingMs?: number
  property?: string
  capability?: Cinema2CapabilityId
}

/**
 * Build/drop/release ramp: intensity rises with the chosen source (build), peaks when it does (drop)
 * and falls back as it releases, without a discrete trigger. Additive, so it layers under alternation.
 */
export function cinema2LightRigRamp(options: Cinema2LightRigRampOptions): readonly Cinema2ChoreographyRuleManifest[] {
  return Object.freeze([rule(
    options,
    'ramp',
    {
      signal: 'continuous',
      path: options.source ?? 'director.intensity',
      capability: options.capability ?? 'visual-director.significance',
      smoothingMs: options.smoothingMs ?? 250,
      clamp: [0, 1],
    },
    options.groups.map(group => ({
      id: actionId(`${options.id}-ramp-${group}`),
      target: groupTarget(group, options.property ?? 'intensity'),
      operation: 'add' as const,
      value: options.lift,
    })),
  )])
}
