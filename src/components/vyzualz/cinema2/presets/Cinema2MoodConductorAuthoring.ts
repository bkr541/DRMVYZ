import {
  cinema2Ref,
  cinema2StableId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2ChoreographyActionManifest,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MoodPath } from '../conductor/Cinema2MoodConductor'
import { CINEMA2_MOOD_POLICY_METADATA_KEY, type Cinema2MoodPolicy } from '../conductor/Cinema2MoodPolicy'

/**
 * Authoring for the shared Mood Conductor: continuous "drives" that move a preset's own targets by the passage's mood, gated by the preset's
 * Auto Performance toggle. A drive reads one `mood.*` source (already smoothed by the conductor) and writes only a transient contribution to
 * the target, so the authored value is the baseline and is never rewritten:
 *
 *   add       the contribution is `value × source`, so a drive of +0.3 on `mood.activity` adds up to 0.3 at full activity (a negative value takes away).
 *   multiply  the target is scaled from ×1 at source 0 to ×`value` at source 1.
 *
 * The final value is the authored value plus the contributions, clamped to the control's own range by the target runtime. Drives that share a
 * source become one rule. With the toggle off none of the rules exist at runtime, and with no mood (no analysed track or live features, so the
 * director is unavailable) they contribute nothing.
 */
export interface Cinema2MoodDrive {
  readonly id: string
  readonly target: Cinema2ChoreographyActionManifest['target']
  readonly source: Cinema2MoodPath
  readonly operation: 'add' | 'multiply'
  readonly value: number
}

export interface Cinema2MoodDriveSpec {
  /** Rule ids are `${idPrefix}-mood-${source}`. */
  readonly idPrefix: string
  /** The preset's Auto Performance toggle: the rules are enabled only while it is on. */
  readonly enabledParameter: Cinema2ParameterId
  /** The preset's own reactivity or intensity control: the drives scale by it, so a control set to zero silences them. */
  readonly strengthParameter?: Cinema2ParameterId
  readonly drives: readonly Cinema2MoodDrive[]
  /**
   * Opt in to "the music chooses Pattern Change and the Trigger while Auto Performance is on": the preset's own Pattern Change and Trigger
   * parameters (the Auto Performance toggle is `enabledParameter`). They are tagged for the compiler, the inspector's live "choosing" line and
   * the module, which reads the choice with `Cinema2PatternControlResolver`.
   */
  readonly patternControls?: Readonly<{ patternChange: Cinema2ParameterId; trigger: Cinema2ParameterId }>
}

export const CINEMA2_MOOD_RULE_PRIORITY = 64

export function createCinema2MoodRules(spec: Readonly<Cinema2MoodDriveSpec>): readonly Cinema2ChoreographyRuleManifest[] {
  const bySource = new Map<Cinema2MoodPath, Cinema2MoodDrive[]>()
  for (const drive of spec.drives) bySource.set(drive.source, [...(bySource.get(drive.source) ?? []), drive])
  const enabledParameter = cinema2Ref(spec.enabledParameter)
  const strengthParameter = spec.strengthParameter ? cinema2Ref(spec.strengthParameter) : undefined
  let priority = CINEMA2_MOOD_RULE_PRIORITY
  return Object.freeze([...bySource.entries()].map(([source, drives]) => {
    const name = `${spec.idPrefix}-mood-${source.replace('mood.', '')}`
    return Object.freeze({
      id: cinema2StableId<Cinema2ChoreographyRuleId>(name),
      priority: priority++,
      enabledParameter,
      ...(strengthParameter ? { strengthParameter } : {}),
      source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: source, clamp: Object.freeze([0, 1] as const) }),
      actions: Object.freeze(drives.map(drive => Object.freeze({
        id: cinema2StableId<Cinema2ChoreographyActionId>(`${name}-${drive.id}`),
        target: drive.target,
        operation: drive.operation,
        value: drive.value,
      }))),
    })
  }))
}

/**
 * Returns the manifest with the mood drives added as gated rules (and the Visual Director capability declared if it was not). Everything else,
 * including every existing rule and the revision, is carried over unchanged, so saved settings keep loading.
 */
export function withCinema2MoodDrives(manifest: Readonly<Cinema2NativePresetManifest>, spec: Readonly<Cinema2MoodDriveSpec>): Readonly<Cinema2NativePresetManifest> {
  const rules = createCinema2MoodRules(spec)
  // The Auto Performance toggle is always tagged (the Inspector's lock finds it by the tag); Pattern Change and Trigger only for a preset with patterns.
  const tagged = tagCinema2MoodPolicies(manifest, {
    ...(spec.patternControls ? { [String(spec.patternControls.patternChange)]: 'patternChange' as const, [String(spec.patternControls.trigger)]: 'trigger' as const } : {}),
    [String(spec.enabledParameter)]: 'autoPerformance',
  })
  if (rules.length === 0) return tagged
  const declared = (manifest.capabilities ?? []).some(capability => capability.id === 'visual-director.significance')
  return Object.freeze({
    ...tagged,
    revision: manifest.revision,
    capabilities: Object.freeze([
      ...(manifest.capabilities ?? []),
      ...(declared ? [] : [Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'The Mood Conductor reads the director to move the preset with the passage\'s mood.' })]),
    ]),
    choreography: Object.freeze({ ...(manifest.choreography ?? {}), rules: Object.freeze([...(manifest.choreography?.rules ?? []), ...rules]) }),
  })
}

/**
 * Tags parameters with `metadata.moodPolicy`, keeping whatever metadata they already have (Depth's `userEditSetParameters`, for example). A
 * parameter id that is not in the manifest throws: a typo would otherwise leave the preset silently untagged.
 */
export function tagCinema2MoodPolicies(manifest: Readonly<Cinema2NativePresetManifest>, tags: Readonly<Record<string, Cinema2MoodPolicy>>): Readonly<Cinema2NativePresetManifest> {
  const remaining = new Set(Object.keys(tags))
  const parameters = (manifest.parameters ?? []).map(parameter => {
    const policy = tags[String(parameter.id)]
    if (!policy) return parameter
    remaining.delete(String(parameter.id))
    return Object.freeze({ ...parameter, metadata: Object.freeze({ ...(parameter.metadata ?? {}), [CINEMA2_MOOD_POLICY_METADATA_KEY]: policy }) })
  })
  if (remaining.size > 0) throw new Error(`Cannot tag moodPolicy: no parameter with id ${[...remaining].join(', ')} in preset ${String(manifest.id)}.`)
  return Object.freeze({ ...manifest, parameters: Object.freeze(parameters) }) as Readonly<Cinema2NativePresetManifest>
}
