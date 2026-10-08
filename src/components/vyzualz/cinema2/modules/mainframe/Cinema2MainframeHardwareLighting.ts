import type { Cinema2MainframeLightingFrame } from './Cinema2MainframePatternEngine'

/** Four independent, clamped responses for the *existing* hardware meshes.
 * No timers or generated beats: only the shared Mainframe audio envelopes can
 * excite these channels. The authored pattern's system gains remain in control.
 */
export function resolveCinema2MainframeHardwareLighting(frame: Readonly<Cinema2MainframeLightingFrame>): readonly [number, number, number, number] {
  if (!frame.active) return [0, 0, 0, 0]
  const { signals: s, impulses: e } = frame
  const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  return [
    clamp(0.12 * s.bass + 0.76 * e.kick + 0.3 * e.transient + 0.28 * e.downbeat + 0.55 * e.drop),
    clamp(0.42 * s.high + 0.3 * s.flux + 0.42 * e.transient + 0.2 * e.beat + 0.32 * e.drop),
    clamp(0.36 * s.mid + 0.18 * s.high + 0.52 * e.fourBeat + 0.3 * e.downbeat + 0.4 * e.phrase + 0.56 * e.drop),
    clamp(0.6 * s.mid + 0.12 * s.high + 0.38 * e.phrase + 0.25 * e.section + 0.3 * e.downbeat + 0.58 * e.drop),
  ]
}
