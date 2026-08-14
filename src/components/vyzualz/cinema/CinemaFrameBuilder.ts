import type { LyricPlaybackState } from '../../../features/lyrics/runtime/lyricPlaybackResolver'
import type { MusicIntelligenceFrame, ReactTrackSection } from '../../../features/musicIntelligence/types'
import type { ReactFrameContext } from '../react/renderers/reactRenderUtils'
import {
  CINEMA_STATE_RESET_ACTION_IDS,
  type CinemaBrandFrame,
  type CinemaClockFrame,
  type CinemaFrameContext,
  type CinemaFrameDiscontinuityReason,
  type CinemaFrameResetSignal,
  type CinemaMusicalClockId,
  type CinemaMusicalClockFrame,
  type CinemaStateResetActionId,
} from './CinemaRendererContracts'
import type { CinemaBrandRole, CinemaColor } from './CinemaDomain'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import type {
  CinemaActionId,
  CinemaCameraId,
  CinemaCompositionId,
  CinemaEventId,
} from './CinemaIdentifiers'
import type { CinemaCameraUniformSnapshot } from './CinemaRendererContracts'

export const CINEMA_FRAME_CONTEXT_VERSION = 1 as const
export const CINEMA_FRAME_BUILDER_STATE_VERSION = 1 as const

const CLOCK_SPANS_BEATS: Readonly<Record<CinemaMusicalClockId, number>> = Object.freeze({
  beat: 1,
  beat2: 2,
  beat4: 4,
  bar: 4,
  bar4: 16,
  bar8: 32,
  phrase: 16,
})

const CLOCK_IDS = Object.freeze(Object.keys(CLOCK_SPANS_BEATS) as CinemaMusicalClockId[])
const EMPTY_EVENT_IDS = Object.freeze({
  beat: null,
  downbeat: null,
  kick: null,
  snare: null,
  transient: null,
  sectionStart: null,
  dropStart: null,
  lyricCue: null,
  lyricWord: null,
  phrase4: null,
  phrase8: null,
})

export interface CinemaFrameTransportInput {
  trackId?: string | null
  durationSec?: number | null
  seeking?: boolean
  looped?: boolean
  visibilitySuspended?: boolean
}

export interface CinemaFramePerformanceEventInput {
  readonly actionId: string
  readonly sequence: number
}

export interface CinemaFramePerformanceInput {
  available?: boolean
  events?: readonly CinemaFramePerformanceEventInput[]
  toggleStates?: Readonly<Record<string, boolean>>
}

export interface CinemaFrameBrandInput {
  available?: boolean
  colors?: Partial<Record<CinemaBrandRole, CinemaColor>>
}

export interface CinemaFrameBuilderInput {
  compositionId?: CinemaCompositionId | string | null
  reactFrame: Readonly<ReactFrameContext>
  transport?: Readonly<CinemaFrameTransportInput>
  musicIntelligence?: Readonly<MusicIntelligenceFrame> | null
  authoritativeSections?: readonly ReactTrackSection[] | null
  lyrics?: Readonly<LyricPlaybackState> | null
  performance?: Readonly<CinemaFramePerformanceInput> | null
  brand?: Readonly<CinemaFrameBrandInput> | null
  mediaAssetsAvailable?: boolean
  analyserAvailable?: boolean
  activeCameraId?: CinemaCameraId | null
  camera?: Readonly<CinemaCameraUniformSnapshot> | null
  previousState?: Readonly<CinemaFrameBuilderState> | null
}

export interface CinemaFrameBuilderState {
  readonly version: typeof CINEMA_FRAME_BUILDER_STATE_VERSION
  readonly frameIndex: number
  readonly trackIdentity: string | null
  readonly audioTimeSec: number
  readonly elapsedTimeSec: number
  readonly playing: boolean
  readonly paused: boolean
  readonly visibilitySuspended: boolean
  readonly clockIndices: Readonly<Record<CinemaMusicalClockId, number | null>>
  readonly sectionIdentity: string | null
  readonly lyricLineIdentity: string | null
  readonly lyricWordIdentity: string | null
  readonly lastImpulseEventIds: Readonly<Partial<Record<keyof typeof EMPTY_EVENT_IDS, CinemaEventId>>>
  readonly lastPerformanceSequence: number
  readonly resetGeneration: number
}

export interface CinemaFrameBuildResult {
  readonly frame: Readonly<CinemaFrameContext>
  readonly state: Readonly<CinemaFrameBuilderState>
  readonly diagnostics: CinemaDiagnosticSnapshot
}

interface ResolvedSectionSnapshot {
  id: string
  type: string | null
  startSec: number
  endSec: number
  progress: number
}

interface MusicalPositionSnapshot {
  available: boolean
  bpm: number | null
  beatIndex: number | null
  beatPhase: number
  beatInBar: number | null
  barIndex: number | null
  phraseIndex: number | null
  source: 'music-intelligence' | 'react-frame' | 'bpm-derived' | 'unavailable'
}

/**
 * Pure normalized-frame bridge. Every temporal decision depends only on the
 * current canonical snapshots and the explicitly supplied previous builder state.
 */
