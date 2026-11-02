import type { Cinema2AudioEvent } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleParameterReadFacet, Cinema2ModuleTargetFacet } from '../Cinema2ModuleContracts'
import { selectCinema2MainframeAudio } from '../mainframe/Cinema2MainframeAudioDelivery'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { PSYLO_CHOREOGRAPHY_DEFAULTS, PSYLO_EVENT_ACTIONS, type PsyloChoreography } from '../../presets/Cinema2PsyloChoreography'
import { PSYLO_PATTERNS } from './Cinema2PsyloDomain'

export const PSYLO_MUSIC_DEFAULTS = {
  musicRange: 1, musicSpore: 1, musicLight: 1, musicBend: 0, musicVocal: 0, musicHigh: 0,
  musicKick: 0, musicKickTravel: 0, musicSnare: 0, musicBeat: 0,
  musicBuild: 0, musicDrop: 0, musicDropTravel: 0,
} as const
export type PsyloMusic = { -readonly [K in keyof typeof PSYLO_MUSIC_DEFAULTS]: number }
const clamp = (x: number, min = 0, max = 1) => Math.max(min, Math.min(max, x))
export function readPsyloChoreography(parameters: Cinema2ModuleParameterReadFacet): PsyloChoreography {
  return Object.fromEntries(Object.entries(PSYLO_CHOREOGRAPHY_DEFAULTS).map(([key, fallback]) => {
    const value = parameters.get(key)
    return [key, typeof value === 'number' && Number.isFinite(value) ? clamp(value, fallback === -1 ? -1 : 0) : fallback]
  })) as PsyloChoreography
}

/** Shared delivery validity, track identity and timeline freshness, not detection. */
export function selectPsyloAudio(frame: Readonly<Cinema2ModuleFrameReadContext>) {
  const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
  if (!audio || frame.transport?.sourcePresent === false) return null
  return frame.transport && Math.abs(audio.upstream.timeSec - frame.transport.timeSec) > .5 ? null : audio
}

/** Canonical event semantics; Director fallback is deliberately excluded from raw musical events. */
export function resolvePsyloEvent(frame: Readonly<Cinema2ModuleFrameReadContext>, trigger: Cinema2AfterhoursTriggerId, previousTime: number | null): string | null {
  if (!frame.audio) return null
  const a = frame.audio
  const event = trigger === 'kick' ? a.rhythm.kick : trigger === 'snare' ? a.rhythm.snare : trigger === 'downbeat' ? a.rhythm.downbeat
    : trigger.startsWith('bar') ? a.rhythm.fixedClocks[4].boundary : trigger.startsWith('beat') ? a.rhythm.beat
      : trigger === 'phrase' ? a.rhythm.fixedClocks[16].boundary : null
  if (event && (event.timeSec < a.upstream.timeSec - .25 || event.timeSec > a.upstream.timeSec + .05)) return null
  return resolveCinema2AfterhoursTriggerEventIdentity({ ...frame, director: null }, trigger, previousTime)
}

/** Runtime selection never changes the saved authored Pattern/permission/Trigger. */
export class PsyloPatternController {
  private authored = -1
  private base = 0
  private revision = -1
  private enabled = false
  private trigger = ''
  private readonly seen = new Set<string>()
  update(authored: number, enabled: boolean, trigger: string, event: string | null, revision: number, reset: boolean, hold: boolean): number {
    if (reset) this.seen.clear()
    const edited = authored !== this.authored || revision !== this.revision
    if (reset || edited || enabled !== this.enabled || trigger !== this.trigger || !enabled) {
      this.base = authored
      if (event) this.seen.add(event)
    } else if (hold) {
      if (event) this.seen.add(event)
    } else if (event && !this.seen.has(event)) {
      this.base = (this.base + 1) % PSYLO_PATTERNS.length
      this.seen.add(event)
    }
    if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
    this.authored = authored; this.revision = revision; this.enabled = enabled; this.trigger = trigger
    return this.base
  }
}
interface Hit { time: number }

/** Freshness/permission adapter, not an envelope engine. Shared Choreography
 * owns all response amplitudes; native state only gates accepted event windows
 * and supplies spatial travel progress. This prevents stale shared envelopes
 * from taking authority on activation, resume or analysis replacement. */
