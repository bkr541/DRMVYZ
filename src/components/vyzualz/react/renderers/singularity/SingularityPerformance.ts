import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import { resolveSharedPerformanceTransportTransition } from '../../../../../features/performanceCore/transport'
import { resolveMutagenMusicalEvents, resolveMutagenTriggerEventIdentity } from '../mutagen/MutagenPerformanceController'
import { SINGULARITY_PATTERNS, type CanvasSingularitySettings } from './SingularitySettings'
const clamp = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0))
const qualified = (c: SharedPerformanceContext | null): c is SharedPerformanceContext => Boolean(c?.capabilities.sections && Math.max(c.sectionConfidence, c.confidence.section) > .15)
function autoPattern(c: SharedPerformanceContext): CanvasSingularitySettings['pattern'] {
  const section = c.sectionType ?? c.macroSectionType
  if (section === 'intro' || section === 'outro') return 'origin'
  if (section === 'breakdown') return 'rebirth'
  if (section === 'preDrop') return 'event horizon'
  if (section === 'build') return c.buildProgress > .65 ? 'corruption' : 'gravity'
  if (section === 'drop') return (['supernova', 'resonance', 'polarity', 'signal lost'] as const)[Math.max(0, c.performanceFourBarBlockIndex + Math.max(0, c.dropOccurrence - 1)) % 4]
  return 'undertow'
}
// Distinct source, environmental and interference envelopes, not palette variations.
const profiles = [
  [.36, .12, .55, .25], [.55, .12, .9, -.65], [.85, .32, .65, -1], [.24, .95, .45, .25], [.75, .45, 1.25, 1],
  [.42, .1, 1, .45], [.28, .25, .85, .8], [.62, .9, 1.15, .2], [.45, .35, 1, -.3], [.65, .18, .6, -.45],
] as const
export class SingularityPerformance {
  private previous: SharedPerformanceContext | null = null
  private lastTime: number | null = null
  private settings: CanvasSingularitySettings | null = null
  private pattern: CanvasSingularitySettings['pattern'] = 'origin'
  private trigger: string | null = null
  private motion = 0
  private age = 0
  private hit = 0
  private accent = 0
  private energy = 0
  private paused = false
  private active = false
  reset() { this.previous = null; this.lastTime = null; this.settings = null; this.trigger = null; this.motion = this.age = this.hit = this.accent = this.energy = 0 }
  update(s: CanvasSingularitySettings, c: SharedPerformanceContext | null, time: number, delta: number, paused: boolean, audioActive: boolean) {
    const fresh = c !== this.previous
    const transition = fresh && c ? resolveSharedPerformanceTransportTransition(this.previous, c) : null
    const reset = this.lastTime === null || time < this.lastTime - .00001 || time - this.lastTime > .5 || Boolean(fresh && c && (c.boundaries.timingDiscontinuity || c.seekDetected || c.loopWrapDetected || c.trackReplacementDetected || transition?.timingDiscontinuity || transition?.seekDetected || transition?.loopWrapDetected || transition?.trackReplacementDetected))
    const old = this.settings
    const changed = !old || old.pattern !== s.pattern || old.patternChange !== s.patternChange || old.autoPerformance !== s.autoPerformance || old.trigger !== s.trigger || old.seed !== s.seed
    if (reset) this.reset()
    const dt = paused ? 0 : Math.max(0, Math.min(.1, delta))
    const response = audioActive && c ? s.audioReactivity : 0
    const enabled = fresh && !reset && !changed && !paused && !this.paused && this.active === audioActive && response > 0
    const events = resolveMutagenMusicalEvents(c, this.previous, enabled)
    const prior = this.pattern
    if (reset || changed || this.active !== audioActive) { this.pattern = s.pattern; this.trigger = null }
    if (s.patternChange) {
      const id = resolveMutagenTriggerEventIdentity(c, this.previous, s.trigger, enabled)
      if (id && id !== this.trigger) { this.pattern = SINGULARITY_PATTERNS[(SINGULARITY_PATTERNS.indexOf(this.pattern) + 1) % SINGULARITY_PATTERNS.length]; this.trigger = id }
    } else if (!paused || reset || changed) this.pattern = s.autoPerformance && response > 0 && qualified(c) ? autoPattern(c) : s.pattern
    if (prior !== this.pattern || changed) this.age = 0
    const bands = c?.capabilities.liveBands && c.confidence.overall > .05
    const target = response * clamp((bands && c ? c.bass * .65 + c.high * .13 : 0) + (qualified(c) ? c.buildProgress * .35 : 0))
    this.energy += (target - this.energy) * (1 - Math.exp(-dt * 7))
    this.hit *= Math.exp(-dt * (2 + 7 * s.recovery)); this.accent *= Math.exp(-dt * 8)
    if (!response) this.hit = this.accent = this.energy = 0
    if (events.kick && c) this.hit = Math.max(this.hit, clamp(c.kickStrength))
    if (events.drop) this.hit = 1
    if ((events.snare || events.transient) && c) this.accent = Math.max(this.accent, clamp(Math.max(c.snareStrength, c.transient)))
    const pattern = SINGULARITY_PATTERNS.indexOf(this.pattern), p = profiles[pattern]
    this.motion += dt * s.speed * 2 * p[2] * (1 + this.energy * .6); this.age += dt
    const pulse = Math.pow(.5 + .5 * Math.sin(this.age * (1 + s.recovery) * (pattern === 3 || pattern === 7 ? 2.3 : .85) - 1.57), 3)
    const hit = clamp(this.hit * response * s.impactStrength)
    let dissolve = clamp((pulse * p[0] + hit * .75 + this.energy * .2) * (1 - s.identity) * 1.45)
    let glitch = clamp((pulse * p[1] + this.accent * response + hit * .2) * s.glitch)
    // Dissolve out across the final beat and reconstruct the next pool item on
    // the opening beat; the shell owns source selection and media permissions.
    if (s.sourceMode === 'pool' && response > 0 && c?.capabilities.beatGrid && c.confidence.grid > .15) {
      const phase = clamp(c.fourBarProgress)
      const handoff = Math.max(clamp((phase - .92) / .08), c.performanceFourBarBlockIndex > 0 ? clamp(1 - phase / .08) : 0)
      dissolve = Math.max(dissolve, handoff * (1 - s.identity))
      glitch = Math.max(glitch, handoff * s.glitch * .7)
    }
    this.previous = c; this.lastTime = time; this.settings = s; this.paused = paused; this.active = audioActive
    return { motion: this.motion, age: this.age, pattern, dissolve, glitch, hit, energy: this.energy, accent: this.accent * response, force: p[3], paused, reset }
  }
}
export type SingularityFrame = ReturnType<SingularityPerformance['update']>