export function buildCinemaFrameContext(input: CinemaFrameBuilderInput): CinemaFrameBuildResult {
  const previous = input.previousState ?? null
  const reactFrame = input.reactFrame
  const mi = input.musicIntelligence ?? reactFrame.musicIntelligence ?? null
  const transportInput = input.transport ?? {}
  const trackIdentity = normalizeTrackIdentity(
    transportInput.trackId
      ?? reactFrame.trackKey
      ?? mi?.trackId
      ?? mi?.sourceId
      ?? null,
  )
  const audioTimeSec = nonNegativeFinite(reactFrame.audioTime)
  const durationSec = positiveFiniteOrNull(transportInput.durationSec)
  const playing = reactFrame.isPlaying === true
  const analysisActive = reactFrame.analysisActive ?? playing
  const paused = reactFrame.isPaused === true
  const visibilitySuspended = transportInput.visibilitySuspended === true
  const rawDeltaTimeSec = finiteOr(reactFrame.deltaTimeSec, 0)
  const deltaTimeSec = paused || !analysisActive ? 0 : clamp(rawDeltaTimeSec, 0, 0.25)
  const elapsedTimeSec = paused && previous
    ? previous.elapsedTimeSec
    : Math.max(previous?.elapsedTimeSec ?? 0, nonNegativeFinite(reactFrame.elapsedTimeSec ?? 0))

  const discontinuityReasons = resolveDiscontinuityReasons({
    previous,
    trackIdentity,
    audioTimeSec,
    durationSec,
    playing,
    paused,
    visibilitySuspended,
    seeking: transportInput.seeking === true,
    looped: transportInput.looped === true,
    timingDiscontinuity: reactFrame.timingDiscontinuity === true,
    deltaTimeSec,
  })
  const reset = createResetSignal(previous, trackIdentity, audioTimeSec, discontinuityReasons)
  const suppressImpulses = previous == null
    || reset.required
    || paused
    || !analysisActive
    || visibilitySuspended

  const sections = input.authoritativeSections
    ?? reactFrame.trackSections
    ?? mi?.resolvedSections
    ?? []
  const resolvedSection = resolveSectionSnapshot(reactFrame, mi, sections, audioTimeSec)
  const sectionIdentity = resolvedSection?.id ?? null

  const beatGridAvailable = resolveBeatGridAvailability(mi, reactFrame)
  const musicalPosition = resolveMusicalPosition(mi, reactFrame, audioTimeSec, beatGridAvailable)
  const clockFrame = buildClockFrame({
    trackIdentity,
    musicalPosition,
    previous,
    suppressImpulses,
  })

  const lyricSnapshot = resolveLyricSnapshot(input.lyrics ?? null, mi)
  const performanceSnapshot = resolvePerformanceSnapshot(input.performance, previous)
  const eventSnapshot = resolveImpulseSnapshot({
    trackIdentity,
    audioTimeSec,
    musicalPosition,
    clocks: clockFrame,
    mi,
    resolvedSection,
    previous,
    lyricPlayback: input.lyrics ?? null,
    lyricLineIdentity: lyricSnapshot.lineId,
    lyricWordIdentity: lyricSnapshot.wordId,
    suppressImpulses,
  })

  const analyserAvailable = input.analyserAvailable ?? (
    reactFrame.freqData != null
    || reactFrame.timeDomainData != null
    || mi?.raw.freqData != null
    || mi?.raw.timeDomainData != null
  )
  const musicIntelligenceAvailable = Boolean(mi && mi.frameId > 0)
  const authoritativeSectionsAvailable = sections.length > 0
  const lyricsAvailable = lyricSnapshot.available
  const brand = normalizeBrandFrame(input.brand)
  const sharedPerformanceAvailable = Boolean(
    input.performance?.available === true
    || (input.performance?.events?.length ?? 0) > 0
    || Object.keys(input.performance?.toggleStates ?? {}).length > 0,
  )

  const compositionIdentity = normalizeIdentity(input.compositionId) ?? 'none'
  const musicalIdentity = createMusicalPositionIdentity(musicalPosition, audioTimeSec)
  const emittedEventIds = Object.values(eventSnapshot.eventIds).filter((value): value is CinemaEventId => value != null)
  const seeds = Object.freeze({
    composition: createCinemaDeterministicSeed(`composition:${compositionIdentity}`),
    track: createCinemaDeterministicSeed(`track:${trackIdentity ?? 'none'}`),
    musicalPosition: createCinemaDeterministicSeed(`position:${trackIdentity ?? 'none'}:${musicalIdentity}`),
    event: createCinemaDeterministicSeed(`event:${emittedEventIds.join('|') || `${trackIdentity ?? 'none'}:${musicalIdentity}`}`),
  })

  const audio = normalizeAudioFrame(reactFrame, mi, analyserAvailable || musicIntelligenceAvailable)
  const diagnostics = createFrameDiagnostics({
    analyserAvailable,
    musicIntelligenceAvailable,
    beatGridAvailable,
    authoritativeSectionsAvailable,
    lyricsAvailable,
    trackIdentity,
  })

  const frameIndex = paused && previous
    ? previous.frameIndex
    : (previous?.frameIndex ?? -1) + 1
  const frame: Readonly<CinemaFrameContext> = Object.freeze({
    version: CINEMA_FRAME_CONTEXT_VERSION,
    viewport: Object.freeze({
      width: Math.max(1, Math.floor(finiteOr(reactFrame.W, 1))),
      height: Math.max(1, Math.floor(finiteOr(reactFrame.H, 1))),
      dpr: clamp(finiteOr(reactFrame.dpr, 1), 0.25, 8),
    }),
    timing: Object.freeze({
      frameIndex,
      elapsedTimeSec,
      deltaTimeSec,
      seeds,
    }),
    transport: Object.freeze({
      trackId: trackIdentity,
      audioTimeSec,
      durationSec,
      playing,
      paused,
      seeking: discontinuityReasons.includes('seek'),
      looped: discontinuityReasons.includes('loop-wrap'),
      visibilitySuspended,
      discontinuity: reset.required,
      discontinuityReasons,
      reset,
    }),
    audio,
    music: Object.freeze({
      available: musicalPosition.available,
      source: musicalPosition.source,
      bpm: musicalPosition.bpm,
      beatIndex: musicalPosition.beatIndex,
      beatPhase: musicalPosition.beatPhase,
      beatInBar: musicalPosition.beatInBar,
      barIndex: musicalPosition.barIndex,
      phraseIndex: musicalPosition.phraseIndex,
      sectionId: resolvedSection?.id ?? null,
      sectionType: resolvedSection?.type ?? null,
      sectionProgress: resolvedSection?.progress ?? 0,
      resolvedSections: Object.freeze(sections.map(section => Object.freeze({
        id: section.id,
        label: section.label,
        type: section.type,
        startSec: nonNegativeFinite(section.startSec),
        endSec: Math.max(nonNegativeFinite(section.startSec), finiteOr(section.endSec, section.startSec)),
        intensity: clamp01(section.intensity),
        confidence: clamp01(section.confidence ?? (section.source === 'auto' ? 0 : 1)),
        source: section.source ?? null,
        dropConfidence: clamp01(section.dropConfidence ?? 0),
        familyId: section.interpretation?.familyId ?? null,
        occurrenceIndex: Number.isFinite(section.interpretation?.occurrenceIndex)
          ? Math.max(1, Math.floor(section.interpretation?.occurrenceIndex ?? 1))
          : null,
      }))),
      clocks: clockFrame,
    }),
    impulses: eventSnapshot,
    lyrics: lyricSnapshot,
    performance: performanceSnapshot.frame,
    brand,
    capabilities: Object.freeze({
      analyser: analyserAvailable,
      musicIntelligence: musicIntelligenceAvailable,
      beatGrid: beatGridAvailable,
      authoritativeSections: authoritativeSectionsAvailable,
      lyrics: lyricsAvailable,
      brandKit: brand.available,
      sharedPerformance: sharedPerformanceAvailable,
      mediaAssets: input.mediaAssetsAvailable === true,
    }),
    activeCameraId: input.activeCameraId ?? null,
    camera: input.camera ?? null,
  })

  const state: Readonly<CinemaFrameBuilderState> = Object.freeze({
    version: CINEMA_FRAME_BUILDER_STATE_VERSION,
    frameIndex,
    trackIdentity,
    audioTimeSec,
    elapsedTimeSec,
    playing,
    paused,
    visibilitySuspended,
    clockIndices: Object.freeze(Object.fromEntries(
      CLOCK_IDS.map(id => [id, clockFrame.states[id].index]),
    ) as Record<CinemaMusicalClockId, number | null>),
    sectionIdentity,
    lyricLineIdentity: lyricSnapshot.lineId,
    lyricWordIdentity: lyricSnapshot.wordId,
    lastImpulseEventIds: Object.freeze({
      ...previous?.lastImpulseEventIds,
      ...Object.fromEntries(
        Object.entries(eventSnapshot.eventIds).filter((entry): entry is [keyof typeof EMPTY_EVENT_IDS, CinemaEventId] => entry[1] != null),
      ),
    }),
    lastPerformanceSequence: performanceSnapshot.lastSequence,
    resetGeneration: reset.generation,
  })

  return Object.freeze({ frame, state, diagnostics })
}

