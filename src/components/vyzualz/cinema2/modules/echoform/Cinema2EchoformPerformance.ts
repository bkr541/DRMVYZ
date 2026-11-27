import { CINEMA2_MAINFRAME_PATTERN_IDS, type Cinema2MainframeLightingFrame, type Cinema2MainframePatternId } from '../mainframe/Cinema2MainframePatternEngine'
import type { Cinema2MainframeMusicalEvent } from '../mainframe/Cinema2MainframeMusicAdapter'

// The first six IDs are intentionally unchanged for saved presets. The lighting bus is
// still shared, but each selection now authors its own spatial composition.
export const ECHOFORM_PATTERN_IDS = [...CINEMA2_MAINFRAME_PATTERN_IDS, 'echo-chamber', 'particle-cyclone', 'stereo-warfare', 'phase-shift', 'blackout-reactor', 'singularity'] as const
export type EchoformPattern = typeof ECHOFORM_PATTERN_IDS[number]
export const ECHOFORM_PATTERN_OPTIONS = ECHOFORM_PATTERN_IDS.map((value, i) => Object.freeze({ value, label: ['Resonance', 'Implosion', 'Neural Scan', 'Fragment Relay', 'Orbital Overdrive', 'Reactor Surge', 'Echo Chamber', 'Particle Cyclone', 'Stereo Warfare', 'Phase Shift', 'Blackout Reactor', 'Singularity'][i]! }))
export const echoformLightingPattern = (pattern: EchoformPattern): Cinema2MainframePatternId => CINEMA2_MAINFRAME_PATTERN_IDS[ECHOFORM_PATTERN_IDS.indexOf(pattern) % 6]!
const unit = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0))
const fract = (x: number) => x - Math.floor(x)
const tau = Math.PI * 2
export const ECHOFORM_WAVE_COUNT = 6
export interface EchoformWave { readonly age: number; readonly gain: number; readonly side: number }
export interface EchoformPerformance {
  readonly mode: number; readonly time: number; readonly localBeat: number; readonly motion: number
  readonly charge: number; readonly impact: number; readonly darkness: number; readonly energy: number
  readonly orbit: number; readonly contraction: number; readonly vortex: number; readonly scan: number; readonly scanGain: number
  readonly fragment: number; readonly assemble: number; readonly echo: number; readonly stereo: number; readonly stereoSide: number
  readonly pitch: number; readonly roll: number; readonly depth: number; readonly waves: readonly EchoformWave[]
}

/** Bounded event history. Only canonical delivered events can launch waves; no beat-clock guesses. */
export class EchoformWaveBank {
  private events: Cinema2MainframeMusicalEvent[] = []
  private seen = new Set<string>()
  private order: string[] = []
  private side = 1
  private sides = new Map<string, number>()
  reset(): void { this.events = []; this.seen.clear(); this.order = []; this.sides.clear(); this.side = 1 }
  update(events: readonly Cinema2MainframeMusicalEvent[], time: number, playing: boolean): readonly EchoformWave[] {
    if (!playing) { this.events = []; this.sides.clear(); return [] }
    for (const event of events) {
      if (!['kick', 'drop', 'snare'].includes(event.kind) || this.seen.has(event.id) || !Number.isFinite(event.timeSec)) continue
      this.seen.add(event.id); this.order.push(event.id)
      if (this.order.length > 128) this.seen.delete(this.order.shift()!)
      if (event.kind === 'snare') this.side *= -1
      this.sides.set(event.id, event.kind === 'snare' ? this.side : 0)
      this.events.push(event)
    }
    this.events = this.events.filter(e => time - e.timeSec < 1.35 && time - e.timeSec >= -0.1).slice(-ECHOFORM_WAVE_COUNT)
    const retained = new Set(this.events.map(e => e.id))
    for (const id of this.sides.keys()) if (!retained.has(id)) this.sides.delete(id)
    return this.events.map(e => ({ age: unit((time - e.timeSec) / 1.35), gain: unit(e.visualStrength ?? e.strength) * (e.kind === 'drop' ? 1 : e.kind === 'snare' ? 0.52 : 0.8), side: this.sides.get(e.id) ?? 0 }))
  }
  get stereoSide(): number { return this.side }
}

