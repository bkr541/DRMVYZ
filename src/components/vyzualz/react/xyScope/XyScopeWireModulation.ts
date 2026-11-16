// Sound Drawing XY › WIREFRAME: how the music reaches the drawing. Each audio feature drives a different, bounded parameter through its own
// rule (the guide's §22–23 and the architecture's driver table), never one generic "energy" knob. A rule has an attack and a release, a
// curve, a confidence floor and an explicit answer to "what if this feature is not available": go neutral, hold, or switch off.
//
// Features are normalised to the track's own range, not to fixed numbers, so a quiet ambient track and a loud dubstep master both use the
// whole span of every rule. Nothing here is random.

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

/**
 * A streaming estimate of a feature's 10th and 90th percentile, used to turn it into 0..1 (the guide's z = (x − P10) / (P90 − P10)). Each
 * percentile steps toward the signal by an amount that depends on how often the signal lies above or below it, so the estimates settle
 * over a few seconds, follow a change of track, and stay put during silence (which would otherwise drag them to zero).
 */
export class SourceRelativeNormalizer {
  private low = 0
  private high = 1
  private warm = 0

  /** `silent` freezes the estimates. Returns the feature scaled to 0..1 against its own recent range. */
  update(x: number, silent = false): number {
    const value = clamp(x, 0, 4)
    if (!silent) {
      if (this.warm === 0) { this.low = Math.max(0, value - .05); this.high = value + .1 }
      this.warm = Math.min(1, this.warm + 1 / 90)
      const spread = Math.max(.05, this.high - this.low)
      // Robbins–Monro steps for a quantile τ: q moves up by η·τ when the signal is above it and down by η·(1 − τ) when below. So the 10th
      // percentile creeps up slowly and drops fast, and the 90th does the opposite.
      const rate = (.02 + .06 * (1 - this.warm)) * spread
      this.low += value > this.low ? rate * .1 : -rate * .9
      this.high += value > this.high ? rate * .9 : -rate * .1
      if (this.high < this.low + .05) this.high = this.low + .05
    }
    return clamp((value - this.low) / Math.max(.05, this.high - this.low))
  }

  reset(): void { this.low = 0; this.high = 1; this.warm = 0 }
  get range(): { low: number; high: number } { return { low: this.low, high: this.high } }
}

/** A one-pole envelope with a fast attack and a slower release, the smoothing the guide recommends (α = 1 − e^(−Δt/τ)). */
export class Envelope {
  value = 0
  step(target: number, dt: number, attackMs: number, releaseMs: number): number {
    const tau = Math.max(1, target > this.value ? attackMs : releaseMs) / 1000
    this.value += (target - this.value) * (1 - Math.exp(-dt / tau))
    // Settle exactly: an envelope that is "nearly zero" forever would leave the figure forever "nearly" deformed.
    if (target === 0 && this.value < 1e-3) this.value = 0
    return this.value
  }
  /** An event: the envelope jumps up to the hit (never down) and then releases. */
  hit(strength: number): void { this.value = Math.max(this.value, clamp(strength)) }
  reset(): void { this.value = 0 }
}

export type WireFeatureId = 'sub' | 'bass' | 'lowMid' | 'mid' | 'air' | 'flux' | 'level'
export type WireEventId = 'kick' | 'snare' | 'hat'
export type WireSourceId = WireFeatureId | WireEventId
/** What a rule moves. Values are physical and bounded: fractions of the cube's edge, or radians for rotation. */
export type WireTarget = 'cubeScale' | 'expand' | 'rotation' | 'shear' | 'wobble' | 'beamWidth' | 'brightness'
export type WireCurve = 'linear' | 'smoothstep' | 'power'
export type WireMissing = 'neutral' | 'hold' | 'disable'

export interface WireModRule {
  id: string
  source: WireSourceId
  target: WireTarget
  /** The target's value at 0 and at full drive. */
  min: number
  max: number
  attackMs: number
  releaseMs: number
  curve: WireCurve
  /** The rule does nothing while the evidence behind its source is below this confidence. */
  minConfidence: number
  missing: WireMissing
  /** Events release on their own short clock; continuous features use the user's attack and release. */
  userTimed: boolean
}

const DEG = Math.PI / 180

/** The driver table: which feature moves which part of the drawing, and by how much at the most. */
export const WIRE_MOD_RULES: readonly WireModRule[] = Object.freeze([
  { id: 'kick-expand', source: 'kick', target: 'expand', min: 0, max: .05, attackMs: 4, releaseMs: 130, curve: 'linear', minConfidence: .2, missing: 'neutral', userTimed: false },
  { id: 'kick-beam', source: 'kick', target: 'beamWidth', min: 0, max: .55, attackMs: 4, releaseMs: 130, curve: 'linear', minConfidence: .2, missing: 'neutral', userTimed: false },
  { id: 'snare-light', source: 'snare', target: 'brightness', min: 0, max: .6, attackMs: 4, releaseMs: 140, curve: 'linear', minConfidence: .2, missing: 'neutral', userTimed: false },
  { id: 'bass-scale', source: 'bass', target: 'cubeScale', min: 0, max: .08, attackMs: 45, releaseMs: 240, curve: 'smoothstep', minConfidence: 0, missing: 'neutral', userTimed: true },
  { id: 'sub-scale', source: 'sub', target: 'cubeScale', min: 0, max: .03, attackMs: 60, releaseMs: 320, curve: 'smoothstep', minConfidence: 0, missing: 'neutral', userTimed: true },
  { id: 'mid-turn', source: 'mid', target: 'rotation', min: 0, max: 10 * DEG, attackMs: 90, releaseMs: 360, curve: 'smoothstep', minConfidence: 0, missing: 'neutral', userTimed: true },
  { id: 'lowmid-shear', source: 'lowMid', target: 'shear', min: 0, max: .08, attackMs: 70, releaseMs: 300, curve: 'smoothstep', minConfidence: 0, missing: 'neutral', userTimed: true },
  { id: 'air-wobble', source: 'air', target: 'wobble', min: 0, max: .03, attackMs: 30, releaseMs: 220, curve: 'power', minConfidence: 0, missing: 'neutral', userTimed: true },
  { id: 'flux-wobble', source: 'flux', target: 'wobble', min: 0, max: .015, attackMs: 25, releaseMs: 180, curve: 'power', minConfidence: .3, missing: 'neutral', userTimed: true },
] satisfies readonly WireModRule[])