export function createCinemaDeterministicEventId(
  kind: string,
  trackIdentity: string | null,
  musicalPositionIdentity: string,
): CinemaEventId {
  const fingerprint = `v1|${normalizeIdentity(kind) ?? 'event'}|${trackIdentity ?? 'no-track'}|${musicalPositionIdentity}`
  return `cinema-event-${stableHashHex(fingerprint)}` as CinemaEventId
}

export function createCinemaDeterministicSeed(identity: string): number {
  return fnv1a32(identity, 0x811c9dc5)
}

function resolveDiscontinuityReasons(input: {
  previous: Readonly<CinemaFrameBuilderState> | null
  trackIdentity: string | null
  audioTimeSec: number
  durationSec: number | null
  playing: boolean
  paused: boolean
  visibilitySuspended: boolean
  seeking: boolean
  looped: boolean
  timingDiscontinuity: boolean
  deltaTimeSec: number
}): readonly CinemaFrameDiscontinuityReason[] {
  const reasons: CinemaFrameDiscontinuityReason[] = []
  const previous = input.previous
  if (!previous) return Object.freeze(['activation'])

  if (previous.trackIdentity !== input.trackIdentity) reasons.push('track-change')
  if (input.seeking) reasons.push('seek')
  if (input.looped) reasons.push('loop-wrap')
  if (previous.paused && !input.paused && input.playing) reasons.push('resume')
  if (previous.visibilitySuspended !== input.visibilitySuspended) reasons.push('visibility-suspension')

  const audioDeltaSec = input.audioTimeSec - previous.audioTimeSec
  if (previous.trackIdentity === input.trackIdentity && !input.looped && audioDeltaSec < -0.001) {
    const inferredLoop = input.durationSec != null
      && previous.audioTimeSec >= input.durationSec * 0.75
      && input.audioTimeSec <= input.durationSec * 0.25
    if (inferredLoop) reasons.push('loop-wrap')
    else if (previous.audioTimeSec > 1 && input.audioTimeSec <= 0.1) reasons.push('playback-restart')
    else reasons.push('backwards-time')
  }

  const allowedForwardDelta = Math.max(0.35, input.deltaTimeSec * 6 + 0.1)
  if (
    previous.trackIdentity === input.trackIdentity
    && !input.paused
    && !previous.paused
    && audioDeltaSec > allowedForwardDelta
  ) reasons.push('seek')

  if (input.timingDiscontinuity) reasons.push('timing-discontinuity')
  return Object.freeze(uniqueReasons(reasons))
}

