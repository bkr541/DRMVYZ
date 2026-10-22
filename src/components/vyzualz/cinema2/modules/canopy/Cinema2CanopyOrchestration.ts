import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import { Cinema2MainframeBeatClockResolver, Cinema2MainframeReactivityEngine, resolveCinema2MainframeTimeSec } from '../mainframe/Cinema2MainframePatternEngine'
import {
  Cinema2MainframePatternController,
  createCinema2MainframePatternCycle,
  resolveCinema2MainframeTriggerEventIdentity,
  type Cinema2MainframeTriggerId,
} from '../mainframe/Cinema2MainframePatternController'
import { resolveCinema2MainframePlaybackState, resolveCinema2MainframeSourceIdentity, selectCinema2MainframeAudio } from '../mainframe/Cinema2MainframeAudioDelivery'
import {
  Cinema2MainframeDropCoordinator,
  readCinema2MainframeDirector,
  resolveCinema2MainframeMusicalEvents,
  shouldResetCinema2MainframeDropState,
  type Cinema2MainframeMusicalCue,
} from '../mainframe/Cinema2MainframeMusicAdapter'
import { CANOPY_PATTERN_IDS, clampCanopy, clampCanopy01, type CanopyPatternId } from './Cinema2CanopyDomain'
import type { CanopyDrive } from './Cinema2CanopyChoreography'

/** A new formation grows out of the old one over this long, so a change reads as the array moving, never as a cut. */
export const CANOPY_PATTERN_BLEND_SECONDS = 0.5

export interface CanopyOrchestrationInput {
  readonly pattern: CanopyPatternId
  readonly patternChange: boolean
  readonly trigger: Cinema2MainframeTriggerId
  readonly bpmSync: boolean
  readonly motionSpeed: number
}

/** A pattern's phase in beats: where it started on the musical clock, at what speed, and the offset that keeps the phase continuous when the speed is edited. */
class PhaseTrack {
  constructor(public pattern: CanopyPatternId, private start: number, private speed: number, private offset = 0) {}

  phaseAt(beats: number): number {
    return Math.max(0, (beats - this.start) * this.speed + this.offset)
  }

  setSpeed(beats: number, speed: number): void {
    if (speed === this.speed) return
    this.offset = this.phaseAt(beats) - Math.max(0, beats - this.start) * speed
    this.speed = speed
  }
}

/**
 * Everything musical and temporal about CANOPY, in one place: the shared beat clock, the shared drop coordinator, the shared reactivity
 * envelopes, and the shared pattern controller (which owns Pattern / Pattern Change / Trigger). It detects nothing itself; the engine's
 * choreography runtime delivers the musical events as cues, and the Audio Intelligence frame supplies the continuous signals.
 */
export class Cinema2CanopyOrchestration {
  private readonly reactivity = new Cinema2MainframeReactivityEngine()
  private readonly beatClock = new Cinema2MainframeBeatClockResolver()
  private readonly dropCoordinator = new Cinema2MainframeDropCoordinator()
  private readonly controller: Cinema2MainframePatternController<CanopyPatternId>
  private track: PhaseTrack | null = null
  private outgoing: PhaseTrack | null = null
  private blend = 1
  private shimmer = 0
  private previousTimeSec: number | null = null
  private previousBeat: number | null = null
  private sourceIdentity: string | null = null
  private trackId: string | null | undefined
  private contextGeneration: number | null = null
  private previousPlayback: ReturnType<typeof resolveCinema2MainframePlaybackState> | null = null
  private selected: CanopyPatternId

  constructor(randomSample: (index: number) => number, initialPattern: CanopyPatternId) {
    this.selected = initialPattern
    this.controller = new Cinema2MainframePatternController<CanopyPatternId>(
      createCinema2MainframePatternCycle<CanopyPatternId>(randomSample, CANOPY_PATTERN_IDS),
      initialPattern,
    )
  }

