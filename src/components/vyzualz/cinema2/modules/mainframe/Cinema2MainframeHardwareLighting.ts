import type { Cinema2MainframeLightingFrame } from './Cinema2MainframePatternEngine'

export interface Cinema2MainframeComponentLighting {
  readonly terminals: number
  readonly indicators: number
  readonly radarRings: number
  readonly radarNodes: number
  readonly chipBody: number
  readonly chipPins: number
  readonly chipIndicators: number
  readonly logoDetails: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

/** One centralized mapping from shared intelligence to Mainframe's real mesh families. */
export function resolveCinema2MainframeComponentLighting(frame: Readonly<Cinema2MainframeLightingFrame>): Readonly<Cinema2MainframeComponentLighting> {
  if (!frame.active) return Object.freeze({
    terminals: 0, indicators: 0, radarRings: 0, radarNodes: 0,
    chipBody: 0, chipPins: 0, chipIndicators: 0, logoDetails: 0,
  })
  const { signals: s, impulses: e } = frame
  const build = frame.buildCharge
  return Object.freeze({
    terminals: clamp(0.13 * s.bass + 0.76 * e.kick + 0.22 * e.transient + 0.3 * e.downbeat + 0.54 * e.drop),
    indicators: clamp(0.4 * s.high + 0.28 * s.flux + 0.56 * e.transient + 0.1 * e.beat + 0.28 * e.drop),
    radarRings: clamp(0.34 * s.mid + 0.5 * e.fourBeat + 0.34 * e.downbeat + 0.28 * e.phrase + 0.24 * build + 0.48 * e.drop),
    radarNodes: clamp(0.2 * s.mid + 0.3 * s.high + 0.34 * e.transient + 0.42 * e.downbeat + 0.18 * build + 0.42 * e.drop),
    chipBody: clamp(0.48 * s.mid + 0.14 * s.high + 0.44 * e.phrase + 0.34 * e.snare + 0.2 * e.section + 0.22 * build + 0.52 * e.drop),
    chipPins: clamp(0.28 * s.mid + 0.3 * s.high + 0.52 * e.snare + 0.32 * e.phrase + 0.24 * build + 0.44 * e.drop),
    chipIndicators: clamp(0.32 * s.high + 0.24 * s.flux + 0.5 * e.transient + 0.34 * e.snare + 0.38 * e.drop),
    logoDetails: clamp(0.22 * s.sub + 0.22 * s.vocal + 0.56 * e.snare + 0.48 * e.downbeat + 0.36 * e.phrase + 0.72 * e.drop),
  })
}

/** Four independent, clamped responses for the *existing* hardware meshes.
 * No timers or generated beats: only the shared Mainframe audio envelopes can
 * excite these channels. The authored pattern's system gains remain in control.
 */
export function resolveCinema2MainframeHardwareLighting(frame: Readonly<Cinema2MainframeLightingFrame>): readonly [number, number, number, number] {
  const components = resolveCinema2MainframeComponentLighting(frame)
  return [
    components.terminals,
    components.indicators,
    Math.max(components.radarRings, components.radarNodes),
    Math.max(components.chipBody, components.chipPins, components.chipIndicators),
  ]
}

/** radar rings, radar nodes, chip pins/traces, chip indicators */
export function resolveCinema2MainframeHardwareDetails(frame: Readonly<Cinema2MainframeLightingFrame>): readonly [number, number, number, number] {
  const components = resolveCinema2MainframeComponentLighting(frame)
  return [components.radarRings, components.radarNodes, components.chipPins, components.chipIndicators]
}
