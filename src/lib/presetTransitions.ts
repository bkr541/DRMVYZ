/**
 * The transition choices for changing what is on stage (a preset in any engine, or a switch from one engine to another), and how a setting turns into the one style
 * used for a particular change.
 *
 * Today the choice comes from Settings > System Settings > Transitions (two values: on/off, and one of the five styles or Random). It is resolved through
 * `resolvePresetTransition` rather than read directly so that a per-pad or per-cue override can be added later without touching the callers: the override is passed in, and it
 * can inherit the setting, switch transitions off for that one change, or force a style (or Random).
 *
 * The master switch always wins: with Transitions off in Settings, no override brings them back. A performer who turns them off gets hard cuts everywhere.
 */
export const PRESET_TRANSITION_STYLES = ['dissolve', 'flash', 'wipe', 'zoom', 'dip'] as const
export type PresetTransitionStyle = typeof PRESET_TRANSITION_STYLES[number]

/** What the user picks: one of the styles, or Random (a different style for each change). */
export type PresetTransitionChoice = PresetTransitionStyle | 'random'
export const PRESET_TRANSITION_CHOICES: readonly PresetTransitionChoice[] = Object.freeze([...PRESET_TRANSITION_STYLES, 'random'] as const)

/** A per-pad or per-cue override: follow the setting, no transition for this change, or a specific choice. */
export type PresetTransitionOverride = 'inherit' | 'off' | PresetTransitionChoice

export const DEFAULT_PRESET_TRANSITION_CHOICE: PresetTransitionChoice = 'dissolve'

export const PRESET_TRANSITION_LABELS: Readonly<Record<PresetTransitionChoice, string>> = Object.freeze({
  dissolve: 'Dissolve',
  flash: 'Flash',
  wipe: 'Wipe',
  zoom: 'Zoom',
  dip: 'Dip to Black',
  random: 'Random',
})

export const PRESET_TRANSITION_DESCRIPTIONS: Readonly<Record<PresetTransitionChoice, string>> = Object.freeze({
  dissolve: 'The old picture fades into the new one.',
  flash: 'A bright flash covers the change.',
  wipe: 'The new picture sweeps across the old one.',
  zoom: 'The old picture pushes in as it fades away.',
  dip: 'Fades down to black, then up into the new picture.',
  random: 'A different style for each change.',
})

export function isPresetTransitionChoice(value: unknown): value is PresetTransitionChoice {
  return typeof value === 'string' && (PRESET_TRANSITION_CHOICES as readonly string[]).includes(value)
}

export function isPresetTransitionOverride(value: unknown): value is PresetTransitionOverride {
  return value === 'inherit' || value === 'off' || isPresetTransitionChoice(value)
}

export interface ResolvePresetTransitionInput {
  /** Settings > System Settings > Transitions in React. */
  enabled: boolean
  /** The style (or Random) chosen in Settings. */
  choice: PresetTransitionChoice
  /** A per-pad or per-cue override for this one change; absent or `inherit` follows the setting. */
  override?: PresetTransitionOverride | null
  /** The style used for the previous change, so Random does not repeat it back to back. */
  previous?: PresetTransitionStyle | null
  /** For tests; defaults to Math.random. */
  random?: () => number
}

/** The style to use for this change, or null for a plain cut. */
export function resolvePresetTransition({ enabled, choice, override, previous = null, random = Math.random }: ResolvePresetTransitionInput): PresetTransitionStyle | null {
  if (!enabled) return null
  const wanted: PresetTransitionChoice | 'off' = override == null || override === 'inherit' ? choice : override
  if (wanted === 'off') return null
  if (wanted !== 'random') return wanted
  const pool = PRESET_TRANSITION_STYLES.filter(style => style !== previous)
  const from = pool.length > 0 ? pool : PRESET_TRANSITION_STYLES
  const index = Math.min(from.length - 1, Math.max(0, Math.floor(random() * from.length)))
  return from[index]
}