function createResetSignal(
  previous: Readonly<CinemaFrameBuilderState> | null,
  trackIdentity: string | null,
  audioTimeSec: number,
  reasons: readonly CinemaFrameDiscontinuityReason[],
): Readonly<CinemaFrameResetSignal> {
  const required = reasons.length > 0
  const generation = (previous?.resetGeneration ?? 0) + (required ? 1 : 0)
  const actionIds = Object.freeze(reasons.map(resetActionForReason).filter(uniqueString))
  const identity = required
    ? `cinema-reset-${stableHashHex(`${trackIdentity ?? 'no-track'}|${audioTimeSec.toFixed(6)}|${generation}|${reasons.join('|')}`)}`
    : null
  return Object.freeze({
    required,
    reconstruct: required,
    generation,
    reasons,
    actionIds,
    identity,
  })
}

function resetActionForReason(reason: CinemaFrameDiscontinuityReason): CinemaStateResetActionId {
  switch (reason) {
    case 'activation': return CINEMA_STATE_RESET_ACTION_IDS.activation
    case 'track-change': return CINEMA_STATE_RESET_ACTION_IDS.trackChange
    case 'playback-restart': return CINEMA_STATE_RESET_ACTION_IDS.playbackRestart
    case 'seek':
    case 'backwards-time': return CINEMA_STATE_RESET_ACTION_IDS.seek
    case 'loop-wrap': return CINEMA_STATE_RESET_ACTION_IDS.loopWrap
    case 'resume': return CINEMA_STATE_RESET_ACTION_IDS.resume
    case 'visibility-suspension': return CINEMA_STATE_RESET_ACTION_IDS.visibilityRestore
    case 'timing-discontinuity': return CINEMA_STATE_RESET_ACTION_IDS.timingDiscontinuity
  }
}

function resolveBeatGridAvailability(
  mi: Readonly<MusicIntelligenceFrame> | null,
  frame: Readonly<ReactFrameContext>,
): boolean {
  if (mi?.capabilities) return mi.capabilities.beatGrid === true
  if (mi && mi.frameId > 0 && mi.rhythm.bpm > 0 && Number.isFinite(mi.rhythm.beatIndex)) return true
  return frame.bpm > 0 && Number.isFinite(frame.beatPhase)
}

function resolveMusicalPosition(
  mi: Readonly<MusicIntelligenceFrame> | null,
  frame: Readonly<ReactFrameContext>,
  audioTimeSec: number,
  beatGridAvailable: boolean,
): MusicalPositionSnapshot {
  const miAvailable = Boolean(mi && mi.frameId > 0)
  const bpm = positiveFiniteOrNull(miAvailable && mi!.rhythm.bpm > 0 ? mi!.rhythm.bpm : frame.bpm)
  if (miAvailable && beatGridAvailable && Number.isFinite(mi!.rhythm.beatIndex)) {
    const beatIndex = Math.max(0, Math.floor(mi!.rhythm.beatIndex))
    const beatPhase = clamp01(mi!.rhythm.beatPhase)
    const beatInBar = normalizeModulo(
      Number.isFinite(mi!.rhythm.beatInBar) ? Math.floor(mi!.rhythm.beatInBar) : beatIndex,
      4,
    )
    return {
      available: true,
      bpm,
      beatIndex,
      beatPhase,
      beatInBar,
      barIndex: Number.isFinite(mi!.rhythm.barIndex) ? Math.max(0, Math.floor(mi!.rhythm.barIndex)) : Math.floor(beatIndex / 4),
      phraseIndex: Math.floor(beatIndex / CLOCK_SPANS_BEATS.phrase),
      source: 'music-intelligence',
    }
  }

  if (bpm != null) {
    const beatPosition = Math.max(0, audioTimeSec * bpm / 60)
    const beatIndex = Math.floor(beatPosition)
    const fallbackPhase = clamp01(frame.beatPhase)
    const computedPhase = beatPosition - beatIndex
    const beatPhase = beatGridAvailable && Number.isFinite(frame.beatPhase)
      ? fallbackPhase
      : computedPhase
    return {
      available: true,
      bpm,
      beatIndex,
      beatPhase,
      beatInBar: normalizeModulo(beatIndex, 4),
      barIndex: Math.floor(beatIndex / 4),
      phraseIndex: Math.floor(beatIndex / CLOCK_SPANS_BEATS.phrase),
      source: beatGridAvailable ? 'react-frame' : 'bpm-derived',
    }
  }

  return {
    available: false,
    bpm: null,
    beatIndex: null,
    beatPhase: 0,
    beatInBar: null,
    barIndex: null,
    phraseIndex: null,
    source: 'unavailable',
  }
}

