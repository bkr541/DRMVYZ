import type { Cinema2AudioEvent, Cinema2AudioSignal } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleParameterReadFacet, Cinema2ModuleTargetFacet } from '../Cinema2ModuleContracts'
import { selectCinema2MainframeAudio } from '../mainframe/Cinema2MainframeAudioDelivery'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { PSYLO_PATTERNS } from './Cinema2PsyloDomain'

export const PSYLO_MUSIC_DEFAULTS = {
  musicRange: 1, musicSpore: 1, musicLight: 1, musicBend: 0, musicVocal: 0, musicHigh: 0,
  musicKick: 0, musicKickTravel: 0, musicSnare: 0, musicBeat: 0,
  musicBuild: 0, musicDrop: 0, musicDropTravel: 0,
} as const
export type PsyloMusic = { -readonly [K in keyof typeof PSYLO_MUSIC_DEFAULTS]: number }
const clamp = (x: number, min = 0, max = 1) => Math.max(min, Math.min(max, x))
const value = (s: Readonly<Cinema2AudioSignal<number>> | undefined): number | null => s?.available && typeof s.value === 'number' && Number.isFinite(s.value) ? clamp(s.value) : null

/** Shared delivery validity, track identity and timeline freshness, not detection. */
export function selectPsyloAudio(frame: Readonly<Cinema2ModuleFrameReadContext>) {
  const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
  if (!audio || frame.transport?.sourcePresent === false) return null
  return frame.transport && Math.abs(audio.upstream.timeSec - frame.transport.timeSec) > .5 ? null : audio
}

/** Canonical event semantics; Director fallback is deliberately excluded in Phase 3. */
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
interface Hit { time: number; strength: number }

/** Minimal native delivery from shared facts. Phase 4 owns expanded choreography. */
export class Cinema2PsyloAudio {
  private readonly seen = new Set<string>()
  private readonly hits: Partial<Record<'kick' | 'snare' | 'beat' | 'drop', Hit>> = {}
  private held: PsyloMusic = { ...PSYLO_MUSIC_DEFAULTS }
  reset(): void { this.seen.clear(); this.clear() }
  private clear(): void { for (const key of Object.keys(this.hits) as (keyof typeof this.hits)[]) delete this.hits[key]; this.held = { ...PSYLO_MUSIC_DEFAULTS } }
  update(frame: Readonly<Cinema2ModuleFrameReadContext>, amount: number, previousTime: number | null, reset: boolean, latch = false): PsyloMusic {
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
      if (reset || latch || !playing || strength === 0 || (event && (event.timeSec < now - .25 || event.timeSec > now + .05))) return
      this.hits[kind] = { time: event?.timeSec ?? now, strength: event ? clamp(event.strength) : 1 }
    }
    consume(a.rhythm.kick?.id ?? null, 'kick', a.rhythm.kick)
    consume(a.rhythm.snare?.id ?? null, 'snare', a.rhythm.snare)
    consume(a.rhythm.downbeat?.id ?? a.rhythm.beat?.id ?? null, 'beat', a.rhythm.downbeat ?? a.rhythm.beat)
    // Resolve while held too, to consume paused events without replaying them.
    const eventFrame = frame.transport ? { ...frame, transport: { ...frame.transport, playing: true, paused: false } } : frame
    consume(resolvePsyloEvent(eventFrame, 'drop', reset ? null : previousTime), 'drop')
    if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
    if (strength === 0 || (!playing && !paused)) { this.clear(); return this.held }
    if (paused) return this.held
    const age = (kind: keyof typeof this.hits) => this.hits[kind] ? Math.max(0, now - this.hits[kind]!.time) : Infinity
    const envelope = (kind: keyof typeof this.hits, duration: number) => (this.hits[kind]?.strength ?? 0) * Math.max(0, 1 - age(kind) / duration) * strength
    const energy = value(a.features.overallEnergy), bass = value(a.bands.bass) ?? 0, high = value(a.bands.high) ?? 0
    const vocal = value(a.features.vocalPresence) ?? 0
    const build = (value(a.structure.buildConfidence) ?? 0) >= .45 ? value(a.features.buildProgress) ?? 0 : 0
    this.held = {
      musicRange: 1 - strength * ((energy == null ? 0 : .45 * (1 - energy)) + .15 * vocal),
      musicSpore: 1 - strength * ((value(a.bands.high) == null ? 0 : .45 * (1 - high)) + .15 * vocal),
      musicLight: clamp(1 - strength * .25 * (1 - (energy ?? 1)) + .2 * Math.max(envelope('kick', .36), envelope('snare', .2), envelope('beat', .25), envelope('drop', .8))),
      musicBend: strength * bass, musicVocal: strength * vocal, musicHigh: strength * high,
      musicKick: envelope('kick', .36), musicKickTravel: clamp(age('kick') / .36),
      musicSnare: envelope('snare', .2), musicBeat: envelope('beat', .25),
      musicBuild: strength * build, musicDrop: envelope('drop', .8), musicDropTravel: clamp(age('drop') / .8),
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
