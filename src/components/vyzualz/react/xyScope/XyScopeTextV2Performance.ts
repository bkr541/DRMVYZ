import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import { TEXT_V2_STYLES, textV2Unit as unit, type TextV2Style, type XyScopeTextV2Settings } from './XyScopeTextV2Settings'

/** Hidden controls are effective runtime values, never writes into manual settings. */
export interface TextV2Controls {
  deflection: number
  strokeProtection: number
  accentFolds: number
  attackMs: number
  dampingMs: number
  transientSensitivity: number
  departure: number
  reformMs: number
  protectedPasses: number
  transientReadability: number
  angle: number
  stereoCoupling: number
  xScale: number
  yScale: number
  crossModulation: number
  waveformDetail: number
  intensity: number
  trailMs: number
  widthPx: number
  scanHz: number
  channelDepth: number
  channelOffset: number
  audioFocus: number
  colorMix: number
}
export const TEXT_V2_MANUAL_CONTROLS: Readonly<TextV2Controls> = Object.freeze({
  deflection: .7, strokeProtection: .84, accentFolds: .65, attackMs: 10, dampingMs: 120,
  transientSensitivity: .7, departure: .4, reformMs: 190, protectedPasses: .76, transientReadability: .85,
  angle: 35 * Math.PI / 180, stereoCoupling: .65, xScale: 1, yScale: 1,
  crossModulation: .4, waveformDetail: .65, intensity: .9, trailMs: 72, widthPx: 1.05,
  scanHz: 90, channelDepth: 1, channelOffset: 0, audioFocus: .75, colorMix: 0,
})
export interface TextV2PerformanceFrame {
  controls: TextV2Controls
  weights: Float32Array
  style: TextV2Style
  state: 'Rest' | 'Contour' | 'Groove' | 'Build' | 'Impact' | 'Release'
  level: number
  bass: number
  mid: number
  high: number
  impact: number
  amount: number
  phase: number
  scanPhase: number
  wordEventId: string | null
  variation: number
}
interface Observation {
  track: string | null
  section: string
  phrase: number
  drop: number
  bar: number
}

/** Uses evidence changes, not elapsed seconds or a fixed bar count, to choose new words. */
export class XyScopeTextV2Performance {
  private previous: Observation | null = null
  private energyAnchor = 0
  private controls: TextV2Controls = { ...TEXT_V2_MANUAL_CONTROLS }
  private weights = new Float32Array([1, 0, 0, 0, 0])
  private style: TextV2Style = 'contour'
  private level = 0
  private bass = 0
  private mid = 0
  private high = 0
  private impact = 0
  private amount = 0
  private phase = 0
  private scanPhase = 0
  private variation = 0
  private initialized = false

  reset(): void {
    this.previous = null; this.energyAnchor = 0; this.controls = { ...TEXT_V2_MANUAL_CONTROLS }
    this.weights.set([1, 0, 0, 0, 0]); this.style = 'contour'; this.initialized = false
    this.level = 0; this.bass = 0; this.mid = 0; this.high = 0; this.impact = 0
    this.amount = 0; this.phase = 0; this.scanPhase = 0; this.variation = 0
  }

