import { resolveSharedPerformanceTransportTransition, smoothSharedPerformanceModulation, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { CanvasDataBleedSettings } from './DataBleedSettings'
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
type SmoothState = { value: number; initialized: boolean }
export interface DataBleedRouting { kick: number; tear: number; detail: number; edge: number }
export interface DataBleedDecision {
  settings: CanvasDataBleedSettings
  routing: DataBleedRouting
  motionTimeSec: number
  reset: boolean
  positionReset: boolean
  events: { kick: string | null; snare: string | null; drop: string | null }
}
/** Owns only Data Bleed envelopes and motion phase. No store or analyzer writes. */
export class DataBleedPerformanceController {
  private previous: SharedPerformanceContext | null = null
  private lastTime: number | null = null
  private lastClock = 0
  private phase = 0
  private held = false
  private active: boolean | null = null
  private seed: number | null = null
  private smooth: Record<string, SmoothState> = {}
  private kickAt = -Infinity
  private tearAt = -Infinity
  private dropAt = -Infinity
  private kickStrength = 0
  private tearStrength = 0
  private seen = { kick: '', snare: '', drop: '' }
  private resolved: CanvasDataBleedSettings | null = null
  private routing: DataBleedRouting = { kick: 0, tear: 0, detail: 0, edge: 0 }
  reset() {
    this.previous = null; this.lastTime = null; this.seed = null; this.active = null
    this.smooth = {}; this.seen = { kick: '', snare: '', drop: '' }
    this.kickAt = this.tearAt = this.dropAt = -Infinity
    this.routing = { kick: 0, tear: 0, detail: 0, edge: 0 }; this.resolved = null
  }
  update(input: { settings: CanvasDataBleedSettings; context: SharedPerformanceContext | null; timeSec: number; deltaSec: number; paused: boolean; audioActive: boolean }): DataBleedDecision {
    const { settings: s, context: c, timeSec: time } = input
    const first = this.lastTime === null, held = input.paused || s.freezeHistory
    const newContext = c !== this.previous
    const transport = newContext && c ? resolveSharedPerformanceTransportTransition(this.previous, c) : null
    const positionReset = first || s.deterministicSeed !== this.seed || Boolean(newContext && c && (c.seekDetected || c.loopWrapDetected || c.trackReplacementDetected || c.boundaries.timingDiscontinuity || transport?.timingDiscontinuity || transport?.seekDetected || transport?.loopWrapDetected || transport?.trackReplacementDetected))
      || (this.lastTime !== null && (time < this.lastTime || time - this.lastTime > 0.5 || (input.paused && Math.abs(time - this.lastTime) > 1e-5)))
    const reset = positionReset || this.held !== held || this.active !== input.audioActive
    if (reset) {
      this.smooth = {}; this.seen = { kick: '', snare: '', drop: '' }
      this.kickAt = this.tearAt = this.dropAt = -Infinity
      this.routing = { kick: 0, tear: 0, detail: 0, edge: 0 }
    }
    const clock = s.bpmSync && input.audioActive && c?.capabilities.beatGrid && c.confidence.grid > 0.15 && c.bpm > 0
      ? c.absoluteBeat * 0.5 + (time - c.audioTimeSec) * clamp(c.bpm / 120, 0.5, 2) : time
    if (positionReset) this.phase = clock
    if (reset) this.lastClock = clock
    const events: DataBleedDecision['events'] = { kick: null, snare: null, drop: null }
    const response = input.audioActive && c ? s.audioReactivity : 0
    const sectionReady = Boolean(c?.capabilities.sections && Math.max(c.sectionConfidence, c.confidence.section) > 0.15)
    const eventReady = response > 0 && !held && !reset && newContext
    const event = (key: keyof typeof events, valid: boolean, identity: string) => {
      if (eventReady && valid && this.seen[key] !== identity) { this.seen[key] = identity; events[key] = identity }
    }
    if (c) {
      const base = `${c.runtimeIdentity}:${c.intelligence.frame.frameId}:${Math.round(c.audioTimeSec * 1000)}`
      const rhythm = c.capabilities.rhythmEvents && c.confidence.rhythm > 0.15
      event('kick', rhythm && c.kick && !this.previous?.kick, `${base}:kick`)
      event('snare', (rhythm && c.snare && !this.previous?.snare) || (rhythm && c.transientConfidence > 0.15 && c.transient > 0.55 && (this.previous?.transient ?? 0) <= 0.55), `${base}:snare`)
      event('drop', Boolean((sectionReady && c.sectionType === 'drop' && c.boundaries.sectionEntry) || (c.confidence.semantics > 0.15 && c.dropImpact > 0.55 && (this.previous?.dropImpact ?? 0) <= 0.55)), `${c.runtimeIdentity}:drop:${c.sectionId}:${c.dropOccurrence}:${c.boundaries.sectionEntry ? 'entry' : `${c.intelligence.frame.frameId}:${Math.round(time * 1000)}`}`)
      if (events.kick) { this.kickAt = time; this.kickStrength = clamp(c.kickStrength) }
      if (events.snare) { this.tearAt = time; this.tearStrength = clamp(Math.max(c.snareStrength, c.transient)) }
      if (events.drop) this.dropAt = time
    }
    if (!held || positionReset || !this.resolved) {
      const dt = clamp(input.deltaSec, 0, 0.1)
      const smooth = (key: string, target: number, attack = 0.1, release = 0.35) => smoothSharedPerformanceModulation(this.smooth[key] ??= { value: 0, initialized: false }, target, dt, attack, release)
      const bands = c?.capabilities.liveBands && c.confidence.overall > 0.05
      const bass = smooth('bass', bands && c ? clamp(c.bass * 0.7 + c.intelligence.bands.normalized.normalizedSub * 0.3) * response : 0)
      const mid = smooth('mid', bands && c ? clamp(c.mid) * response : 0)
      const high = smooth('high', bands && c ? clamp(c.high) * response : 0)
      const section = sectionReady && c ? c.sectionType : null
      const build = smooth('build', sectionReady && c ? clamp(Math.max(c.buildProgress, section === 'build' ? c.sectionProgress : 0)) * response : 0)
      const reconstruction = smooth('reconstruction', section === 'intro' ? 0.55 * response : section === 'breakdown' || section === 'outro' ? (0.3 + 0.65 * clamp(c?.sectionProgress ?? 0)) * response : 0, 0.6, 0.08)
      const pulse = (at: number, seconds: number) => Math.exp(-Math.max(0, time - at) / seconds)
      const drop = pulse(this.dropAt, 0.65) * response
      const kick = pulse(this.kickAt, 0.18) * this.kickStrength * response + drop * 0.6
      const tear = pulse(this.tearAt, 0.24) * this.tearStrength * response + drop * 0.25
      const autoGain = s.autoPerformance && sectionReady ? section === 'verse' ? 0.8 : section === 'drop' ? 1.2 + Math.min(0.15, Math.max(0, (c?.dropOccurrence ?? 1) - 1) * 0.1) : 1 : 1
      const gain = 1 + (autoGain - 1) * response + bass * 0.4 + build * 0.45 + kick * 0.25
      this.resolved = { ...s, amount: clamp(s.amount * gain), flowSpeed: clamp(s.flowSpeed * (1 + bass * 0.8 + build * 0.35), 0, 4),
        sourceMix: 1 - (1 - s.sourceMix) * (1 - reconstruction), sourceRefresh: clamp(s.sourceRefresh + kick * 0.3 + drop * 0.2) }
      this.routing = { kick: clamp(kick), tear: clamp(tear), detail: mid, edge: high * 0.35 }
      if (response === 0) { this.resolved = { ...s }; this.routing = { kick: 0, tear: 0, detail: 0, edge: 0 } }
      if (!held) this.phase += clamp(clock - this.lastClock, 0, 0.25) * (1 + bass * 0.6)
    }
    this.previous = c; this.lastTime = time; this.lastClock = clock
    this.held = held; this.seed = s.deterministicSeed; this.active = input.audioActive
    return { settings: this.resolved!, routing: { ...this.routing }, motionTimeSec: this.phase, reset, positionReset, events }
  }
}