function buildClockFrame(input: {
  trackIdentity: string | null
  musicalPosition: MusicalPositionSnapshot
  previous: Readonly<CinemaFrameBuilderState> | null
  suppressImpulses: boolean
}): Readonly<CinemaMusicalClockFrame> {
  const states = {} as Record<CinemaMusicalClockId, CinemaClockFrame>
  const beatPosition = input.musicalPosition.beatIndex == null
    ? null
    : input.musicalPosition.beatIndex + input.musicalPosition.beatPhase

  for (const id of CLOCK_IDS) {
    const spanBeats = CLOCK_SPANS_BEATS[id]
    const index = beatPosition == null ? null : Math.floor(beatPosition / spanBeats)
    const phase = beatPosition == null ? 0 : fractional(beatPosition / spanBeats)
    const previousIndex = input.previous?.clockIndices[id] ?? null
    const hit = !input.suppressImpulses
      && index != null
      && previousIndex != null
      && index > previousIndex
    const eventId = index == null
      ? null
      : createCinemaDeterministicEventId(`clock-${id}`, input.trackIdentity, `${id}:${index}`)
    states[id] = Object.freeze({
      available: beatPosition != null,
      spanBeats,
      index,
      phase,
      hit,
      eventId,
    })
  }

  return Object.freeze({
    beat: states.beat.hit,
    beat2: states.beat2.hit,
    beat4: states.beat4.hit,
    bar: states.bar.hit,
    bar4: states.bar4.hit,
    bar8: states.bar8.hit,
    phrase: states.phrase.hit,
    states: Object.freeze(states),
  })
}

function resolveImpulseSnapshot(input: {
  trackIdentity: string | null
  audioTimeSec: number
  musicalPosition: MusicalPositionSnapshot
  clocks: Readonly<CinemaMusicalClockFrame>
  mi: Readonly<MusicIntelligenceFrame> | null
  resolvedSection: ResolvedSectionSnapshot | null
  previous: Readonly<CinemaFrameBuilderState> | null
  lyricPlayback: Readonly<LyricPlaybackState> | null
  lyricLineIdentity: string | null
  lyricWordIdentity: string | null
  suppressImpulses: boolean
}): Readonly<CinemaFrameContext['impulses']> {
  const musicalIdentity = createMusicalPositionIdentity(input.musicalPosition, input.audioTimeSec)
  const eventIds: Record<keyof typeof EMPTY_EVENT_IDS, CinemaEventId | null> = { ...EMPTY_EVENT_IDS }
  const canEmit = !input.suppressImpulses && input.previous != null

  eventIds.beat = input.clocks.states.beat.eventId
  const beat = canEmit && input.clocks.beat
  const downbeatId = input.musicalPosition.barIndex == null
    ? null
    : createCinemaDeterministicEventId('downbeat', input.trackIdentity, `bar:${input.musicalPosition.barIndex}`)
  const downbeat = beat && input.musicalPosition.beatInBar === 0
  eventIds.downbeat = downbeatId

  const kickRaw = input.mi?.rhythm.kickHit === true
  const snareRaw = input.mi?.rhythm.snareHit === true
  const transientRaw = (input.mi?.rhythm.transient ?? 0) > 0.05 || kickRaw || snareRaw || input.mi?.rhythm.hatHit === true
  const kickId = kickRaw ? createCinemaDeterministicEventId('kick', input.trackIdentity, musicalIdentity) : null
  const snareId = snareRaw ? createCinemaDeterministicEventId('snare', input.trackIdentity, musicalIdentity) : null
  const transientId = transientRaw ? createCinemaDeterministicEventId('transient', input.trackIdentity, musicalIdentity) : null
  eventIds.kick = kickId
  eventIds.snare = snareId
  eventIds.transient = transientId

  const sectionChanged = canEmit
    && input.resolvedSection != null
    && input.resolvedSection.id !== input.previous?.sectionIdentity
  const sectionId = input.resolvedSection
    ? createCinemaDeterministicEventId('section', input.trackIdentity, `${input.resolvedSection.id}:${input.resolvedSection.startSec.toFixed(3)}`)
    : null
  eventIds.sectionStart = sectionId
  const dropSection = input.resolvedSection?.type?.toLowerCase().includes('drop') === true
  eventIds.dropStart = dropSection ? sectionId : null

  const lyricLineEntered = input.lyricPlayback
    ? input.lyricPlayback.events.lineEnter != null
    : input.lyricLineIdentity != null && input.lyricLineIdentity !== input.previous?.lyricLineIdentity
  const lyricWordEntered = input.lyricPlayback
    ? input.lyricPlayback.events.wordEnter != null
    : input.lyricWordIdentity != null && input.lyricWordIdentity !== input.previous?.lyricWordIdentity
  const lyricCueId = input.lyricLineIdentity == null
    ? null
    : createCinemaDeterministicEventId('lyric-line', input.trackIdentity, input.lyricLineIdentity)
  const lyricWordId = input.lyricWordIdentity == null
    ? null
    : createCinemaDeterministicEventId('lyric-word', input.trackIdentity, `${input.lyricLineIdentity ?? 'no-line'}:${input.lyricWordIdentity}`)
  eventIds.lyricCue = lyricCueId
  eventIds.lyricWord = lyricWordId
  const phrase4Raw = input.mi?.rhythm.phrase4Hit === true || input.clocks.beat4
  const phrase8Index = input.musicalPosition.beatIndex == null
    ? null
    : Math.floor(input.musicalPosition.beatIndex / 8)
  const phrase8Raw = input.mi?.rhythm.phrase8Hit === true
    || (input.clocks.beat && input.musicalPosition.beatIndex != null && input.musicalPosition.beatIndex % 8 === 0)
  eventIds.phrase4 = input.clocks.states.beat4.eventId
  eventIds.phrase8 = phrase8Index == null
    ? null
    : createCinemaDeterministicEventId('phrase-8', input.trackIdentity, `phrase8:${phrase8Index}`)

  const deduped = <K extends keyof typeof EMPTY_EVENT_IDS>(key: K, raw: boolean): boolean => {
    const eventId = eventIds[key]
    return canEmit
      && raw
      && eventId != null
      && input.previous?.lastImpulseEventIds[key] !== eventId
  }

  return Object.freeze({
    beat: deduped('beat', beat),
    downbeat: deduped('downbeat', downbeat),
    kick: deduped('kick', kickRaw),
    snare: deduped('snare', snareRaw),
    transient: deduped('transient', transientRaw),
    sectionStart: deduped('sectionStart', sectionChanged),
    dropStart: deduped('dropStart', sectionChanged && dropSection),
    lyricCue: deduped('lyricCue', lyricLineEntered),
    lyricWord: deduped('lyricWord', lyricWordEntered),
    phrase4: deduped('phrase4', phrase4Raw),
    phrase8: deduped('phrase8', phrase8Raw),
    eventIds: Object.freeze(eventIds),
  })
}

