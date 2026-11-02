import type { Cinema2VisualDirectorSignal } from '../../director/Cinema2VisualDirector'
import { PSYLO_DIRECTOR_TRANSITION, PSYLO_EVENT_ACTIONS, type PsyloChoreography } from '../../presets/Cinema2PsyloChoreography'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import type { PsyloMusic } from './Cinema2PsyloAudio'

const clamp = (x: number, max = 1) => Math.max(0, Math.min(max, Number.isFinite(x) ? x : 0))
const supported = (s: Readonly<Cinema2VisualDirectorSignal<number>>, routed: number) => s.available && s.value != null && Number.isFinite(s.value) && (s.confidence ?? 0) >= .45 && routed >= 0

/** Shared significance shapes PSYLO's existing gestures; no new musical events,
 * amplitude envelopes, pattern selection, user-state writes or camera authority.
 * Retained impact significance qualifies existing shared envelopes only. */
export class Cinema2PsyloDirector {
  private readonly seen = new Set<string>()
  private impact: { time: number; strength: number } | null = null
  private transitionTime: number | null = null
  private available = false
  private held: PsyloMusic | null = null

  reset(): void { this.seen.clear(); this.clear(); this.available = false }
  private clear(): void { this.impact = null; this.transitionTime = null; this.held = null }

  apply(frame: Readonly<Cinema2ModuleFrameReadContext>, amount: number, music: PsyloMusic, c: PsyloChoreography, reset: boolean, latch = false): PsyloMusic {
    if (reset) this.reset()
    const response = clamp(amount), { audio, director: d, transport } = frame
    if (response === 0) this.clear()
    // The production host hides both snapshots on pause. Hold the already
    // composed result once, rather than applying its gains a second time.
    if (transport?.paused && !audio) return response > 0 && this.held ? this.held : music
    if (!audio || !d || d.visualFrameId !== audio.visualFrameId || d.discontinuityGeneration !== audio.discontinuity.generation) {
      this.clear(); this.available = false; return music
    }
    const playing = transport?.playing !== false && transport?.paused !== true
    const rearm = reset || latch || !this.available || !playing || response === 0
    this.available = true
    const now = audio.upstream.timeSec
    const impact = d.authority.impact, transition = d.context.transition
    const freshImpact = impact.eventIds.some(id => !this.seen.has(`impact:${id}`))
    for (const id of impact.eventIds) this.seen.add(`impact:${id}`)
    if (freshImpact) {
      this.impact = !rearm && impact.available && impact.occurred && (impact.confidence ?? 0) >= .45 && c.choreoDirectorImpact >= .65
        ? { time: now, strength: clamp(c.choreoDirectorImpact) } : null
    }
    if (!impact.available || c.choreoDirectorImpact < 0) this.impact = null
    if (transition.eventId && !this.seen.has(`transition:${transition.eventId}`)) {
      this.seen.add(`transition:${transition.eventId}`)
      this.transitionTime = !rearm && transition.available && transition.occurred && transition.kind === 'section-change'
        && (transition.confidence ?? 0) >= .45 && transition.authority >= .5 ? now : null
    }
    if (!transition.available) this.transitionTime = null
    while (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
    if (response === 0 || (!playing && !transport?.paused)) { this.clear(); return music }
    if (transport?.paused) return this.held ?? music

    const intensity = supported(d.continuous.intensity, c.choreoDirectorIntensity) ? clamp(c.choreoDirectorIntensity) : null
    const momentum = supported(d.continuous.momentum, c.choreoDirectorMomentum) ? clamp(c.choreoDirectorMomentum) : null
    const build = supported(d.context.build, c.choreoDirectorBuild) ? clamp(c.choreoDirectorBuild) : 0
    // An omitted route is not a measured low value; it contributes nothing.
    if (intensity == null && momentum == null && !supported(d.context.build, c.choreoDirectorBuild) && c.choreoDirectorImpact < 0 && c.choreoDirectorTransition === 0) {
      this.held = music; return music
    }
    const vocal = intensity != null || momentum != null ? clamp(c.choreoVocal) : 0
    // Missing context is exactly neutral. Momentum uses range already permitted
    // by the user, and vocal restraint is never undone by a macro gain.
    const range = clamp(1 - (intensity == null ? 0 : .15 * response * (1 - intensity)) + .1 * response * (momentum ?? 0)) * (1 - .08 * response * vocal)
    const significance = this.impact && now - this.impact.time <= .82 ? this.impact.strength : 0
    const eventGain = 1 + .25 * response * significance
    const transitionAccent = this.transitionTime != null && now - this.transitionTime <= PSYLO_DIRECTOR_TRANSITION.attack + PSYLO_DIRECTOR_TRANSITION.release
      ? clamp(c.choreoDirectorTransition, PSYLO_DIRECTOR_TRANSITION.maximum) * response : 0
    const light = intensity == null ? 1 : 1 - .1 * response * (1 - intensity)
    this.held = {
      ...music,
      musicRange: Math.max(.4, music.musicRange * range),
      musicSpore: clamp(music.musicSpore * (1 - .08 * response * vocal)),
      musicLight: clamp(music.musicLight * light + (1 - music.musicLight * light) * (transitionAccent + .08 * response * significance)),
      musicBend: music.musicBend * (momentum == null ? 1 : 1 - .12 * response * (1 - momentum)),
      musicBuild: Math.max(music.musicBuild, .15 * response * build),
      musicKick: clamp(music.musicKick * eventGain, PSYLO_EVENT_ACTIONS.kick.maximum),
      musicSnare: clamp(music.musicSnare * eventGain, PSYLO_EVENT_ACTIONS.snare.maximum),
      musicBeat: clamp(music.musicBeat * eventGain + transitionAccent, PSYLO_EVENT_ACTIONS.beat.maximum),
      musicDrop: clamp(music.musicDrop * eventGain, PSYLO_EVENT_ACTIONS.drop.maximum),
    }
    return this.held
  }
}
