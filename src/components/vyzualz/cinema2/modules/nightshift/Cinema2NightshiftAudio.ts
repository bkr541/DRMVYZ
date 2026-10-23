import type { Cinema2AudioSignal, Cinema2AudioEvent } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleParameterReadFacet, Cinema2ModuleTargetFacet } from '../Cinema2ModuleContracts'
import { selectCinema2MainframeAudio } from '../mainframe/Cinema2MainframeAudioDelivery'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { NIGHTSHIFT_CHOREOGRAPHY_DEFAULTS, type NightshiftAudioChannels } from '../../presets/Cinema2NightshiftChoreography'

export const NIGHTSHIFT_MUSIC_TARGET_DEFAULTS = {
  musicCoverage: 1, musicRotation: 1, musicLevel: 1, musicGlintRate: 0,
  musicSnare: 0, musicKick: 0, musicKickTravel: 0, musicBuild: 0,
  musicDrop: 0, musicDropTravel: 0, musicMotion: 1, musicCeiling: 1, musicImpact: 0,
} as const
export type NightshiftMusic = { -readonly [K in keyof typeof NIGHTSHIFT_MUSIC_TARGET_DEFAULTS]: number }
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const signal = (value: Readonly<Cinema2AudioSignal<number>> | undefined): number | null => value?.available && typeof value.value === 'number' && Number.isFinite(value.value) ? clamp(value.value) : null

export function readNightshiftAudioChannels(parameters: Cinema2ModuleParameterReadFacet): NightshiftAudioChannels {
  const channels = { ...NIGHTSHIFT_CHOREOGRAPHY_DEFAULTS }
  for (const key of Object.keys(channels) as (keyof NightshiftAudioChannels)[]) {
    const value = parameters.get(key)
    if (typeof value === 'number' && Number.isFinite(value)) channels[key] = clamp(value)
  }
  return channels
}

/** Reuses the established shared-frame delivery gate, adding only timeline freshness. */
export function selectNightshiftAudio(frame: Readonly<Cinema2ModuleFrameReadContext>) {
  const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
  if (frame.transport?.sourcePresent === false || !audio) return null
  if (frame.transport && Math.abs(audio.upstream.timeSec - frame.transport.timeSec) > .5) return null
  return audio
}

/** Preserve canonical trigger meaning while rejecting stale rhythmic hits. */
export function resolveNightshiftPatternEvent(frame: Readonly<Cinema2ModuleFrameReadContext>, trigger: Cinema2AfterhoursTriggerId, previousTime: number | null): string | null {
  const audio = frame.audio
  if (!audio) return null
  const rhythm = audio.rhythm
  const event = trigger === 'kick' ? rhythm.kick : trigger === 'snare' ? rhythm.snare
    : trigger === 'downbeat' ? rhythm.downbeat : trigger.startsWith('bar') ? rhythm.fixedClocks[4].boundary
      : trigger.startsWith('beat') ? rhythm.beat : null
  if (event && (event.timeSec < audio.upstream.timeSec - .25 || event.timeSec > audio.upstream.timeSec + .05)) return null
  return resolveCinema2AfterhoursTriggerEventIdentity(frame, trigger, previousTime)
}

interface Impulse { id: string; timeSec: number; strength: number }

/** Delivers shared facts as bounded native response channels. No detection, BPM
 * estimation, Director interpretation, pattern overrides or saved-state writes.
 */
export class Cinema2NightshiftAudio {
  private readonly seen = new Set<string>()
  private kick: Impulse | null = null
  private snare: Impulse | null = null
  private drop: Impulse | null = null
  private held: NightshiftMusic = { ...NIGHTSHIFT_MUSIC_TARGET_DEFAULTS }

  reset(): void {
    this.seen.clear(); this.kick = null; this.snare = null; this.drop = null
    this.held = { ...NIGHTSHIFT_MUSIC_TARGET_DEFAULTS }
  }