function resolveSectionSnapshot(
  frame: Readonly<ReactFrameContext>,
  mi: Readonly<MusicIntelligenceFrame> | null,
  sections: readonly ReactTrackSection[],
  audioTimeSec: number,
): ResolvedSectionSnapshot | null {
  const explicit = frame.resolvedSection ?? mi?.currentResolvedSection ?? null
  if (explicit) {
    return normalizeSectionSnapshot({
      id: explicit.id,
      type: explicit.type,
      startSec: explicit.startSec,
      endSec: explicit.endSec,
      progress: explicit.progress,
    })
  }

  const authoritative = sections.find(section => audioTimeSec >= section.startSec && audioTimeSec < section.endSec)
  if (authoritative) {
    const duration = authoritative.endSec - authoritative.startSec
    return normalizeSectionSnapshot({
      id: authoritative.id,
      type: authoritative.type,
      startSec: authoritative.startSec,
      endSec: authoritative.endSec,
      progress: duration > 0 ? (audioTimeSec - authoritative.startSec) / duration : 0,
    })
  }

  if (mi?.section.type != null && mi.section.endSec > mi.section.startSec) {
    return normalizeSectionSnapshot({
      id: undefined,
      type: mi.section.type,
      startSec: mi.section.startSec,
      endSec: mi.section.endSec,
      progress: mi.section.progress,
    })
  }
  return null
}

function normalizeSectionSnapshot(section: {
  id?: string
  type: string | null
  startSec: number
  endSec: number
  progress: number
}): ResolvedSectionSnapshot | null {
  const startSec = nonNegativeFinite(section.startSec)
  const endSec = finiteOr(section.endSec, startSec)
  if (!(endSec > startSec)) return null
  const type = normalizeIdentity(section.type)
  const id = normalizeIdentity(section.id)
    ?? `section-${Math.round(startSec * 1000)}-${stableHashHex(`${type ?? 'unknown'}|${endSec.toFixed(3)}`).slice(0, 8)}`
  return {
    id,
    type,
    startSec,
    endSec,
    progress: clamp01(section.progress),
  }
}

