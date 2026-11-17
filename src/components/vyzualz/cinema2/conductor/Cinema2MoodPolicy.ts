/**
 * The shared vocabulary for "the music chooses Pattern Change and the Trigger while Auto Performance is on". It has no imports, so the preset
 * compiler, the authoring helpers, the modules and the inspector can all depend on it without a cycle.
 *
 * A preset opts in by tagging three of its own parameters with `metadata.moodPolicy` (authoring does this for it, see
 * `withCinema2MoodDrives({ patternControls })`):
 *
 *   'patternChange'    the Pattern Change toggle (boolean)
 *   'trigger'          the Trigger dropdown (enum; its options must include every rung of CINEMA2_MOOD_TRIGGER_LADDER)
 *   'autoPerformance'  the Auto Performance toggle that switches the choice on (boolean)
 */

/** The trigger the music can choose, slowest to fastest. All are values of the canonical Cinema 2.0 Trigger list. */
export const CINEMA2_MOOD_TRIGGER_LADDER = Object.freeze(['bar8', 'bar4', 'bar', 'beat2', 'beat'] as const)
export type Cinema2MoodTrigger = typeof CINEMA2_MOOD_TRIGGER_LADDER[number]

export const CINEMA2_MOOD_POLICY_METADATA_KEY = 'moodPolicy'
export const CINEMA2_MOOD_POLICIES = Object.freeze(['patternChange', 'trigger', 'autoPerformance'] as const)
export type Cinema2MoodPolicy = typeof CINEMA2_MOOD_POLICIES[number]

export function readCinema2MoodPolicy(metadata: unknown): Cinema2MoodPolicy | null {
  if (typeof metadata !== 'object' || metadata === null) return null
  const value = (metadata as Record<string, unknown>)[CINEMA2_MOOD_POLICY_METADATA_KEY]
  return (CINEMA2_MOOD_POLICIES as readonly unknown[]).includes(value) ? value as Cinema2MoodPolicy : null
}

export interface Cinema2MoodPolicyDiagnostic {
  readonly code: string
  readonly message: string
  readonly path: string
}

interface PolicyParameter {
  readonly type?: unknown
  readonly metadata?: unknown
  readonly options?: unknown
}

/**
 * Checks a manifest's tagged parameters: each tag is known and sits on the right kind of control, the Trigger can hold every value the music
 * may choose, and a preset that tags Pattern Change and Trigger tags each exactly once and also tags the Auto Performance toggle (the inspector
 * and the runtime need all three; a half-tagged preset would silently never show or use the choice).
 */
export function validateCinema2MoodPolicyParameters(parameters: readonly PolicyParameter[]): readonly Cinema2MoodPolicyDiagnostic[] {
  const diagnostics: Cinema2MoodPolicyDiagnostic[] = []
  const seen = new Map<Cinema2MoodPolicy, number[]>()
  for (const [index, parameter] of parameters.entries()) {
    const metadata = parameter.metadata
    if (typeof metadata !== 'object' || metadata === null || !(CINEMA2_MOOD_POLICY_METADATA_KEY in metadata)) continue
    const path = `$.parameters[${index}].metadata.${CINEMA2_MOOD_POLICY_METADATA_KEY}`
    const policy = readCinema2MoodPolicy(metadata)
    if (policy == null) {
      diagnostics.push({ code: 'CINEMA2_PRESET_MOOD_POLICY_UNKNOWN', message: `moodPolicy must be one of ${CINEMA2_MOOD_POLICIES.join(', ')}.`, path })
      continue
    }
    seen.set(policy, [...(seen.get(policy) ?? []), index])
    if ((policy === 'patternChange' || policy === 'autoPerformance') && parameter.type !== 'boolean') {
      diagnostics.push({ code: 'CINEMA2_PRESET_MOOD_POLICY_TYPE', message: `moodPolicy "${policy}" belongs on a boolean parameter.`, path })
    }
    if (policy === 'trigger') {
      const values = new Set(Array.isArray(parameter.options) ? parameter.options.map(option => String((option as { value?: unknown })?.value)) : [])
      const missing = CINEMA2_MOOD_TRIGGER_LADDER.filter(value => !values.has(value))
      if (parameter.type !== 'enum' || missing.length > 0) {
        diagnostics.push({
          code: 'CINEMA2_PRESET_MOOD_POLICY_TRIGGER_OPTIONS',
          message: `moodPolicy "trigger" belongs on an enum whose options include ${CINEMA2_MOOD_TRIGGER_LADDER.join(', ')}${missing.length > 0 ? ` (missing: ${missing.join(', ')})` : ''}.`,
          path,
        })
      }
    }
  }
  for (const [policy, indexes] of seen) {
    if (indexes.length > 1) diagnostics.push({ code: 'CINEMA2_PRESET_MOOD_POLICY_DUPLICATE', message: `moodPolicy "${policy}" may be used by one parameter only.`, path: `$.parameters[${indexes[1]}].metadata.${CINEMA2_MOOD_POLICY_METADATA_KEY}` })
  }
  if (seen.size > 0) {
    for (const policy of CINEMA2_MOOD_POLICIES) {
      if (!seen.has(policy)) {
        diagnostics.push({ code: 'CINEMA2_PRESET_MOOD_POLICY_INCOMPLETE', message: `A preset that tags moodPolicy must tag ${CINEMA2_MOOD_POLICIES.join(', ')} together; "${policy}" is missing.`, path: '$.parameters' })
      }
    }
  }
  return diagnostics
}