  update(frame: Readonly<Cinema2ModuleFrameReadContext>, amount: number, previousTime: number | null, reset: boolean, channels: NightshiftAudioChannels): NightshiftMusic {
    if (reset) this.reset()
    const audio = frame.audio
    if (!audio) { this.reset(); return this.held }
    const now = audio.upstream.timeSec
    const paused = frame.transport?.paused === true
    const playing = frame.transport?.playing !== false && !paused
    const strength = clamp(amount)
    const consume = (event: Readonly<Cinema2AudioEvent> | null): Impulse | null => {
      if (!event || this.seen.has(event.id)) return null
      this.seen.add(event.id)
      // Latch events on reset, pause and manual disable; never replay them later.
      if (reset || !playing || strength === 0 || event.timeSec < now - .25 || event.timeSec > now + .05) return null
      return { id: event.id, timeSec: event.timeSec, strength: clamp(event.strength) }
    }
    const kick = consume(audio.rhythm.kick), snare = consume(audio.rhythm.snare)
    if (kick) this.kick = kick
    if (snare) this.snare = snare
    // Shared analyzed semantic drop identity, without using Director meaning.
    const dropId = resolveCinema2AfterhoursTriggerEventIdentity({ ...frame, director: null }, 'drop', reset ? null : previousTime)
    if (dropId && !this.seen.has(dropId)) {
      this.seen.add(dropId)
      if (!reset && playing && strength > 0) this.drop = { id: dropId, timeSec: now, strength: 1 }
    }
    if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
    if (strength === 0 || (!playing && !paused)) {
      this.kick = null; this.snare = null; this.drop = null
      this.held = { ...NIGHTSHIFT_MUSIC_TARGET_DEFAULTS }
      return this.held
    }
    if (paused) return this.held
    const age = (event: Impulse | null) => event ? Math.max(0, now - event.timeSec) : Number.POSITIVE_INFINITY
    const envelope = (event: Impulse | null, duration: number) => event ? event.strength * Math.max(0, 1 - age(event) / duration) : 0
    // Availability remains a shared fact. Values come exclusively from the
    // shared choreography runtime's smoothed, target-resolved delivery routes.
    const energy = signal(audio.features.overallEnergy) == null ? 1 : channels.audioEnergy
    const bass = signal(audio.bands.bass) == null ? 0 : channels.bassPressure
    const high = signal(audio.bands.high) == null ? 0 : channels.highGlint
    const vocal = signal(audio.features.vocalPresence) == null ? 0 : channels.vocalRestraint
    const build = (signal(audio.structure.buildConfidence) ?? 0) >= .45 && signal(audio.features.buildProgress) != null ? channels.buildPressure : 0
    this.held = {
      ...NIGHTSHIFT_MUSIC_TARGET_DEFAULTS,
      musicCoverage: 1 - strength * (.45 * (1 - energy) + .15 * vocal),
      musicRotation: 1 + .25 * strength * bass,
      musicLevel: 1 - .25 * strength * (1 - energy),
      musicGlintRate: .3 * strength * high,
      musicSnare: strength * envelope(this.snare, .16),
      musicKick: strength * envelope(this.kick, .36),
      musicKickTravel: clamp(age(this.kick) / .36),
      musicBuild: strength * build,
      musicDrop: strength * envelope(this.drop, .65),
      musicDropTravel: clamp(age(this.drop) / .65),
    }
    return this.held
  }
}

/** Every response channel composes through the existing target resolver. The
 * renderer never receives unchecked raw audio values or replaces user settings.
 */
export function resolveNightshiftMusic(raw: NightshiftMusic, parameters: Cinema2ModuleParameterReadFacet, targets: Cinema2ModuleTargetFacet): NightshiftMusic {
  const resolved = { ...NIGHTSHIFT_MUSIC_TARGET_DEFAULTS } as NightshiftMusic
  for (const key of Object.keys(resolved) as (keyof NightshiftMusic)[]) {
    const target = parameters.resolve(key)?.target
    if (!target) continue
    const base = NIGHTSHIFT_MUSIC_TARGET_DEFAULTS[key]
    const result = targets.resolve(target.id, [{ contributorId: 'nightshift-audio-delivery', operation: base === 1 ? 'multiply' : 'add', value: raw[key] }])
    if (result.ok && typeof result.value === 'number' && Number.isFinite(result.value)) resolved[key] = clamp(result.value, 0, key === 'musicRotation' ? 1.25 : key === 'musicMotion' ? 1.15 : 1)
  }
  return resolved
}
