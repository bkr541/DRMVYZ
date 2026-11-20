import { CINEMA2_AFTERHOURS_TRIGGER_IDS, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'

export const CINEMA2_ANCIENT_MACHINE_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS
export type Cinema2AncientMachineTriggerId = Cinema2AfterhoursTriggerId

/**
 * Ancient Machine's Pattern library. Each pattern is a complete state of the one mechanism, not a re-skin of another:
 *  - Oracle Lock, Gear Sun and Epoch Engine are the three legacy identities (their own ring tempo, light cadence and crystal pulse in the shader).
 *  - Build Charge is the machine winding up: the slow Epoch Engine tempo with the rings drawn inward and the internal light climbing. Auto Performance puts it on
 *    stage while a build charges.
 *  - Drop Impact is the machine releasing: Gear Sun's fast tempo with the crystal swollen open, the debris thrown outward and the light strips flared. Auto
 *    Performance puts it on stage on a drop.
 *  - Counter Orrery is a new state with its own shader look (3): the rings nest as gimbals, each tilted a fixed step from the last rather than scattered, so the
 *    machine reads as an orrery; neighbouring rings are driven hard against each other, the layers are pulled apart, fewer glyphs are lit, and the light
 *    cadence alternates ring by ring.
 */
export const CINEMA2_ANCIENT_MACHINE_PATTERNS = Object.freeze([
  Object.freeze({ value: 'oracle-lock', label: 'Oracle Lock' }),
  Object.freeze({ value: 'gear-sun', label: 'Gear Sun' }),
  Object.freeze({ value: 'epoch-engine', label: 'Epoch Engine' }),
  Object.freeze({ value: 'build-charge', label: 'Build Charge' }),
  Object.freeze({ value: 'drop-impact', label: 'Drop Impact' }),
  Object.freeze({ value: 'counter-orrery', label: 'Counter Orrery' }),
] as const)
export const CINEMA2_ANCIENT_MACHINE_PATTERN_IDS = Object.freeze(CINEMA2_ANCIENT_MACHINE_PATTERNS.map(pattern => pattern.value))
export type Cinema2AncientMachinePattern = typeof CINEMA2_ANCIENT_MACHINE_PATTERNS[number]['value']

/** What a pattern sets on the mechanism. `look` selects the shader's ring tempo and light cadence; the rest scale or add to the user's own values. */
export interface Cinema2AncientMachinePatternState {
  readonly look: 0 | 1 | 2 | 3
  /** The pattern's own build and drop amounts (0..1). Auto Performance's live build and drop add to them. */
  readonly build: number
  readonly drop: number
  /** Multipliers on Rotation Speed, Counter-Rotation, Mechanical Depth and Glyph Density. */
  readonly rotation: number
  readonly counterRotation: number
  readonly depth: number
  readonly glyphDensity: number
}

const state = (look: 0 | 1 | 2 | 3, rest: Partial<Omit<Cinema2AncientMachinePatternState, 'look'>> = {}): Cinema2AncientMachinePatternState =>
  Object.freeze({ look, build: 0, drop: 0, rotation: 1, counterRotation: 1, depth: 1, glyphDensity: 1, ...rest })

export const CINEMA2_ANCIENT_MACHINE_PATTERN_STATES: Readonly<Record<Cinema2AncientMachinePattern, Cinema2AncientMachinePatternState>> = Object.freeze({
  'oracle-lock': state(0),
  'gear-sun': state(1),
  'epoch-engine': state(2),
  'build-charge': state(2, { build: 0.85, rotation: 1.1 }),
  'drop-impact': state(1, { drop: 0.85, depth: 1.15 }),
  'counter-orrery': state(3, { rotation: 0.85, counterRotation: 1.9, depth: 1.3, glyphDensity: 0.8 }),
})