function resolveLyricSnapshot(
  playback: Readonly<LyricPlaybackState> | null,
  mi: Readonly<MusicIntelligenceFrame> | null,
): Readonly<CinemaFrameContext['lyrics']> {
  if (playback) {
    const lineId = playback.activeCue?.id ?? null
    const wordId = playback.activeWord?.id ?? null
    const lineDurationSec = playback.effectiveCueStartMs != null && playback.effectiveCueEndMs != null
      ? Math.max(0, (playback.effectiveCueEndMs - playback.effectiveCueStartMs) / 1000)
      : 0
    const wordCount = playback.activeCue?.words?.length
      ?? playback.activeCue?.text.trim().split(/\s+/).filter(Boolean).length
      ?? 0
    const lineActive = playback.activeCue != null
    return Object.freeze({
      available: playback.documentId != null || playback.sourceIdentity != null || playback.timelineRevision > 0,
      sourceIdentity: playback.sourceIdentity,
      lineId,
      lineText: playback.activeCue?.text ?? null,
      wordId,
      wordText: playback.activeWord?.text ?? null,
      lineProgress: clamp01(playback.cueProgress),
      wordProgress: clamp01(playback.wordProgress),
      lineStarted: playback.events.lineEnter != null,
      lineEnded: playback.events.lineExit != null,
      wordChanged: playback.events.wordEnter != null,
      lineActive,
      lineAbsent: !lineActive,
      density: clamp01(lineDurationSec > 0 ? (wordCount / lineDurationSec) / 4 : 0),
      lineDurationSec,
      vocalsActive: lineActive,
    })
  }

  const lyrics = mi?.lyrics
  const lineId = lyrics?.activeLineId ?? (lyrics?.activeLine ? `mi-line-${stableHashHex(lyrics.activeLine)}` : null)
  const wordId = lyrics?.activeWordId ?? (lyrics?.activeWord ? `mi-word-${stableHashHex(`${lineId ?? ''}|${lyrics.activeWord}`)}` : null)
  const available = Boolean(mi?.capabilities?.lyrics || lineId || wordId)
  const lineActive = lineId != null || lyrics?.activeLine != null
  const words = lyrics?.activeLine?.trim().split(/\s+/).filter(Boolean).length ?? 0
  return Object.freeze({
    available,
    sourceIdentity: mi?.sourceId ?? mi?.trackId ?? null,
    lineId,
    lineText: lyrics?.activeLine ?? null,
    wordId,
    wordText: lyrics?.activeWord ?? null,
    lineProgress: clamp01(lyrics?.lyricLineProgress ?? 0),
    wordProgress: clamp01(lyrics?.wordProgress ?? 0),
    lineStarted: lyrics?.lineEnter === true,
    lineEnded: lyrics?.lineExit === true,
    wordChanged: lyrics?.wordHit === true,
    lineActive,
    lineAbsent: !lineActive,
    density: clamp01(words / 16),
    lineDurationSec: 0,
    vocalsActive: (lyrics?.vocalActivity ?? 0) > 0.05,
  })
}

function resolvePerformanceSnapshot(
  performance: Readonly<CinemaFramePerformanceInput> | null | undefined,
  previous: Readonly<CinemaFrameBuilderState> | null,
): {
  frame: Readonly<CinemaFrameContext['performance']>
  lastSequence: number
} {
  const events = [...(performance?.events ?? [])]
    .filter(event => Number.isFinite(event.sequence) && event.sequence > (previous?.lastPerformanceSequence ?? -1))
    .sort((left, right) => left.sequence - right.sequence)
  const normalizedEvents = Object.freeze(events.map(event => Object.freeze({
    actionId: event.actionId as CinemaActionId,
    sequence: event.sequence,
  })))
  const actionIds = Object.freeze(normalizedEvents.map(event => event.actionId))
  const toggleStates = Object.freeze(Object.fromEntries(
    Object.entries(performance?.toggleStates ?? {}).map(([id, value]) => [id as CinemaActionId, value === true]),
  ) as Partial<Record<CinemaActionId, boolean>>)
  const lastSequence = Math.max(
    previous?.lastPerformanceSequence ?? -1,
    ...((performance?.events ?? []).map(event => Number.isFinite(event.sequence) ? event.sequence : -1)),
  )
  return {
    frame: Object.freeze({ events: normalizedEvents, actionIds, toggleStates }),
    lastSequence,
  }
}

function normalizeBrandFrame(brandInput: Readonly<CinemaFrameBrandInput> | null | undefined): Readonly<CinemaBrandFrame> {
  const colors = Object.freeze({ ...(brandInput?.colors ?? {}) })
  return Object.freeze({
    available: brandInput?.available === true || Object.keys(colors).length > 0,
    colors,
  })
}

function normalizeAudioFrame(
  frame: Readonly<ReactFrameContext>,
  mi: Readonly<MusicIntelligenceFrame> | null,
  available: boolean,
): Readonly<CinemaFrameContext['audio']> {
  const miAvailable = Boolean(mi && mi.frameId > 0)
  const frequency = available ? (frame.freqData ?? mi?.raw.freqData ?? null) : null
  const waveform = available ? (frame.timeDomainData ?? mi?.raw.timeDomainData ?? null) : null
  const useReactSummary = available && !miAvailable
  const rms = miAvailable ? clamp01(mi!.energy.rms) : calculateByteWaveformRms(waveform)
  const volume = clamp01(miAvailable ? mi!.bands.volume : useReactSummary ? frame.audio.volume : 0)
  const mid = clamp01(miAvailable ? (mi!.bands.lowMid + mi!.bands.mid) * 0.5 : useReactSummary ? frame.audio.mid : 0)
  return Object.freeze({
    available,
    volume,
    rms,
    energy: clamp01(miAvailable ? mi!.energy.instant : Math.max(volume, rms)),
    bass: clamp01(miAvailable ? mi!.bands.bass : useReactSummary ? frame.audio.bass : 0),
    mid,
    high: clamp01(miAvailable ? (mi!.bands.high + mi!.bands.air) * 0.5 : useReactSummary ? frame.audio.high : 0),
    sub: clamp01(miAvailable ? mi!.bands.sub : useReactSummary ? frame.audio.bass : 0),
    centroid: clamp01(miAvailable ? mi!.energy.spectralCentroid : 0),
    flux: clamp01(miAvailable ? mi!.energy.spectralFlux : 0),
    harmonicity: clamp01(miAvailable ? 1 - mi!.energy.spectralFlatness : 0),
    complexity: clamp01(miAvailable ? mi!.energy.complexity : 0),
    tension: clamp01(miAvailable ? mi!.energy.tension : 0),
    buildProgress: clamp01(miAvailable ? Math.max(mi!.energy.buildProgress, mi!.semantics.buildConfidence) : 0),
    dropImpact: clamp01(miAvailable ? Math.max(mi!.energy.dropImpact, mi!.semantics.dropConfidence) : 0),
    vocalPresence: clamp01(miAvailable ? Math.max(mi!.stems.vocalActivity, mi!.lyrics.vocalActivity) : 0),
    fft: frequency,
    waveform,
  })
}