export type WireTargets = Record<WireTarget, number>
export const NO_TARGETS: Readonly<WireTargets> = Object.freeze({ cubeScale: 0, expand: 0, rotation: 0, shear: 0, wobble: 0, beamWidth: 0, brightness: 0 })

/** What the drawing hears this frame. `available` says which features are real measurements; `hits` are this frame's events (0 when none). */
export interface WireReading {
  features: Readonly<Record<WireFeatureId, number>>
  available: Readonly<Record<WireFeatureId, boolean>>
  hits: Readonly<Record<WireEventId, number>>
  /** Confidence in the rhythm events and the features, 0..1. */
  confidence: number
  playing: boolean
}

export function silentReading(): WireReading {
  return {
    features: { sub: 0, bass: 0, lowMid: 0, mid: 0, air: 0, flux: 0, level: 0 },
    available: { sub: false, bass: false, lowMid: false, mid: false, air: false, flux: false, level: false },
    hits: { kick: 0, snare: 0, hat: 0 },
    confidence: 0, playing: false,
  }
}

export interface WireModSettings {
  /** Audio Reactivity: zero switches every rule off. */
  reactivity: number
  attackMs: number
  releaseMs: number
  /** Per-source strength multipliers from the React group (1 = the rule's own range). */
  response: Readonly<Partial<Record<WireSourceId, number>>>
}

function shape(curve: WireCurve, z: number): number {
  if (curve === 'smoothstep') return z * z * (3 - 2 * z)
  if (curve === 'power') return z * z
  return z
}

/** The feature gate: below this level the track is treated as silent, so the normalisers hold their estimates and the figure settles. */
const SILENCE = .02

export class WireModMatrix {
  private readonly normalizers = new Map<WireFeatureId, SourceRelativeNormalizer>()
  private readonly envelopes = new Map<string, Envelope>()
  private readonly last = new Map<string, number>()
  /** The 0..1 drive of each feature after normalisation, for the inspector. */
  readonly drive: Partial<Record<WireSourceId, number>> = {}

  constructor(private readonly rules: readonly WireModRule[] = WIRE_MOD_RULES) {}

  reset(): void {
    for (const n of this.normalizers.values()) n.reset()
    for (const e of this.envelopes.values()) e.reset()
    this.last.clear()
    for (const key of Object.keys(this.drive)) delete this.drive[key as WireSourceId]
  }

  /** Resolves every rule into target values for this frame. Each target is the sum of its rules, clamped to the largest `max` among them. */
  resolve(reading: WireReading, dt: number, settings: WireModSettings, out: WireTargets = { ...NO_TARGETS }): WireTargets {
    for (const key of Object.keys(out) as WireTarget[]) out[key] = 0
    const silent = !reading.playing || reading.features.level < SILENCE
    const ceiling: Partial<Record<WireTarget, number>> = {}
    for (const rule of this.rules) {
      const response = settings.response[rule.source] ?? 1
      let z = 0
      const isEvent = rule.source === 'kick' || rule.source === 'snare' || rule.source === 'hat'
      const available = isEvent ? reading.playing : reading.available[rule.source as WireFeatureId]
      const enough = reading.confidence >= rule.minConfidence
      let active = reading.playing && settings.reactivity > 0 && response > 0
      let hold = false
      if (!available || !enough) {
        if (rule.missing === 'disable') continue
        if (rule.missing === 'hold') hold = true
        else active = false
      }
      const envelope = this.envelopes.get(rule.id) ?? this.envelopes.set(rule.id, new Envelope()).get(rule.id)!
      if (hold) z = this.last.get(rule.id) ?? 0
      else if (isEvent) {
        const strength = reading.hits[rule.source as WireEventId]
        if (active && strength > 0) envelope.hit(strength * Math.min(1, settings.reactivity))
        z = envelope.step(0, dt, rule.attackMs, rule.releaseMs)
      } else {
        const id = rule.source as WireFeatureId
        const normalizer = this.normalizers.get(id) ?? this.normalizers.set(id, new SourceRelativeNormalizer()).get(id)!
        // A feature that is not a real measurement must not pull the track-relative range toward zero.
        const normalised = available ? normalizer.update(reading.features[id], silent) : 0
        this.drive[id] = normalised
        const target = active ? normalised * Math.min(1, settings.reactivity) : 0
        z = envelope.step(target, dt, rule.userTimed ? settings.attackMs : rule.attackMs, rule.userTimed ? settings.releaseMs : rule.releaseMs)
      }
      this.last.set(rule.id, z)
      if (isEvent) this.drive[rule.source] = z
      const amount = rule.min + (rule.max * response - rule.min) * shape(rule.curve, clamp(z))
      out[rule.target] += amount
      ceiling[rule.target] = Math.max(ceiling[rule.target] ?? 0, rule.max * Math.max(1, response))
    }
    for (const key of Object.keys(out) as WireTarget[]) out[key] = Math.min(out[key], ceiling[key] ?? 0)
    return out
  }
}
