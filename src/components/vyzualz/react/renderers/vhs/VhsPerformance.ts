import { resolveSharedPerformanceTransportTransition, smoothSharedPerformanceModulation, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { CanvasVhsSettings } from './VhsSettings'

const clamp = (n: number) => Math.max(0, Math.min(1, n))

export class VhsPerformance {
  private previous: SharedPerformanceContext | null = null
  private lastTime: number | null = null
  private wasPaused = false
  private kick = 0
  private loss = 0
  private impact = 0
  private bass = { initialized: false, value: 0 }
  private build = { initialized: false, value: 0 }
  private detail = { initialized: false, value: 0 }
  private recovery = { initialized: false, value: 0 }

  reset() {
    this.previous = null
    this.lastTime = null
    this.kick = this.loss = this.impact = 0
    this.bass.initialized = this.build.initialized = this.detail.initialized = this.recovery.initialized = false
  }

  update(settings: CanvasVhsSettings, context: SharedPerformanceContext | null, time: number, delta: number, paused: boolean, audioActive: boolean) {
    const fresh = context !== this.previous
    const transport = fresh && context ? resolveSharedPerformanceTransportTransition(this.previous, context) : null
    const elapsed = this.lastTime === null ? 0 : time - this.lastTime
    const resetHistory = this.lastTime === null || elapsed < -0.00001 || elapsed > 0.5 || (paused && Math.abs(elapsed) > 0.00001)
      || Boolean(fresh && context?.boundaries.timingDiscontinuity) || Boolean(transport?.timingDiscontinuity
        || transport?.seekDetected || transport?.loopWrapDetected || transport?.trackReplacementDetected)
    if (resetHistory) this.reset()
    const dt = paused ? 0 : Math.max(0, Math.min(delta, 0.1))
    const response = audioActive && context ? settings.audioReactivity : 0
    const bands = context?.capabilities.liveBands && context.confidence.overall > 0.05
    const sections = context?.capabilities.sections && context.sectionConfidence > 0.15
    const rhythm = context?.capabilities.rhythmEvents && context.confidence.rhythm > 0.15
    const bassInput = bands ? clamp(0.68 * context.bass + 0.32 * context.intelligence.bands.normalized.normalizedSub) : 0
    const bass = smoothSharedPerformanceModulation(this.bass, bassInput, dt, 0.09, 0.30) * response
    const build = smoothSharedPerformanceModulation(this.build, sections ? clamp(context.buildProgress) : 0, dt, 0.22, 0.4) * response
    const detail = smoothSharedPerformanceModulation(this.detail, bands ? clamp(0.55 * context.mid + 0.45 * context.high) : 0, dt, 0.13, 0.3) * response
    const section = settings.autoPerformance && sections ? context.sectionType : null
    const calm = section === 'breakdown' || section === 'outro' ? 0.78 : section === 'intro' ? 0.34 : 0
    const recovery = smoothSharedPerformanceModulation(this.recovery, calm, dt, 0.4, 0.32) * response

    this.kick *= Math.exp(-dt * 7)
    this.loss *= Math.exp(-dt * 8)
    this.impact *= Math.exp(-dt * 3.6)
    if (fresh && !paused && !this.wasPaused && context && this.previous && response > 0) {
      if (rhythm && context.kick && !this.previous.kick) this.kick = Math.max(this.kick, clamp(context.kickStrength))
      if (rhythm && ((context.snare && !this.previous.snare)
        || (context.transientConfidence > 0.15 && context.transient > 0.55 && this.previous.transient <= 0.55))) {
        this.loss = Math.max(this.loss, clamp(Math.max(context.snareStrength, context.transient)))
      }
      if ((sections && context.sectionType === 'drop' && context.boundaries.sectionEntry && context.sectionId !== this.previous.sectionId)
        || (context.confidence.semantics > 0.15 && context.dropImpact > 0.55 && this.previous.dropImpact <= 0.55)) {
        this.impact = 1
        this.loss = Math.max(this.loss, 0.55)
      }
    }
    this.previous = context
    this.lastTime = time
    this.wasPaused = paused
    const grid = audioActive && context?.capabilities.beatGrid && context.confidence.grid > 0.15
    const clock = settings.bpmSync && grid ? context.absoluteBeat * 0.5 : time
    const hit = response * this.kick
    const drop = response * this.impact
    const amount = settings.amount * (1 - settings.sourceMix) * (1 - recovery)
    return {
      paused, resetHistory, dt, amount,
      phase: (clock * settings.speed) % 4096,
      damage: clamp(settings.damage * (1 + 0.55 * build + 0.65 * drop)),
      tracking: clamp(settings.tracking * (1 + 0.70 * bass + 0.95 * hit + 0.65 * drop)),
      roll: clamp(settings.roll * (1 + 0.55 * bass + 0.50 * drop)),
      dropout: clamp(settings.dropout * (1 + 1.4 * response * this.loss + 0.75 * drop)),
      texture: detail,
      glow: clamp(hit * 0.34 + drop * 0.24),
      persistence: Math.min(0.85, settings.persistence * amount * (1 + 0.55 * bass + 0.32 * hit) * (1 - recovery)),
    }
  }
}
export type VhsFrame = ReturnType<VhsPerformance['update']>
