import type { Cinema2AudioIntelligenceFrame, Cinema2AudioSignal } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'

type Audio = Readonly<Cinema2AudioIntelligenceFrame>

export type Cinema2MainframeAudioSelectionReason =
  | 'accepted'
  | 'missing-frame'
  | 'invalid-upstream'
  | 'reset-publication'
  | 'incomplete-containers'
  | 'incomplete-fixed-clocks'
  | 'incomplete-structure'
  | 'track-identity-mismatch'
  | 'no-usable-content'

export interface Cinema2MainframeAudioSelectionDiagnostic {
  readonly accepted: boolean
  readonly reason: Cinema2MainframeAudioSelectionReason
}

/** Explains the exact delivery gate without changing or manufacturing audio data. */
export function diagnoseCinema2MainframeAudio(
  audio: Audio | null,
  transportTrackId?: string | null,
): Readonly<Cinema2MainframeAudioSelectionDiagnostic> {
  if (!audio) return Object.freeze({ accepted: false, reason: 'missing-frame' })
  if (!audio.upstream || !Number.isFinite(audio.upstream.frameId) || audio.upstream.frameId <= 0) {
    return Object.freeze({ accepted: false, reason: 'invalid-upstream' })
  }
  if (audio.upstream.publicationKind === 'reset') return Object.freeze({ accepted: false, reason: 'reset-publication' })
  if (!audio.bands || !audio.features || !audio.rhythm || !audio.structure) {
    return Object.freeze({ accepted: false, reason: 'incomplete-containers' })
  }
  if (!audio.rhythm.fixedClocks?.[4] || !audio.rhythm.fixedClocks[8] || !audio.rhythm.fixedClocks[16]) {
    return Object.freeze({ accepted: false, reason: 'incomplete-fixed-clocks' })
  }
  if (!audio.structure.analyzedPhrases || !audio.structure.semanticMoments) {
    return Object.freeze({ accepted: false, reason: 'incomplete-structure' })
  }
  if (transportTrackId != null && audio.upstream.trackId != null
    && audio.upstream.trackId !== transportTrackId && audio.upstream.sourceId !== transportTrackId) {
    return Object.freeze({ accepted: false, reason: 'track-identity-mismatch' })
  }
  const numeric = (signal: Readonly<Cinema2AudioSignal<number>> | undefined) => signal?.available === true && typeof signal.value === 'number' && Number.isFinite(signal.value)
  const signals = [
    audio.bands.sub, audio.bands.bass, audio.bands.lowMid, audio.bands.mid, audio.bands.high, audio.bands.air,
    audio.features.overallEnergy, audio.features.spectralFlux, audio.features.vocalPresence, audio.features.buildProgress,
    audio.structure.buildConfidence, audio.structure.dropConfidence,
    audio.rhythm.beatPhase, audio.rhythm.beatIndex,
  ]
  const events = audio.rhythm.beat || audio.rhythm.kick || audio.rhythm.snare || audio.rhythm.downbeat || audio.rhythm.transient
    || audio.rhythm.fixedClocks[4].boundary || audio.rhythm.fixedClocks[8].boundary || audio.rhythm.fixedClocks[16].boundary
  const structure = (audio.structure.analyzedPhrases.available && audio.structure.analyzedPhrases.value?.length)
    || (audio.structure.semanticMoments.available && audio.structure.semanticMoments.value?.length)
    || (audio.structure.section?.available && audio.structure.section.value != null)
  return signals.some(numeric) || events || structure
    ? Object.freeze({ accepted: true, reason: 'accepted' })
    : Object.freeze({ accepted: false, reason: 'no-usable-content' })
}

/** A bridge snapshot is not proof of music: the bus also publishes empty/reset snapshots. */
export function selectCinema2MainframeAudio(
  audio: Audio | null,
  transportTrackId?: string | null,
): Audio | null {
  return diagnoseCinema2MainframeAudio(audio, transportTrackId).accepted ? audio : null
}

export type Cinema2MainframePlaybackState = 'playing' | 'paused' | 'stopped'

/** Playback, analysis availability, and rendering are independent authorities. */
export function resolveCinema2MainframePlaybackState(frame: Readonly<Cinema2ModuleFrameReadContext>, audio: Audio | null): Cinema2MainframePlaybackState {
  const transport = frame.transport
  if (transport?.paused === true) return transport.sourcePresent || transport.trackId != null || audio ? 'paused' : 'stopped'
  if (transport?.playing === false) return 'stopped'
  // An isolated host without a transport provider can still run from a real audio frame.
  return audio && (transport == null || transport.playing === true || transport.analysisActive === true) ? 'playing' : 'stopped'
}

export function resolveCinema2MainframeSourceIdentity(frame: Readonly<Cinema2ModuleFrameReadContext>, audio: Audio | null): string {
  const upstream = audio?.upstream
  return JSON.stringify([frame.transport?.trackId ?? null, upstream?.trackId ?? null, upstream?.sourceId ?? null, upstream?.publisherId ?? null])
}
