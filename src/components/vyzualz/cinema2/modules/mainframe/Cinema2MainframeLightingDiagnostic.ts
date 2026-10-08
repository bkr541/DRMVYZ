import {
  CINEMA2_MAINFRAME_DEFAULT_PATTERN,
  type Cinema2MainframeLightingFrame,
} from './Cinema2MainframePatternEngine'
import {
  CINEMA2_MAINFRAME_SYSTEMS,
  CINEMA2_MAINFRAME_ZERO_IMPULSES,
  CINEMA2_MAINFRAME_ZERO_SIGNALS,
} from './Cinema2MainframeReactivity'

/** Developer-only lighting probe. These names are not authoring controls or new choreography. */
export const CINEMA2_MAINFRAME_LIGHTING_DIAGNOSTIC_FAMILIES = Object.freeze([
  'circuits', 'radars', 'chips', 'terminals', 'indicators', 'logo',
] as const)
export type Cinema2MainframeLightingDiagnosticFamily = typeof CINEMA2_MAINFRAME_LIGHTING_DIAGNOSTIC_FAMILIES[number]

// Terminal and via/indicator hardware share the indicatorCores mesh, but have
// different _mainframe_system IDs. The probe deliberately isolates them.
const SYSTEMS_BY_FAMILY: Readonly<Record<Cinema2MainframeLightingDiagnosticFamily, readonly number[]>> = Object.freeze({
  circuits: [1],
  radars: [4],
  chips: [5],
  terminals: [2],
  indicators: [3],
  logo: [6, 7, 8],
})

export function parseCinema2MainframeLightingDiagnosticFamily(value: string | null): Cinema2MainframeLightingDiagnosticFamily | null {
  return CINEMA2_MAINFRAME_LIGHTING_DIAGNOSTIC_FAMILIES.find(family => family === value) ?? null
}

/** No transport or audio required. Each family has its own positive GPU system gain. */
export function createCinema2MainframeLightingDiagnosticFrame(family: Cinema2MainframeLightingDiagnosticFamily): Readonly<Cinema2MainframeLightingFrame> {
  const systems = SYSTEMS_BY_FAMILY[family]
  const gains = CINEMA2_MAINFRAME_SYSTEMS.map((_, index) => systems.includes(index) ? 1 : 0)
  return Object.freeze({
    active: true,
    pattern: CINEMA2_MAINFRAME_DEFAULT_PATTERN,
    beats: 0,
    level: 1, // Diagnostics deliberately bypass audio and force the selected family to full power.
    chaseFront: -10,
    chaseWidth: 0.1,
    chaseGain: 0,
    chaseDirection: 1 as const,
    flicker: 0,
    // The circuit shader uses its dedicated energy/attack controls instead of
    // applying generic system gain to every route. Keep the audio-free probe lit.
    circuitEnergy: family === 'circuits' ? 1 : 0,
    circuitAccent: 0,
    circuitPulse: 0,
    bankWeights: Object.freeze([0, 0, 0, 0] as const),
    regionWeights: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0] as const),
    systemGains: Object.freeze(gains as unknown as Cinema2MainframeLightingFrame['systemGains']),
    signals: CINEMA2_MAINFRAME_ZERO_SIGNALS,
    impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES,
  })
}
