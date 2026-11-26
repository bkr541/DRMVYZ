import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import { resolveSharedPerformanceTransportTransition } from '../../../../../features/performanceCore/transport'
import { smoothSharedPerformanceModulation } from '../../../../../features/performanceCore/envelopes'
import { resolveMutagenMusicalEvents, resolveMutagenTriggerEventIdentity, resolveMutagenMotionPosition } from '../mutagen/MutagenPerformanceController'
import { MORPH_MODES, MORPH_PATTERNS, type CanvasMorphSettings } from './MorphSettings'
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
export type MorphPattern = CanvasMorphSettings['pattern']
// Each pattern has separate motion, intensity, recovery and feedback behavior.
export const MORPH_PATTERN_PROFILES = {
  impact: { base: .32, energy: .65, hit: 1.45, speed: 1, trail: .8, restore: 0 },
  undertow: { base: .78, energy: .35, hit: .25, speed: .72, trail: 1, restore: 0 },
  rebirth: { base: .45, energy: .35, hit: 1.2, speed: .85, trail: .55, restore: .6 },
  overload: { base: .82, energy: .85, hit: .7, speed: 1.35, trail: 1.1, restore: 0 },
  descent: { base: .68, energy: .52, hit: .55, speed: 1.15, trail: .8, restore: 0 },
  fractured: { base: .5, energy: .35, hit: .85, speed: .95, trail: .45, restore: .12 },
  breathing: { base: .24, energy: .17, hit: .25, speed: .45, trail: .25, restore: .45 },
  metamorphosis: { base: .68, energy: .5, hit: .75, speed: 1, trail: .7, restore: 0 },
} satisfies Record<MorphPattern, {base:number;energy:number;hit:number;speed:number;trail:number;restore:number}>
const qualified = (c: SharedPerformanceContext | null): c is SharedPerformanceContext => Boolean(c?.capabilities.sections && Math.max(c.sectionConfidence, c.confidence.section) > .15)
function autoPattern(c: SharedPerformanceContext): MorphPattern {
  const section = c.sectionType ?? c.macroSectionType
  if (section === 'intro' || section === 'outro') return 'breathing'
  if (section === 'breakdown') return 'rebirth'
  if (section === 'preDrop') return 'rebirth'
  if (section === 'build') return c.buildProgress > .65 ? 'overload' : 'undertow'
  if (section === 'drop') return (['impact', 'fractured', 'descent', 'metamorphosis'] as const)[Math.max(0, c.performanceFourBarBlockIndex + Math.max(0, c.dropOccurrence - 1)) % 4]
  return 'undertow'
}
export class MorphPerformance {
  private previous: SharedPerformanceContext | null = null
  private settings: CanvasMorphSettings | null = null
  private lastTime: number | null = null
  private lastClock: number | null = null
  private motion = 0
  private wasPaused = false
  private wasActive = false
  private impact = 0
  private snare = 0
  private pattern: MorphPattern = 'impact'
  private triggerId: string | null = null
  private mode = -1
  private fromMode = 0
  private transition = 1
  private energy = { initialized: false, value: 0 }
  private recovery = { initialized: false, value: 0 }
  reset() {
    this.previous = null; this.settings = null; this.lastTime = this.lastClock = null; this.wasPaused = false
    this.impact = this.snare = 0; this.triggerId = null; this.mode = -1; this.transition = 1
    this.energy.initialized = this.recovery.initialized = false
  }
  update(s: CanvasMorphSettings, c: SharedPerformanceContext | null, time: number, delta: number, paused: boolean, audioActive: boolean) {
    const fresh = c !== this.previous
    const transport = fresh && c ? resolveSharedPerformanceTransportTransition(this.previous, c) : null
    const elapsed = this.lastTime === null ? 0 : time - this.lastTime
    const reset = this.lastTime === null || elapsed < -0.00001 || elapsed > 0.5 || (paused && Math.abs(elapsed) > 0.00001)
      || Boolean(fresh && c && (c.boundaries.timingDiscontinuity || c.seekDetected || c.loopWrapDetected || c.trackReplacementDetected || transport?.timingDiscontinuity || transport?.seekDetected || transport?.loopWrapDetected || transport?.trackReplacementDetected))
    const old = this.settings
    if (reset) this.reset()
    const authority = s.patternChange ? 'trigger' : s.autoPerformance ? 'auto' : 'manual'
    const changed = !old || old.pattern !== s.pattern || old.patternChange !== s.patternChange || old.autoPerformance !== s.autoPerformance || old.trigger !== s.trigger || old.seed !== s.seed || old.mode !== s.mode
    const resume = this.wasPaused && !paused
    const activeChanged = audioActive !== this.wasActive
    const dt = paused ? 0 : Math.max(0, Math.min(0.1, delta))
    const response = audioActive && c ? s.audioReactivity : 0
    const eventsActive = fresh && !reset && !changed && !paused && !resume && !activeChanged && audioActive
    const events = resolveMutagenMusicalEvents(c, this.previous, eventsActive)
    if (reset || changed || activeChanged) { this.pattern = s.pattern; this.triggerId = null }
    if (!paused || reset || changed) {
      if (authority === 'manual') this.pattern = s.pattern
      else if (authority === 'auto') this.pattern = response > 0 && qualified(c) ? autoPattern(c) : s.pattern
      else if (authority === 'trigger') {
        const id = resolveMutagenTriggerEventIdentity(c, this.previous, s.trigger, eventsActive)
        if (id && id !== this.triggerId) { this.pattern = MORPH_PATTERNS[(MORPH_PATTERNS.indexOf(this.pattern) + 1) % MORPH_PATTERNS.length]; this.triggerId = id }
      }
    }
    const profile = MORPH_PATTERN_PROFILES[this.pattern]
    const bands = Boolean(c?.capabilities.liveBands && c.confidence.overall > .05)
    const grid = Boolean(audioActive && c?.capabilities.beatGrid && c.confidence.grid > .15)
    const bass = bands && c ? clamp(c.bass * .7 + c.intelligence.bands.normalized.normalizedSub * .3) : 0
    const section = qualified(c) ? c.sectionType ?? c.macroSectionType : null
    const build = qualified(c) ? clamp(c.buildProgress) : 0
    const energy = smoothSharedPerformanceModulation(this.energy, response * clamp(bass * .8 + build * .4), dt, .07, .32)
    const calm = section === 'intro' || section === 'breakdown' || section === 'outro' || section === 'preDrop'
    const recovery = smoothSharedPerformanceModulation(this.recovery, authority === 'auto' && calm ? response * .85 : 0, dt, .35, .45)
    if (response === 0 || activeChanged) this.impact = this.snare = 0
    this.impact *= Math.exp(-dt * (9 - s.recovery * 7)); this.snare *= Math.exp(-dt * 7)
    if (events.kick && c) this.impact = Math.max(this.impact, clamp(c.kickStrength))
    if ((events.snare || events.transient) && c) this.snare = Math.max(this.snare, clamp(Math.max(c.snareStrength, c.transient)))
    if (events.drop) this.impact = 1
    const hit = clamp(response * this.impact * s.impactStrength * 1.5)
    const accent = clamp(response * (this.snare + (bands && c ? .22 * c.high : 0)))
    const clock = resolveMutagenMotionPosition(c, s.bpmSync && grid, time)
    if (reset || this.lastClock === null) this.motion = clock * s.speed
    else if (!paused && !resume && !activeChanged) this.motion += Math.max(0, Math.min(.25, clock - this.lastClock)) * s.speed * profile.speed * (1 + energy * .35)
    this.lastClock = clock
    const pulse = .5 + .5 * Math.sin(this.motion * 1.8)
    const localRestore = profile.restore * (this.pattern === 'rebirth' ? (1 - hit) * pulse : .7 + pulse * .3)
    const amount = clamp(s.amount * (1 - s.sourceMix) * (1 - s.identity) * (1 - localRestore) * (1 - (response > 0 ? recovery : 0))
      * ((response === 0 && this.pattern === 'impact' ? .92 : profile.base) + (response > 0 ? energy * profile.energy : 0) + hit * profile.hit + (this.pattern === 'breathing' ? pulse * .16 : 0)))
    let mode = MORPH_MODES.indexOf(s.mode)
    // Manual mode always wins unless the user explicitly selects a mode-directing pattern.
    if (this.pattern === 'descent') mode = 2
    if (this.pattern === 'metamorphosis' && grid && c) mode = Math.max(0, c.performanceFourBarBlockIndex) % MORPH_MODES.length
    if (this.mode < 0 || reset) { this.mode = mode; this.fromMode = mode; this.transition = 1 }
    else if (mode !== this.mode && (!paused || changed)) { this.fromMode = this.mode; this.mode = mode; this.transition = s.transitionDuration === 0 || paused ? 1 : 0 }
    if (!paused) this.transition = Math.min(1, this.transition + dt / Math.max(.001, s.transitionDuration))
    this.previous = c; this.settings = s; this.lastTime = time; this.wasPaused = paused; this.wasActive = audioActive
    return { mode: this.mode, fromMode: this.fromMode, blend: this.transition, pattern: MORPH_PATTERNS.indexOf(this.pattern), amount, motion: this.motion, hit, accent, energy: response > 0 ? energy : 0, trail: profile.trail, reset: reset || Boolean(old && old.seed !== s.seed), delta: dt, paused }
  }
}
// Optional extensions keep the renderer usable in isolated GPU acceptance harnesses.
export type MorphFrame = Omit<ReturnType<MorphPerformance['update']>, 'fromMode' | 'blend' | 'pattern' | 'trail'> & Partial<Pick<ReturnType<MorphPerformance['update']>, 'fromMode' | 'blend' | 'pattern' | 'trail'>>