export function evaluateEchoformPerformance(pattern: EchoformPattern, beat: number, start: number, rate: number, motion: number, intensity: number, lighting: Readonly<Cinema2MainframeLightingFrame> | null, playing: boolean, waves: readonly EchoformWave[], stereoSide: number): EchoformPerformance {
  const mode = ECHOFORM_PATTERN_IDS.indexOf(pattern)
  const active = playing && lighting?.active === true
  const s = active ? lighting.signals : null
  const e = active ? lighting.impulses : null
  const t = Math.max(0, beat - start) * rate
  const phase = fract(t / 4)
  const sweep = 0.5 - 0.5 * Math.cos(phase * tau)
  const charge = unit(active ? lighting.buildCharge : 0)
  const impact = unit((e?.drop ?? 0) + (e?.kick ?? 0) * 0.45 + (e?.downbeat ?? 0) * 0.16)
  const calm = active && lighting.sectionMode === 3 ? 0.65 * lighting.sectionConfidence : 0
  const energy = unit((s?.overall ?? 0) * intensity)
  const m = unit(motion) * (playing ? 1 : 0)
  let orbit = 0.65, contraction = 0, vortex = 0.25, scan = phase, scanGain = 0, fragment = 0, assemble = 1, echo = 0.08, stereo = 0.25, darkness = 0
  switch (mode) {
    case 0: orbit = 0.72 + impact * 0.28; vortex = 0.35; stereo = 0.8; break
    case 1: contraction = 0.25 + 0.65 * sweep; assemble = 0.45 + 0.55 * sweep; vortex = 0.85; orbit = 0.65; break
    case 2: scanGain = 1; scan = fract(t / 2); orbit = 0.22; assemble = 0.8; break
    case 3: fragment = 0.3 + 0.7 * (e?.snare ?? 0) + 0.25 * sweep; echo = 0.28; orbit = 0.38; break
    case 4: orbit = 1; vortex = 0.52; contraction = 0.3 * sweep; break
    case 5: contraction = charge * 0.8; orbit = 0.5 + charge * 0.5; vortex = 0.2 + charge * 0.8; echo = charge * 0.5; break
    case 6: echo = 0.62 + 0.38 * sweep; orbit = 0.25; fragment = 0.16; break
    case 7: vortex = 1; contraction = 0.35 * sweep; orbit = 0.32; assemble = 0.75 + 0.25 * sweep; break
    case 8: stereo = 1; orbit = 0.32; echo = 0.22 * (e?.snare ?? 0); break
    case 9: fragment = sweep * 0.68; assemble = 1 - sweep * 0.45; scanGain = 0.55; echo = sweep * 0.7; break
    case 10: darkness = (1 - (e?.downbeat ?? 0)) * (0.4 + 0.6 * sweep); orbit = 0.42; break
    case 11: contraction = sweep * 0.92; assemble = 1 - sweep * 0.75; vortex = 0.9; orbit = 0.75; break
  }
  // Shared, confidence-gated build charge and delivered drop impulses apply across all routines.
  const release = unit(e?.drop ?? 0)
  const preDrop = unit((charge - 0.84) / 0.16) * (1 - release)
  darkness = Math.max(darkness * m, preDrop) * (1 - release) * intensity
  return { mode, time: playing ? beat * rate : 0, localBeat: t, motion: m, charge, impact: impact * intensity, darkness,
    energy, orbit: unit(orbit * (1 - calm) * (playing ? 1 : 0.25) + release * 0.6), contraction: unit((contraction * m + charge * 0.22) * (1 - release)),
    vortex: unit(vortex * (1 - calm) * (playing ? 1 : 0.2) + charge * 0.35), scan, scanGain: scanGain * m, fragment: unit(fragment * m + (s?.flux ?? 0) * intensity * 0.25),
    assemble: 1 - (1 - assemble) * m * (1 - release), echo: unit((echo * m + (e?.snare ?? 0) * 0.17 + charge * 0.15) * (1 - darkness)),
    stereo: unit(stereo + (s?.mid ?? 0) * 0.2), stereoSide, pitch: m * (Math.sin(t * tau / 4) * 0.055 - impact * 0.12),
    roll: m * Math.sin(t * tau / 8) * 0.085, depth: m * (charge * 0.22 - impact * 0.28 + (s?.sub ?? 0) * 0.08), waves: active ? waves : [] }
}
