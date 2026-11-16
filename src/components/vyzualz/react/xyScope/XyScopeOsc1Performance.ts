// Sound Drawing XY › OSC 1: Auto Performance, ported from XY / TEXT LAB 05's conductor. A pure, signal-driven layer
// that coordinates all sixteen visual controls, the phosphor colour and each letter's gain / direction / focus from
// live audio features plus structural evidence (build, drop, breakdown). No random scenes, beat slots or knob LFOs:
// every value approaches its current target through bounded exponential smoothing.
//
// The Text Lab read a precomputed full-track map at the playback position. Here the same role is played by the
// shared Music Intelligence context, which already carries track-relative energy, build, drop and section evidence.

import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { Osc1ControlKey, Osc1Controls, Osc1Features, Osc1Focus, Osc1Settings } from './XyScopeOsc1Engine'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p

export const OSC1_RANGES: Readonly<Record<Osc1ControlKey, readonly [number, number]>> = Object.freeze({
  motion: [0, 100], readability: [0, 100], depth: [0, 100], attack: [8, 250], release: [40, 800], sensitivity: [0, 100],
  rotation: [0, 140], correlation: [0, 100], axisX: [35, 150], axisY: [35, 150], shear: [0, 100], harmonics: [0, 100],
  intensity: [10, 100], persistence: [20, 250], width: [.6, 3], scan: [8, 180],
})

/**
 * BPM Sync for OSC 1: its only musical times are the attack and release of its envelopes, so with BPM Sync they follow the track's tempo
 * (`scale` is 100 / BPM: a track faster than the reference tempo reacts proportionally faster, a slower one slower), kept inside their ranges.
 * A scale of 1 (BPM Sync off, or no beat grid) returns the settings untouched.
 */
export function scaleOsc1Times(settings: Osc1Settings, scale: number): Osc1Settings {
  if (scale === 1 || !Number.isFinite(scale)) return settings
  const [attackLo, attackHi] = OSC1_RANGES.attack, [releaseLo, releaseHi] = OSC1_RANGES.release
  return { ...settings, attack: clamp(settings.attack * scale, attackLo, attackHi), release: clamp(settings.release * scale, releaseLo, releaseHi) }
}

/** Structural evidence at the playback position, the equivalent of the Text Lab's track-map sample. */
export interface Osc1StructureFrame {
  energy: number
  bass: number
  mid: number
  air: number
  flux: number
  build: number
  drop: number
  breakdown: number
  confidence: number
}

/** Maps the shared performance context to structural evidence, or null when no analysed track backs it. */
export function osc1StructureFromContext(context: SharedPerformanceContext | null): Osc1StructureFrame | null {
  if (!context || !(context.analysisIdentity || context.resolvedSection || context.sections.length > 0)) return null
  const type = context.sectionType
  const breakdownSection = type === 'breakdown' || type === 'bridge' || type === 'intro' || type === 'outro'
  const breakdown = clamp(breakdownSection ? .55 + (1 - clamp(context.trackRelativeEnergy)) * .4 : clamp(-context.energyTrend * 2.5) * clamp(1 - context.bass))
  return {
    energy: clamp(context.trackRelativeEnergy ?? context.energy),
    bass: clamp(context.bass), mid: clamp(context.mid), air: clamp(context.high),
    flux: clamp(context.spectralFlux),
    build: clamp(Math.max(context.buildProgress, context.tension * .8)),
    drop: clamp(context.dropImpact),
    breakdown,
    confidence: clamp(.38 + clamp(context.sectionConfidence) * .58, .38, .96),
  }
}

export interface Osc1LetterTarget { gain: number; offset: number; focus: Osc1Focus }
export interface Osc1ConductorOutput {
  settings: Osc1Settings
  letters: Osc1LetterTarget[]
  state: string
  dominant: 'BASS' | 'MID' | 'AIR'
  confidence: number
  mapped: boolean
  build: number
  drop: number
}
export interface Osc1ConductorContext {
  structure: Osc1StructureFrame | null
  mode: number
  base: Osc1Settings
  letterCount: number
}

const hex = (rgb: number[]) => '#' + rgb.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')
const FAST_GEOMETRY: readonly Osc1ControlKey[] = ['axisX', 'axisY', 'readability', 'rotation', 'correlation', 'shear', 'scan']

export class Osc1Conductor {
  private fast = 0
  private slow = 0
  private previous = 0
  private rise = 0
  private transient = 0
  private drop = 0
  private initialized = false
  private effective: Osc1Settings | null = null
  private rgb: number[] = [87, 239, 183]
  private letterValues: Osc1LetterTarget[] = []
  private focusGroups: number[] = []
  private state = 'LISTENING'
  private confidence = 0