export class Cinema2PsyloAudio {
  private readonly seen = new Set<string>()
  private readonly hits: Partial<Record<'kick' | 'snare' | 'beat' | 'drop', Hit>> = {}
  private held: PsyloMusic = { ...PSYLO_MUSIC_DEFAULTS }
  reset(): void { this.seen.clear(); this.clear() }
  private clear(): void { for (const key of Object.keys(this.hits) as (keyof typeof this.hits)[]) delete this.hits[key]; this.held = { ...PSYLO_MUSIC_DEFAULTS } }
  update(frame: Readonly<Cinema2ModuleFrameReadContext>, amount: number, previousTime: number | null, reset: boolean, latch = false, channels: PsyloChoreography = { ...PSYLO_CHOREOGRAPHY_DEFAULTS }): PsyloMusic {
    if (reset) this.reset()
    const strength = clamp(amount), paused = frame.transport?.paused === true
    const a = frame.audio
    // The host intentionally hides its audio snapshot on pause. Preserve the
    // last response rather than treating that gate as an analysis loss.
    if (!a) { if (!paused || strength === 0) this.clear(); return this.held }
    const now = a.upstream.timeSec
    const playing = frame.transport?.playing !== false && !paused
    const consume = (id: string | null, kind: keyof typeof this.hits, event: Readonly<Cinema2AudioEvent> | null = null) => {
      if (!id || this.seen.has(id)) return
      this.seen.add(id)
      if (reset || latch || !playing || strength === 0 || (event && (event.timeSec < now - .25 || event.timeSec > now + .05))) {
        // A newly latched event may have replaced the shared envelope. It must
        // not borrow the previous accepted event's still-open native window.
        delete this.hits[kind]; return
      }
      this.hits[kind] = { time: event?.timeSec ?? now }
    }
    consume(a.rhythm.kick?.id ?? null, 'kick', a.rhythm.kick)
    consume(a.rhythm.snare?.id ?? null, 'snare', a.rhythm.snare)
    consume(a.rhythm.beat?.id ?? null, 'beat', a.rhythm.beat)
    // Resolve while held too, to consume paused events without replaying them.
    const eventFrame = frame.transport ? { ...frame, transport: { ...frame.transport, playing: true, paused: false } } : frame
    consume(resolvePsyloEvent(eventFrame, 'drop', reset ? null : previousTime), 'drop')
    if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
    if (strength === 0 || (!playing && !paused)) { this.clear(); return this.held }
    if (paused) return this.held
    const age = (kind: keyof typeof this.hits) => this.hits[kind] ? Math.max(0, now - this.hits[kind]!.time) : Infinity
    const envelope = (kind: keyof typeof this.hits) => {
      const action = PSYLO_EVENT_ACTIONS[kind]
      return age(kind) <= action.attack + action.release ? Math.min(action.maximum, channels[action.property]) * strength : 0
    }
    const energy = channels.choreoEnergy, bass = Math.max(0, channels.choreoBass), high = Math.max(0, channels.choreoHigh)
    const vocal = Math.max(0, channels.choreoVocal)
    const build = channels.choreoBuildConfidence >= .45 ? Math.max(0, channels.choreoBuild) : 0
    const range = 1 - strength * .4 * (1 - (energy < 0 ? 1 : energy))
    const restraint = 1 - strength * .35 * vocal
    const spore = 1 - strength * .45 * (1 - (channels.choreoHigh < 0 ? 1 : high))
    const accent = Math.max(...(['kick', 'snare', 'beat', 'drop'] as const).map(kind => envelope(kind) / PSYLO_EVENT_ACTIONS[kind].maximum))
    this.held = {
      musicRange: range * restraint,
      musicSpore: clamp(spore * restraint + envelope('snare') * (1 - spore * restraint)),
      musicLight: clamp(1 - strength * .25 * (1 - (energy < 0 ? 1 : energy)) + .2 * accent),
      musicBend: strength * bass, musicVocal: strength * vocal, musicHigh: strength * high,
      musicKick: envelope('kick'), musicKickTravel: clamp(age('kick') / .24),
      musicSnare: envelope('snare'), musicBeat: envelope('beat'),
      musicBuild: strength * build * .15, musicDrop: envelope('drop'), musicDropTravel: clamp(age('drop') / .82),
    }
    return this.held
  }
}

/** Compose all native response values through declared Cinema 2.0 module targets. */
export function resolvePsyloMusic(raw: PsyloMusic, parameters: Cinema2ModuleParameterReadFacet, targets: Cinema2ModuleTargetFacet): PsyloMusic {
  const output: PsyloMusic = { ...PSYLO_MUSIC_DEFAULTS }
  for (const key of Object.keys(output) as (keyof PsyloMusic)[]) {
    const target = parameters.resolve(key)?.target
    if (!target) continue
    const result = targets.resolve(target.id, [{ contributorId: 'psylo-audio-delivery', operation: PSYLO_MUSIC_DEFAULTS[key] === 1 ? 'multiply' : 'add', value: raw[key] }])
    if (result.ok && typeof result.value === 'number' && Number.isFinite(result.value)) output[key] = clamp(result.value, PSYLO_MUSIC_DEFAULTS[key] === 1 ? .4 : 0)
  }
  return output
}