  update(
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    input: Readonly<CanopyOrchestrationInput>,
    cues: readonly Readonly<Cinema2MainframeMusicalCue>[],
  ): Readonly<CanopyDrive> {
    const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
    const accepted = audio === frame.audio ? frame : { ...frame, audio }
    const playback = resolveCinema2MainframePlaybackState(accepted, audio)
    const timeSec = resolveCinema2MainframeTimeSec(accepted)
    // While paused the analysis may stop publishing; the held source identity must not read as a track change.
    const sourceIdentity = frame.transport?.paused && !audio && this.sourceIdentity != null && frame.transport.trackId === this.trackId
      ? this.sourceIdentity : resolveCinema2MainframeSourceIdentity(frame, audio)
    const reset = shouldResetCinema2MainframeDropState(accepted,
      { timeSec, sourceIdentity, playback },
      { timeSec: this.previousTimeSec, sourceIdentity: this.sourceIdentity, contextGeneration: this.contextGeneration, playback: this.previousPlayback })
    if (reset) { this.dropCoordinator.reset(); this.beatClock.reset() }

    const delivered = reset || playback !== 'playing' ? [] : resolveCinema2MainframeMusicalEvents(accepted, cues)
    const coordinated = this.dropCoordinator.update(accepted, delivered)
    const timing = this.beatClock.resolve(accepted, input.bpmSync)
    // The host stops visual time whenever no track is playing, so with no track the formation simply stands in its rest shape.
    const dt = Number.isFinite(frame.deltaTimeSec) ? clampCanopy(frame.deltaTimeSec, 0, 0.25) : 0
    const beats = timing.beats

    const triggerEventId = reset ? null : resolveCinema2MainframeTriggerEventIdentity(accepted, input.trigger, this.previousTimeSec, coordinated.dropEventId, {
      previousBeat: this.previousBeat, current: timing,
    })
    const selection = this.controller.update({
      authoredPattern: input.pattern, patternChange: input.patternChange, trigger: input.trigger, triggerEventId, absoluteBeat: timing.beats, reset,
    })

    const speed = clampCanopy(input.motionSpeed, 0.3, 2)
    if (reset || this.track == null) {
      this.track = new PhaseTrack(selection.activePattern, beats, speed)
      this.outgoing = null
      this.blend = 1
    } else if (selection.activePattern !== this.track.pattern) {
      this.outgoing = this.track
      this.track = new PhaseTrack(selection.activePattern, beats, speed)
      this.blend = 0
    }
    this.track.setSpeed(beats, speed)
    this.outgoing?.setSpeed(beats, speed)
    this.blend = Math.min(1, this.blend + dt / CANOPY_PATTERN_BLEND_SECONDS)
    if (this.blend >= 1) this.outgoing = null
    this.selected = selection.activePattern

    // The shared engine supplies the envelopes, the signals and the build charge. Its own pattern output is not used.
    const music = this.reactivity.update(frame, 'outward-bus', input.bpmSync, 0, coordinated.events, timing.beats)
    const live = playback !== 'stopped' && music.active
    if (playback === 'playing') this.shimmer = (this.shimmer + dt * 0.9) % 1
    const director = readCinema2MainframeDirector(live ? frame.director : null)
    const s = music.signals
    const i = music.impulses

    this.previousTimeSec = timeSec
    this.previousBeat = timing.beats
    this.sourceIdentity = sourceIdentity
    this.trackId = frame.transport?.trackId
    this.contextGeneration = frame.contextGeneration
    this.previousPlayback = playback

    return Object.freeze({
      pattern: this.track.pattern,
      phase: this.track.phaseAt(beats),
      previous: this.outgoing ? Object.freeze({ pattern: this.outgoing.pattern, phase: this.outgoing.phaseAt(beats) }) : null,
      blend: this.blend,
      musicActive: live,
      level: live ? clampCanopy01(music.level) : 0,
      signals: Object.freeze({
        sub: live ? clampCanopy01(s.sub) : 0, bass: live ? clampCanopy01(s.bass) : 0, mid: live ? clampCanopy01(s.mid) : 0, high: live ? clampCanopy01(s.high) : 0,
        vocal: live ? clampCanopy01(s.vocal) : 0, overall: live ? clampCanopy01(s.overall) : 0, build: live ? clampCanopy01(s.buildProgress ?? s.build) : 0,
      }),
      impulses: Object.freeze({
        kick: live ? clampCanopy01(i.kick) : 0, snare: live ? clampCanopy01(i.snare) : 0, downbeat: live ? clampCanopy01(i.downbeat) : 0,
        phrase: live ? clampCanopy01(i.phrase) : 0, section: live ? clampCanopy01(i.section) : 0, drop: live ? clampCanopy01(i.drop) : 0,
      }),
      director: Object.freeze({ impact: director.impact ?? 0.5, intensity: director.intensity ?? 0.5 }),
      shimmerPhase: this.shimmer,
    })
  }

  /** The formation on stage and the one the user authored, for the Inspector and tests. */
  inspect(): Readonly<{ activePattern: CanopyPatternId; blend: number }> {
    return Object.freeze({ activePattern: this.selected, blend: this.blend })
  }

  reset(): void {
    this.reactivity.reset()
    this.beatClock.reset()
    this.dropCoordinator.reset()
    this.controller.reset()
    this.track = null
    this.outgoing = null
    this.blend = 1
    this.shimmer = 0
    this.previousTimeSec = null
    this.previousBeat = null
    this.sourceIdentity = null
    this.trackId = undefined
    this.contextGeneration = null
    this.previousPlayback = null
  }
}
