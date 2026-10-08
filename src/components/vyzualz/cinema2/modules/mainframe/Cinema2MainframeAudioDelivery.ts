import type { Cinema2AudioIntelligenceFrame, Cinema2AudioSignal } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'

type Audio = Readonly<Cinema2AudioIntelligenceFrame>

/** A bridge snapshot is not proof of music: the bus also publishes empty/reset snapshots. */
export function selectCinema2MainframeAudio(
  audio: Audio | null,
  transportTrackId?: string | null,
): Audio | null {
  if (!audio || !audio.upstream || !Number.isFinite(audio.upstream.frameId)
    || audio.upstream.frameId <= 0 || audio.upstream.publicationKind === 'reset') return null
  // The real bridge always supplies these containers, even when individual
  // capabilities are unavailable. Reject truncated data before event consumers read it.
  if (!audio.bands || !audio.features || !audio.rhythm?.fixedClocks?.[4]
    || !audio.rhythm.fixedClocks[8] || !audio.rhythm.fixedClocks[16]
    || !audio.structure?.analyzedPhrases || !audio.structure.semanticMoments) return null
  // Rekordbox and local-file playback may identify the same track by its source ID.
  if (transportTrackId != null && audio.upstream.trackId != null
    && audio.upstream.trackId !== transportTrackId && audio.upstream.sourceId !== transportTrackId) return null
  const numeric = (signal: Readonly<Cinema2AudioSignal<number>> | undefined) => signal?.available === true && typeof signal.value === 'number' && Number.isFinite(signal.value)
  const signals = [
    audio.bands?.sub, audio.bands?.bass, audio.bands?.lowMid, audio.bands?.mid, audio.bands?.high, audio.bands?.air,
    audio.features?.overallEnergy, audio.features?.spectralFlux, audio.features?.vocalPresence, audio.features?.buildProgress,
    audio.structure?.buildConfidence,
    audio.rhythm?.beatPhase, audio.rhythm?.beatIndex,
  ]
  const events = audio.rhythm && (audio.rhythm.beat || audio.rhythm.kick || audio.rhythm.snare || audio.rhythm.downbeat
    || audio.rhythm.fixedClocks?.[4]?.boundary || audio.rhythm.fixedClocks?.[8]?.boundary || audio.rhythm.fixedClocks?.[16]?.boundary)
  const structure = (audio.structure?.analyzedPhrases?.available && audio.structure.analyzedPhrases.value?.length)
    || (audio.structure?.semanticMoments?.available && audio.structure.semanticMoments.value?.length)
  return signals.some(numeric) || events || structure ? audio : null
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