  update(settings: XyScopeTextV2Settings, context: SharedPerformanceContext | null, fresh: boolean, playing: boolean, dt: number, signalLevel: number): TextV2PerformanceFrame {
    const discontinuity = context && (context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected)
    if (fresh && (discontinuity || (this.previous && context?.trackIdentity !== this.previous.track))) this.reset()
    const c = context
    const rawLevel = playing ? Math.max(unit(c?.energy ?? 0), unit(signalLevel)) : 0
    const smooth = (current: number, target: number, ms: number) => current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * 1000 / Math.max(1, ms)))
    this.level = smooth(this.level, rawLevel, rawLevel > this.level ? this.controls.attackMs : this.controls.dampingMs)
    this.bass = smooth(this.bass, playing ? unit(c?.bass ?? rawLevel * .65) : 0, 65)
    this.mid = smooth(this.mid, playing ? unit(c?.mid ?? rawLevel * .5) : 0, 90)
    this.high = smooth(this.high, playing ? unit(c?.high ?? rawLevel * .25) : 0, 45)
    const hit = fresh && playing && c ? Math.max(c.kick ? unit(c.kickStrength) : 0, c.snare ? unit(c.snareStrength) * .85 : 0, unit(c.transient) * unit(c.transientConfidence)) : 0
    this.impact = Math.max(this.impact * Math.exp(-dt * 1000 / this.controls.reformMs), hit * this.controls.transientSensitivity)

    let event: string | null = null
    if (fresh && c) {
      const previous = this.previous
      if (playing && previous && !discontinuity) {
        if (c.sectionIdentity !== previous.section && c.sectionConfidence >= .45) event = `section:${c.sectionIdentity}`
        else if (c.dropOccurrence !== previous.drop && (c.dropImpact > .2 || c.energy > .45)) event = `drop:${c.dropOccurrence}`
        else if (c.phraseIndex !== previous.phrase && c.confidence.phrase >= .35) event = `phrase:${c.phraseIndex}`
        else if (c.boundaries.barBoundary && c.barIndex !== previous.bar && c.spectralFlux > .3 && Math.abs(c.energy - this.energyAnchor) > .2 && c.confidence.rhythm >= .4) event = `energy:${c.barIndex}`
      }
      // Observe paused frames too: a stale event must not fire on resume.
      this.previous = { track: c.trackIdentity, section: c.sectionIdentity, phrase: c.phraseIndex, drop: c.dropOccurrence, bar: c.barIndex }
      if (!previous || event) this.energyAnchor = unit(c.energy)
    }
    const build = playing ? Math.max(unit(c?.buildProgress ?? 0), unit(c?.tension ?? 0) * Math.max(0, c?.energyTrend ?? 0)) : 0
    const release = playing && (c?.energyTrend ?? 0) < -.1
    const state: TextV2PerformanceFrame['state'] = this.level < .015 && this.impact < .015 ? 'Rest'
      : this.impact > .38 || (playing && (c?.dropImpact ?? 0) > .6) ? 'Impact'
      : build > .3 ? 'Build' : release ? 'Release' : this.bass > .35 ? 'Groove' : 'Contour'

    if (!settings.autoPerformance) this.style = settings.manualStyle
    else if (!this.initialized || event) {
      this.style = state === 'Impact' ? 'impact' : state === 'Build' ? 'harmonic' : state === 'Release' ? 'reform'
        : this.high > this.mid * 1.25 ? 'stereo' : this.mid > this.bass * 1.1 ? 'harmonic' : this.bass > .3 ? 'stereo' : 'contour'
      this.initialized = true
    }
    if (event) this.variation += 1
    const styleIndex = TEXT_V2_STYLES.findIndex(s => s.value === this.style)
    for (let i = 0; i < this.weights.length; i++) this.weights[i] = smooth(this.weights[i], i === styleIndex ? 1 : 0, 280)

    const target: TextV2Controls = settings.autoPerformance ? {
      deflection: .25 + this.level * .55 + build * .2,
      strokeProtection: .9 - unit(this.level + build) * .18,
      accentFolds: .18 + this.mid * .5 + this.impact * .3,
      attackMs: 8 + (1 - this.high) * 42,
      dampingMs: 75 + (1 - this.high) * 130,
      transientSensitivity: .45 + this.high * .35 + build * .2,
      departure: .12 + this.level * .35 + this.impact * .3 + build * .2,
      reformMs: 120 + (1 - this.impact) * 190 + build * 100,
      protectedPasses: .82 - build * .16 - this.impact * .1,
      transientReadability: .9 - this.impact * .16,
      angle: (.2 + this.mid * .8 + build * .35),
      stereoCoupling: .3 + this.high * .45 + this.mid * .2,
      xScale: .97 + this.bass * .06,
      yScale: .96 + this.mid * .08,
      crossModulation: .15 + this.mid * .45 + build * .3,
      waveformDetail: .22 + this.high * .65,
      intensity: .65 + this.level * .38 + this.impact * .2,
      trailMs: 45 + this.mid * 80 + build * 45,
      widthPx: .85 + this.bass * .45 + this.impact * .2,
      scanHz: 65 + this.high * 55 + build * 20,
      channelDepth: .65 + this.mid * .5 + this.impact * .25,
      channelOffset: this.variation * .37 + this.mid * .35,
      audioFocus: .35 + this.high * .5,
      colorMix: styleIndex / 4 * (.25 + this.level * .5),
    } : { ...TEXT_V2_MANUAL_CONTROLS }
    // Every hidden control shares bounded attack/release, including when Auto is disabled.
    for (const key of Object.keys(target) as (keyof TextV2Controls)[]) this.controls[key] = smooth(this.controls[key], target[key], 240)
    const desiredAmount = playing ? unit(rawLevel * 1.8 + this.impact) * settings.response : 0
    this.amount = smooth(this.amount, desiredAmount, playing ? this.controls.attackMs : this.controls.reformMs)
    if (playing) {
      this.phase += dt * (.5 + this.mid * 2 + this.bass) * this.amount
      this.scanPhase = (this.scanPhase + dt * this.controls.scanHz) % 1
    }
    return { controls: this.controls, weights: this.weights, style: this.style, state, level: this.level, bass: this.bass, mid: this.mid, high: this.high,
      impact: this.impact, amount: this.amount, phase: this.phase, scanPhase: this.scanPhase, wordEventId: event, variation: this.variation }
  }
}

/** Stable selection from an evidence identity; no timer and no immediate repeat. */
export function selectTextV2Word(words: readonly string[], current: string, eventId: string, seed: number): string {
  const options = words.filter(word => word !== current)
  if (!options.length) return current
  let hash = seed | 0
  for (let i = 0; i < eventId.length; i++) hash = Math.imul(hash ^ eventId.charCodeAt(i), 16777619)
  return options[(hash >>> 0) % options.length]
}