function createFrameDiagnostics(input: {
  analyserAvailable: boolean
  musicIntelligenceAvailable: boolean
  beatGridAvailable: boolean
  authoritativeSectionsAvailable: boolean
  lyricsAvailable: boolean
  trackIdentity: string | null
}): CinemaDiagnosticSnapshot {
  const diagnostics: CinemaDiagnostic[] = []
  if (!input.analyserAvailable) diagnostics.push(createCinemaDiagnostic({
    code: 'CINEMA_ANALYSER_UNAVAILABLE',
    severity: 'info',
    message: 'Cinema normalized the frame with neutral analyser values because no analyser buffers were available.',
    attribution: { stage: 'normalized-frame' },
    details: { trackId: input.trackIdentity },
  }))
  if (!input.musicIntelligenceAvailable) diagnostics.push(createCinemaDiagnostic({
    code: 'CINEMA_MUSIC_INTELLIGENCE_UNAVAILABLE',
    severity: 'info',
    message: 'Cinema normalized the frame without a populated Music Intelligence snapshot.',
    attribution: { stage: 'normalized-frame' },
    details: { trackId: input.trackIdentity },
  }))
  if (!input.beatGridAvailable) diagnostics.push(createCinemaDiagnostic({
    code: 'CINEMA_CAPABILITY_UNAVAILABLE',
    severity: 'info',
    message: 'A reliable beat grid is unavailable; musical clocks use BPM-derived timing when possible.',
    attribution: { stage: 'normalized-frame' },
    details: { capability: 'beatGrid', trackId: input.trackIdentity },
  }))
  if (!input.authoritativeSectionsAvailable) diagnostics.push(createCinemaDiagnostic({
    code: 'CINEMA_CAPABILITY_UNAVAILABLE',
    severity: 'info',
    message: 'No authoritative track-section timeline is available for this frame.',
    attribution: { stage: 'normalized-frame' },
    details: { capability: 'authoritativeSections', trackId: input.trackIdentity },
  }))
  if (!input.lyricsAvailable) diagnostics.push(createCinemaDiagnostic({
    code: 'CINEMA_LYRICS_UNAVAILABLE',
    severity: 'info',
    message: 'Cinema normalized the frame with neutral lyric values because no timed lyrics were available.',
    attribution: { stage: 'normalized-frame' },
    details: { trackId: input.trackIdentity },
  }))
  return createCinemaDiagnosticSnapshot(diagnostics)
}

function createMusicalPositionIdentity(position: MusicalPositionSnapshot, audioTimeSec: number): string {
  if (position.beatIndex != null) {
    const phaseBucket = Math.floor(clamp01(position.beatPhase) * 64)
    return `beat:${position.beatIndex}:phase:${phaseBucket}`
  }
  return `time-ms:${Math.round(audioTimeSec * 1000)}`
}

function calculateByteWaveformRms(data: Uint8Array | null): number {
  if (!data || data.length === 0) return 0
  let sumSquares = 0
  for (let index = 0; index < data.length; index += 1) {
    const normalized = (data[index] - 128) / 128
    sumSquares += normalized * normalized
  }
  return clamp01(Math.sqrt(sumSquares / data.length))
}

function normalizeTrackIdentity(value: unknown): string | null {
  const identity = normalizeIdentity(value)
  return identity && identity !== 'none' ? identity : null
}

function normalizeIdentity(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function stableHashHex(value: string): string {
  const first = fnv1a32(value, 0x811c9dc5).toString(16).padStart(8, '0')
  const second = fnv1a32(value, 0x9e3779b9).toString(16).padStart(8, '0')
  return `${first}${second}`
}

function fnv1a32(value: string, seed: number): number {
  let hash = seed >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function clamp01(value: number): number {
  return clamp(finiteOr(value, 0), 0, 1)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteOr(value: number | undefined | null, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nonNegativeFinite(value: number | undefined | null): number {
  return Math.max(0, finiteOr(value, 0))
}

function positiveFiniteOrNull(value: number | undefined | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function fractional(value: number): number {
  return value - Math.floor(value)
}

function normalizeModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function uniqueReasons(reasons: readonly CinemaFrameDiscontinuityReason[]): CinemaFrameDiscontinuityReason[] {
  return reasons.filter((reason, index) => reasons.indexOf(reason) === index)
}

function uniqueString(value: CinemaStateResetActionId, index: number, values: CinemaStateResetActionId[]): boolean {
  return values.indexOf(value) === index
}