  constructor() { this.reset() }

  reset(): void {
    this.fast = 0; this.slow = 0; this.previous = 0; this.rise = 0; this.transient = 0; this.drop = 0
    this.initialized = false; this.effective = null; this.letterValues = []; this.focusGroups = []
    this.state = 'LISTENING'; this.confidence = 0
  }

  update(dt: number, features: Osc1Features, context: Osc1ConductorContext): Osc1ConductorOutput {
    const f = features
    const spectrum = f.spectrum ?? [], onsets = f.onsets ?? [], mapped = context.structure
    const level = clamp(f.level || 0), bass = clamp(f.bass || 0), mid = clamp(f.mid || 0), air = clamp(f.air || 0), flux = clamp(f.flux || 0)
    const width = clamp(f.width || 0), corr = clamp(f.correlation || 0, -1, 1), balance = clamp(f.balance || 0, -1, 1)
    if (!this.initialized) { this.fast = level; this.slow = mapped ? mapped.energy : level; this.previous = level; this.initialized = true }
    const alpha = (t: number) => 1 - Math.exp(-dt / t)
    const priorFast = this.fast, priorSlow = this.slow
    this.fast = mix(this.fast, level, alpha(.22))
    this.slow = mix(this.slow, level, alpha(5))
    const slope = (this.fast - priorFast) / Math.max(.001, dt), up = clamp(slope * .9), jump = clamp((this.fast - priorSlow - .12) * 2.2)
    this.rise = mix(this.rise, clamp((this.fast - this.slow) * 2 + up * .4 + (air - bass) * .25), alpha(.8))
    let maxOnset = 0
    for (let i = 0; i < onsets.length; i++) maxOnset = Math.max(maxOnset, onsets[i] || 0)
    const attack = clamp(flux * .75 + Math.max(0, level - this.previous) * 3 + maxOnset * .35)
    this.previous = level
    this.transient = Math.max(attack, this.transient * Math.exp(-dt / .12))
    // Live fallback requires a contrast in energy + low-frequency return, not every kick.
    const newDrop = jump * bass * clamp(up + flux) * clamp(1 - this.drop)
    this.drop = Math.max(newDrop, this.drop * Math.exp(-dt / 1.15))
    const build = mapped ? mapped.build : this.rise * clamp(.4 + air * .8)
    const drop = mapped ? Math.max(mapped.drop, this.drop * .25) : this.drop
    const breakdown = mapped ? mapped.breakdown : clamp((this.slow - this.fast) * 2.5) * clamp(1 - bass)
    const centroid = clamp(f.centroid || 0), texture = clamp(f.flatness || 0), roughness = clamp(f.roughness || 0), pitchRegion = clamp(f.dominant || 0), crest = clamp(f.crest || 0)
    const active = clamp(level * 4), energy = clamp(level * .72 + (mapped?.energy ?? this.fast) * .28), hit = this.transient * active
    const tension = clamp(build) * active, impact = clamp(drop) * active, quiet = clamp(breakdown), toneTotal = bass + mid + air + .001
    const low = bass / toneTotal, high = air / toneTotal
    const dominant: 'BASS' | 'MID' | 'AIR' = low > high && bass >= mid ? 'BASS' : air > mid ? 'AIR' : 'MID'
    this.state = level < .002 ? 'SILENCE' : impact > .22 ? 'DROP' : tension > .28 ? 'BUILD' : quiet > .38 ? 'BREAKDOWN' : bass > .52 && bass > mid * 1.1 ? 'BASS' : hit > .6 ? 'TRANSIENT' : energy > .55 ? 'HIGH ENERGY' : 'FLOW'
    this.confidence = mapped ? mapped.confidence : clamp(.25 + Math.abs(this.fast - this.slow) * .7 + hit * .2, .25, .72)
    // All sixteen visual sliders are coordinated from audio features and section evidence.
    const target: Osc1Controls = {
      motion: 28 + energy * 48 + impact * 22 + tension * 12,
      depth: 25 + hit * 48 + impact * 38 + bass * 16,
      readability: clamp(87 - tension * 30 - impact * 23 - hit * 8, 38, 94),
      attack: clamp(90 - tension * 48 - hit * 65 - impact * 24, 8, 180),
      release: clamp(125 + quiet * 230 + tension * 150 - impact * 75 + (1 - flux) * 40, 45, 650),
      sensitivity: 32 + flux * 32 + tension * 16 + impact * 20 + texture * 12,
      rotation: clamp(30 + width * 60 + mid * 20 + centroid * 20 - tension * 18 + impact * 26, 8, 140),
      correlation: clamp(42 + (corr + 1) * 18 + bass * 20 + tension * 14 - width * 26, 5, 100),
      // Deliberate axis compression and opening, driven by section evidence.
      axisX: clamp(85 + bass * 24 + impact * 22 + width * 8 + clamp(f.peakL || 0) * 5 - tension * 10, 65, 145),
      axisY: clamp(91 + mid * 10 + impact * 35 + clamp(f.peakR || 0) * 5 - tension * 47 - quiet * 18, 40, 145),
      shear: clamp(18 + Math.abs(balance) * 70 + width * 35 + hit * 20, 0, 100),
      harmonics: clamp(15 + air * 35 + flux * 20 + impact * 15 + texture * 15 + roughness * 15, 5, 100),
      intensity: clamp(30 + energy * 36 + hit * 18 + impact * 20 - quiet * 10, 20, 100),
      persistence: clamp(48 + tension * 140 + quiet * 80 + width * 22 - impact * 27 - hit * 15, 25, 240),
      width: clamp(.75 + energy * .6 + impact * .7 + hit * .25 + crest * .2, .65, 2.5),
      scan: clamp(44 + air * 40 + tension * 24 + impact * 35 + flux * 16 + pitchRegion * 24, 30, 170),
    }
    // The selected tab remains the user's response model; auto performs within it.
    if (context.mode === 2) { target.harmonics = clamp(target.harmonics + 15, 0, 100); target.persistence = clamp(target.persistence + 18, 20, 250) }
    if (context.mode === 3) { target.attack = Math.min(target.attack, 25); target.depth = clamp(target.depth + 12, 0, 100); target.persistence = Math.max(25, target.persistence - 15) }
    if (context.mode === 4) { target.rotation = Math.min(target.rotation, 50); target.harmonics = clamp(target.harmonics + 10, 0, 100) }
    const hue = [mix(83, 255, clamp(impact * .85 + low * .3)), mix(155, 239, clamp(1 - impact)), mix(200, 255, clamp(high + tension * .45))]
    if (!this.effective) { this.effective = { ...context.base }; this.rgb = [...hue] }
    const effective = this.effective as unknown as Record<Osc1ControlKey, number>
    for (const key of Object.keys(OSC1_RANGES) as Osc1ControlKey[]) {
      const [lo, hi] = OSC1_RANGES[key]
      const v = clamp(target[key], lo, hi)
      const tau = FAST_GEOMETRY.includes(key) ? (impact > .3 ? .12 : .34) : v > effective[key] ? .09 : .28
      effective[key] = mix(effective[key] ?? v, v, alpha(tau))
    }
    this.rgb = this.rgb.map((v, i) => mix(v, hue[i], alpha(.7)))
    this.effective.color = hex(this.rgb)
    // Letters respond to their strongest region; no phase advances with clock time.
    const groups = [[0, 1], [2, 3, 4], [5, 6, 7]]
    const levels = [bass, mid, air]
    const letters: Osc1LetterTarget[] = []
    for (let i = 0; i < context.letterCount; i++) {
      const preferred = i % 3
      const scores = levels.map((v, g) => v * .55 + Math.max(0, ...groups[g].map(k => onsets[k] || 0)) * .25 + (g === preferred ? .22 : 0))
      let group = this.focusGroups[i] ?? preferred
      const candidate = scores.indexOf(Math.max(...scores))
      if (scores[candidate] > scores[group] + .12) group = candidate
      this.focusGroups[i] = group
      const indices = groups[group]
      let peak = indices[0]
      for (const k of indices) if ((spectrum[k] || 0) > (spectrum[peak] || 0)) peak = k
      const focus = (['bass', 'mid', 'air'] as const)[group], bandLevel = levels[group], prev = this.letterValues[i] || { gain: 1, offset: 0 }
      const gain = mix(prev.gain, clamp(.5 + bandLevel * .55 + hit * .2 + impact * .18, .4, 1.4), alpha(.16))
      // Bounded offset follows spectral region and signed stereo bias, without wrap jumps.
      const offset = mix(prev.offset, clamp((peak / 7 * .55 + balance * .16 + width * .12) * Math.PI, 0, Math.PI * .85), alpha(.3))
      letters.push({ gain, offset, focus })
    }
    this.letterValues = letters
    return { settings: { ...this.effective }, letters, state: this.state, dominant, confidence: this.confidence, mapped: !!mapped, build: tension, drop: impact }
  }
}
