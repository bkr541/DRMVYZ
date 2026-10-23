import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import type { NightshiftAudioChannels } from '../../presets/Cinema2NightshiftChoreography'
import type { Cinema2VisualDirectorSignal } from '../../director/Cinema2VisualDirector'
import type { NightshiftMusic } from './Cinema2NightshiftAudio'

const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0))
const supported = (s: Readonly<Cinema2VisualDirectorSignal<number>>) => s.available && s.value != null && Number.isFinite(s.value) && (s.confidence ?? 0) >= .45
const neutral = { intensity: 1, momentum: 0, build: 0, impact: 0 }

/** Interprets shared significance only. Never selects programs, changes camera
 * or palette, detects music, or writes user state. Values enter via shared targets. */
export class Cinema2NightshiftDirector {
  private readonly seen = new Set<string>()
  private impulse: { timeSec: number; strength: number } | null = null
  private held = { ...neutral }

  reset() { this.seen.clear(); this.impulse = null; this.held = { ...neutral } }

  apply(frame: Readonly<Cinema2ModuleFrameReadContext>, amount: number, music: NightshiftMusic, channels: NightshiftAudioChannels, reset: boolean): NightshiftMusic {
    if (reset) this.reset()
    const { audio, director, transport } = frame
    if (!audio || !director || director.visualFrameId !== audio.visualFrameId || director.discontinuityGeneration !== audio.discontinuity.generation) {
      this.reset(); return music
    }
    const response = clamp(amount), paused = transport?.paused === true
    const playing = transport?.playing !== false && !paused
    const authority = director.authority.impact
    const fresh = authority.eventIds.some(id => !this.seen.has(id))
    for (const id of authority.eventIds) this.seen.add(id)
    while (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
    if (fresh && authority.available && authority.occurred && (authority.confidence ?? 0) >= .45 && channels.directorImpact >= .85
      && !reset && playing && response > 0) this.impulse = { timeSec: audio.upstream.timeSec, strength: clamp(channels.directorImpact) }
    if (response === 0 || (!playing && !paused)) {
      this.impulse = null; this.held = { ...neutral }; return music
    }
    if (!paused) {
      this.held = {
        intensity: supported(director.continuous.intensity) ? clamp(channels.directorIntensity) : 1,
        momentum: supported(director.continuous.momentum) ? clamp(channels.directorMomentum) : 0,
        build: supported(director.context.build) ? clamp(channels.directorBuild) : 0,
        impact: this.impulse && authority.available ? this.impulse.strength * clamp(1 - (audio.upstream.timeSec - this.impulse.timeSec) / .7) : 0,
      }
    }
    const d = this.held, impact = response * d.impact
    const lighting = 1 - .12 * response * (1 - d.intensity)
    return { ...music,
      musicLevel: clamp(music.musicLevel * lighting + .06 * impact),
      musicCeiling: clamp(lighting + .08 * impact),
      musicMotion: 1 + .15 * response * d.momentum,
      musicRotation: Math.min(1.25, music.musicRotation * (1 + .1 * response * d.momentum)),
      musicBuild: Math.max(music.musicBuild, .8 * response * d.build),
      musicImpact: impact,
    }
  }
}
