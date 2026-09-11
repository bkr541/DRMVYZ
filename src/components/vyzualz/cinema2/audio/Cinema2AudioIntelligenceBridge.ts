import {
  AudioFeatureBus,
  type AudioFeatureBusPublicationKind,
  type AudioFeatureBusPublicationMeta,
} from '../../../../features/musicIntelligence/AudioFeatureBus'
import type {
  MusicIntelligenceFrame,
  PhraseMarker,
  SemanticMomentMarker,
} from '../../../../features/musicIntelligence/types'
import type { Cinema2CapabilityId } from '../contracts/Cinema2NativePresetManifest'

export const CINEMA2_AUDIO_INTELLIGENCE_FRAME_VERSION = 1 as const

/**
 * Service-level capabilities supplied by the Cinema 2.0 audio bridge. Individual
 * snapshots still report whether the active source actually provides each
 * optional datum. Service availability must never be mistaken for value
 * availability.
 */
export const CINEMA2_AUDIO_INTELLIGENCE_RUNTIME_CAPABILITIES = Object.freeze([
  'audio.transport',
  'audio.bands',
  'audio.features',
  'music.beat',
  'music.downbeat',
  'music.bar',
  'music.phrase',
  'music.section',
  'music.vocal-presence',
  'music.build',
  'music.drop',
] satisfies readonly Cinema2CapabilityId[])

export type Cinema2AudioDiscontinuityReason =
  | 'activation'
  | 'source-change'
  | 'bus-reset'
  | 'restart'
  | 'seek'
  | 'upstream-frame-rewind'

export interface Cinema2AudioSignalProvenance {
  analysisRevision: string | null
  timelineRevision: string | null
  analysisSource: string | null
  featureSource: string | null
  trackOrigin: string | null
  authority: string | null
  publisherId: string | null
}

export interface Cinema2AudioSignal<T> {
  /** False means the value is not authoritative for this snapshot. */
  available: boolean
  /** Null only when unavailable or when the structured value itself is optional. */
  value: T | null
  confidence: number | null
  source: string | null
  provenance: Readonly<Cinema2AudioSignalProvenance> | null
}

export interface Cinema2AudioEvent {
  id: string
  kind: 'beat' | 'downbeat' | 'kick' | 'snare' | 'transient'
  timeSec: number
  strength: number
  confidence: number | null
  source: string | null
  upstreamIdentity: string
}

export interface Cinema2AudioFixedClock {
  lengthBeats: 4 | 8 | 16 | 32
  progress: number
  boundary: Readonly<Cinema2AudioEvent> | null
}

export interface Cinema2AudioAnalyzedPhrase {
  id: string
  timeSec: number
  lengthBars: 4 | 8 | 16 | 32
  barIndex: number | null
  confidence: number
  source: string | null
  relatedSectionId: string | null
  structurallyDetected: boolean | null
}

export interface Cinema2AudioSection {
  id: string
  label: string
  type: string | null
  startSec: number
  endSec: number
  progress: number
  intensity: number
  confidence: number
  source: string | null
  authority: string | null
  dropConfidence: number | null
}

export interface Cinema2AudioSemanticMoment {
  id: string
  timeSec: number
  durationSec: number | null
  barIndex: number | null
  type: SemanticMomentMarker['type']
  confidence: number
  source: string | null
  relatedSectionId: string | null
}

export interface Cinema2AudioStemSnapshot {
  vocals: number
  drums: number
  bass: number
  instruments: number
  other: number
  vocalActivity: number
  drumTransient: boolean
  bassTransient: boolean
}

export interface Cinema2AudioLyricsSnapshot {
  activeLine: string | null
  activeLineId: string | null
  activeWord: string | null
  activeWordId: string | null
  previousLine: string | null
  nextLine: string | null
  vocalActivity: number
  phraseConfidence: number
  lineProgress: number
  wordProgress: number
  wordHit: boolean
  lineEnter: boolean
  lineExit: boolean
  isGap: boolean
  lineEventId: string | null
  wordEventId: string | null
}

export interface Cinema2AudioHarmonicSnapshot {
  key: string | null
  mode: 'major' | 'minor' | null
  keyConfidence: number
  chord: string | null
  chordConfidence: number
  chordChanged: boolean
  rootNote: string | null
  pitchHz: number | null
  note: string | null
  melodyContour: string | null
}

export interface Cinema2AudioIntelligenceCapabilities {
  bands: boolean
  rhythmEvents: boolean
  beatGrid: boolean
  sections: boolean
  trackEnergyCurve: boolean
  stems: boolean
  lyrics: boolean
  harmonics: boolean
  spectralCentroid: boolean
  analyzedPhrases: boolean
  semanticMoments: boolean
  structuralSemantics: boolean
}

export interface Cinema2AudioIntelligenceFrame {
  version: typeof CINEMA2_AUDIO_INTELLIGENCE_FRAME_VERSION
  visualFrameId: number
  /** Cinema 2.0 consumes upstream smoothing as-is and performs no hidden smoothing here. */
  smoothingOwnership: 'upstream-music-intelligence'
  upstream: Readonly<{
    frameId: number
    publicationSequence: number
    publicationKind: AudioFeatureBusPublicationKind
    publishedAtMs: number
    publisherId: string | null
    sourceId: string | null
    trackId: string | null
    timeSec: number
    sampleRate: number
    analysisRevision: string | null
    timelineRevision: string | null
  }>
  capabilities: Readonly<Cinema2AudioIntelligenceCapabilities>
  discontinuity: Readonly<{
    occurred: boolean
    id: string | null
    generation: number
    reason: Cinema2AudioDiscontinuityReason | null
  }>
  bands: Readonly<{
    sub: Readonly<Cinema2AudioSignal<number>>
    bass: Readonly<Cinema2AudioSignal<number>>
    lowMid: Readonly<Cinema2AudioSignal<number>>
    mid: Readonly<Cinema2AudioSignal<number>>
    high: Readonly<Cinema2AudioSignal<number>>
    air: Readonly<Cinema2AudioSignal<number>>
  }>
  features: Readonly<{
    overallEnergy: Readonly<Cinema2AudioSignal<number>>
    rms: Readonly<Cinema2AudioSignal<number>>
    spectralCentroid: Readonly<Cinema2AudioSignal<number>>
    spectralFlux: Readonly<Cinema2AudioSignal<number>>
    transientEnergy: Readonly<Cinema2AudioSignal<number>>
    vocalPresence: Readonly<Cinema2AudioSignal<number>>
    tension: Readonly<Cinema2AudioSignal<number>>
    complexity: Readonly<Cinema2AudioSignal<number>>
    buildProgress: Readonly<Cinema2AudioSignal<number>>
    trackEnergy: Readonly<Cinema2AudioSignal<number>>
  }>
  rhythm: Readonly<{
    bpm: Readonly<Cinema2AudioSignal<number>>
    beatPhase: Readonly<Cinema2AudioSignal<number>>
    beatIndex: Readonly<Cinema2AudioSignal<number>>
    beatInBar: Readonly<Cinema2AudioSignal<number>>
    barIndex: Readonly<Cinema2AudioSignal<number>>
    beat: Readonly<Cinema2AudioEvent> | null
    downbeat: Readonly<Cinema2AudioEvent> | null
    kick: Readonly<Cinema2AudioEvent> | null
    snare: Readonly<Cinema2AudioEvent> | null
    transient: Readonly<Cinema2AudioEvent> | null
    fixedClocks: Readonly<Record<4 | 8 | 16 | 32, Readonly<Cinema2AudioFixedClock>>>
  }>
  structure: Readonly<{
    analyzedPhrases: Readonly<Cinema2AudioSignal<readonly Readonly<Cinema2AudioAnalyzedPhrase>[]>>
    section: Readonly<Cinema2AudioSignal<Readonly<Cinema2AudioSection>>>
    semanticMoments: Readonly<Cinema2AudioSignal<readonly Readonly<Cinema2AudioSemanticMoment>[]>>
    buildConfidence: Readonly<Cinema2AudioSignal<number>>
    dropConfidence: Readonly<Cinema2AudioSignal<number>>
  }>
  stems: Readonly<Cinema2AudioSignal<Readonly<Cinema2AudioStemSnapshot>>>
  lyrics: Readonly<Cinema2AudioSignal<Readonly<Cinema2AudioLyricsSnapshot>>>
  harmonic: Readonly<Cinema2AudioSignal<Readonly<Cinema2AudioHarmonicSnapshot>>>
}

export interface Cinema2AudioIntelligenceSource {
  getFrame(): Readonly<MusicIntelligenceFrame>
  getPublicationMeta(): Readonly<AudioFeatureBusPublicationMeta>
}

export interface Cinema2AudioIntelligenceBridgeDiagnostics {
  createdBridgeCount: number
  captureCount: number
  lastCapturedSourceFrameId: number
  lastCapturedPublicationSequence: number
}

interface PreviousCaptureIdentity {
  sourceKey: string
  timeSec: number
  frameId: number
  publicationSequence: number
}

const diagnostics: Cinema2AudioIntelligenceBridgeDiagnostics = {
  createdBridgeCount: 0,
  captureCount: 0,
  lastCapturedSourceFrameId: 0,
  lastCapturedPublicationSequence: 0,
}

const DEFAULT_SOURCE: Cinema2AudioIntelligenceSource = {
  getFrame: () => AudioFeatureBus.getFrame(),
  getPublicationMeta: () => AudioFeatureBus.getPublicationMeta(),
}

const FIXED_CLOCK_LENGTHS = [4, 8, 16, 32] as const

export function getCinema2AudioIntelligenceBridgeDiagnostics(): Readonly<Cinema2AudioIntelligenceBridgeDiagnostics> {
  return { ...diagnostics }
}

/**
 * Stateful read-only adapter from canonical Music Intelligence into Cinema 2.0.
 * It samples the upstream bus once per requested visual frame, clones only the
 * durable data Cinema 2.0 needs, owns discontinuity identity, and never performs
 * analysis, smoothing, choreography or visual significance decisions.
 */
export class Cinema2AudioIntelligenceBridge {
  private previousIdentity: PreviousCaptureIdentity | null = null
  private lastVisualFrameId: number | null = null
  private lastSnapshot: Readonly<Cinema2AudioIntelligenceFrame> | null = null
  private discontinuityGeneration = 0

  constructor(private readonly source: Cinema2AudioIntelligenceSource = DEFAULT_SOURCE) {
    diagnostics.createdBridgeCount += 1
  }

  capture(visualFrameId: number): Readonly<Cinema2AudioIntelligenceFrame> {
    const safeVisualFrameId = nonNegativeInteger(visualFrameId)
    if (this.lastSnapshot && this.lastVisualFrameId === safeVisualFrameId) return this.lastSnapshot

    const upstreamFrame = this.source.getFrame()
    const publication = this.source.getPublicationMeta()
    const snapshot = buildSnapshot({
      frame: upstreamFrame,
      publication,
      visualFrameId: safeVisualFrameId,
      previous: this.previousIdentity,
      discontinuityGeneration: this.discontinuityGeneration,
    })

    this.discontinuityGeneration = snapshot.discontinuity.generation
    this.previousIdentity = {
      sourceKey: sourceKey(upstreamFrame),
      timeSec: finiteNonNegative(upstreamFrame.timeSec),
      frameId: nonNegativeInteger(upstreamFrame.frameId),
      publicationSequence: nonNegativeInteger(publication.sequence),
    }
    this.lastVisualFrameId = safeVisualFrameId
    this.lastSnapshot = snapshot
    diagnostics.captureCount += 1
    diagnostics.lastCapturedSourceFrameId = snapshot.upstream.frameId
    diagnostics.lastCapturedPublicationSequence = snapshot.upstream.publicationSequence
    return snapshot
  }

  getLastSnapshot(): Readonly<Cinema2AudioIntelligenceFrame> | null {
    return this.lastSnapshot
  }

  reset(): void {
    this.previousIdentity = null
    this.lastVisualFrameId = null
    this.lastSnapshot = null
    this.discontinuityGeneration = 0
  }
}

function buildSnapshot(input: {
  frame: Readonly<MusicIntelligenceFrame>
  publication: Readonly<AudioFeatureBusPublicationMeta>
  visualFrameId: number
  previous: PreviousCaptureIdentity | null
  discontinuityGeneration: number
}): Readonly<Cinema2AudioIntelligenceFrame> {
  const { frame, publication } = input
  const capabilities = frame.capabilities
  const bandsAvailable = capabilities?.liveBands === true
  const rhythmEventsAvailable = capabilities?.rhythmEvents === true
  const beatGridAvailable = capabilities?.beatGrid === true && finitePositive(frame.rhythm.bpm)
  const sectionsAvailable = capabilities?.sections === true
  const stemsAvailable = capabilities?.stemCurves === true
  const lyricsAvailable = capabilities?.lyrics === true
  const harmonicAvailable = hasStructuredHarmonic(frame)
  const spectralCentroidAvailable = bandsAvailable && hasAuthoritativeMeydaSpectralValue(frame)
  const analyzedPhrasesAvailable = frame.analysisCapabilities?.phraseHierarchy === true
    || (frame.phraseMarkers?.length ?? 0) > 0
  const semanticMomentsAvailable = frame.analysisCapabilities?.semanticMoments === true
    || (frame.semanticMoments?.length ?? 0) > 0
  const structuralSemanticsAvailable = hasStructuralSemanticContext(frame)
  const baseProvenance = provenance(frame, publication)
  const liveSource = frame.rhythm.bpmSource ?? (bandsAvailable ? 'music-intelligence-live' : null)
  const rhythmSource = frame.rhythm.bpmSource ?? frame.analysisSources?.beatGrid ?? null
  const featureConfidence = finiteConfidence(frame.confidence.overall)
  const rhythmConfidence = finiteConfidence(frame.confidence.rhythm)
  const discontinuity = resolveDiscontinuity(input)
  const structuralBase = eventSourceIdentity(frame)
  const eventBase = `${structuralBase}:epoch:${discontinuity.generation}`

  const beat = beatGridAvailable && frame.rhythm.beatHit
    ? event('beat', beatEventIdentity(frame, eventBase), frame.rhythm.beatEventTimeSec ?? frame.timeSec, 1, rhythmConfidence, rhythmSource)
    : null
  const downbeat = beatGridAvailable && frame.rhythm.downbeatHit
    ? event('downbeat', beatEventIdentity(frame, eventBase), frame.rhythm.beatEventTimeSec ?? frame.timeSec, 1, rhythmConfidence, rhythmSource)
    : null
  const kick = rhythmEventsAvailable && frame.rhythm.kickHit
    ? event('kick', `${eventBase}:frame:${frame.frameId}`, frame.timeSec, frame.rhythm.kickStrength, finiteConfidence(frame.rhythm.transientConfidence), liveSource)
    : null
  const snare = rhythmEventsAvailable && frame.rhythm.snareHit
    ? event('snare', `${eventBase}:frame:${frame.frameId}`, frame.timeSec, frame.rhythm.snareStrength, finiteConfidence(frame.rhythm.transientConfidence), liveSource)
    : null
  const transient = rhythmEventsAvailable && finiteNonNegative(frame.rhythm.transient) > 0
    ? event('transient', `${eventBase}:frame:${frame.frameId}`, frame.timeSec, frame.rhythm.transient, finiteConfidence(frame.rhythm.transientConfidence), liveSource)
    : null

  const fixedClocks = Object.fromEntries(FIXED_CLOCK_LENGTHS.map(length => {
    const progress = beatGridAvailable ? fixedClockProgress(frame, length) : 0
    const hit = beatGridAvailable && fixedClockHit(frame, length)
    const boundary = hit
      ? event(
          'beat',
          `${eventBase}:clock:${length}:beat:${frame.rhythm.beatIndex}`,
          frame.rhythm.beatEventTimeSec ?? frame.timeSec,
          1,
          rhythmConfidence,
          rhythmSource,
        )
      : null
    return [length, Object.freeze({ lengthBeats: length, progress, boundary })]
  })) as Record<4 | 8 | 16 | 32, Readonly<Cinema2AudioFixedClock>>

  const analyzedPhrases = Object.freeze((frame.phraseMarkers ?? []).map((marker, index) => freezePhrase(marker, index, structuralBase)))
  const semanticMoments = Object.freeze((frame.semanticMoments ?? []).map((marker, index) => freezeSemanticMoment(marker, index, structuralBase)))
  const section = currentSection(frame)
  const vocalPresence = resolveVocalPresence(frame, publication)

  const snapshot: Cinema2AudioIntelligenceFrame = {
    version: CINEMA2_AUDIO_INTELLIGENCE_FRAME_VERSION,
    visualFrameId: input.visualFrameId,
    smoothingOwnership: 'upstream-music-intelligence',
    upstream: Object.freeze({
      frameId: nonNegativeInteger(frame.frameId),
      publicationSequence: nonNegativeInteger(publication.sequence),
      publicationKind: publication.kind,
      publishedAtMs: finiteNonNegative(publication.publishedAtMs),
      publisherId: publication.publisherId ?? null,
      sourceId: frame.sourceId ?? null,
      trackId: frame.trackId ?? null,
      timeSec: finiteNonNegative(frame.timeSec),
      sampleRate: finiteNonNegative(frame.sampleRate),
      analysisRevision: frame.analysisRevision ?? null,
      timelineRevision: frame.timelineRevision ?? null,
    }),
    capabilities: Object.freeze({
      bands: bandsAvailable,
      rhythmEvents: rhythmEventsAvailable,
      beatGrid: beatGridAvailable,
      sections: sectionsAvailable,
      trackEnergyCurve: capabilities?.trackEnergyCurve === true,
      stems: stemsAvailable,
      lyrics: lyricsAvailable,
      harmonics: harmonicAvailable,
      spectralCentroid: spectralCentroidAvailable,
      analyzedPhrases: analyzedPhrasesAvailable,
      semanticMoments: semanticMomentsAvailable,
      structuralSemantics: structuralSemanticsAvailable,
    }),
    discontinuity,
    bands: Object.freeze({
      sub: numericSignal(bandsAvailable, frame.bands.normalizedSub, featureConfidence, liveSource, baseProvenance),
      bass: numericSignal(bandsAvailable, frame.bands.normalizedBass, featureConfidence, liveSource, baseProvenance),
      lowMid: numericSignal(bandsAvailable, frame.bands.normalizedLowMid, featureConfidence, liveSource, baseProvenance),
      mid: numericSignal(bandsAvailable, frame.bands.normalizedMid, featureConfidence, liveSource, baseProvenance),
      high: numericSignal(bandsAvailable, frame.bands.normalizedHigh, featureConfidence, liveSource, baseProvenance),
      air: numericSignal(bandsAvailable, frame.bands.normalizedAir, featureConfidence, liveSource, baseProvenance),
    }),
    features: Object.freeze({
      overallEnergy: numericSignal(bandsAvailable, frame.energy.instant, featureConfidence, liveSource, baseProvenance),
      rms: numericSignal(bandsAvailable, frame.energy.rms, featureConfidence, liveSource, baseProvenance),
      spectralCentroid: numericSignal(spectralCentroidAvailable, frame.energy.spectralCentroid, featureConfidence, liveSource, baseProvenance),
      spectralFlux: numericSignal(rhythmEventsAvailable, frame.energy.spectralFlux, finiteConfidence(frame.rhythm.transientConfidence), liveSource, baseProvenance),
      transientEnergy: numericSignal(rhythmEventsAvailable, frame.rhythm.transient, finiteConfidence(frame.rhythm.transientConfidence), liveSource, baseProvenance),
      vocalPresence,
      tension: numericSignal(structuralSemanticsAvailable, frame.energy.tension, featureConfidence, 'music-intelligence-semantics', baseProvenance),
      complexity: numericSignal(bandsAvailable, frame.energy.complexity, featureConfidence, liveSource, baseProvenance),
      buildProgress: numericSignal(structuralSemanticsAvailable, frame.energy.buildProgress, featureConfidence, 'music-intelligence-semantics', baseProvenance),
      trackEnergy: numericSignal(capabilities?.trackEnergyCurve === true && frame.energy.trackCurve != null, frame.energy.trackCurve ?? 0, featureConfidence, 'offline-track-energy', baseProvenance),
    }),
    rhythm: Object.freeze({
      bpm: numericSignal(beatGridAvailable, frame.rhythm.bpm, finiteConfidence(frame.rhythm.bpmConfidence), rhythmSource, featureProvenance(baseProvenance, frame.analysisSources?.bpm ?? null)),
      beatPhase: numericSignal(beatGridAvailable, frame.rhythm.beatPhase, rhythmConfidence, rhythmSource, featureProvenance(baseProvenance, frame.analysisSources?.beatGrid ?? null)),
      beatIndex: numericSignal(beatGridAvailable, frame.rhythm.beatIndex, rhythmConfidence, rhythmSource, featureProvenance(baseProvenance, frame.analysisSources?.beatGrid ?? null)),
      beatInBar: numericSignal(beatGridAvailable, frame.rhythm.beatInBar, rhythmConfidence, rhythmSource, featureProvenance(baseProvenance, frame.analysisSources?.beatGrid ?? null)),
      barIndex: numericSignal(beatGridAvailable, frame.rhythm.barIndex, rhythmConfidence, rhythmSource, featureProvenance(baseProvenance, frame.analysisSources?.beatGrid ?? null)),
      beat,
      downbeat,
      kick,
      snare,
      transient,
      fixedClocks: Object.freeze(fixedClocks),
    }),
    structure: Object.freeze({
      analyzedPhrases: analyzedPhrasesAvailable
        ? signal(true, analyzedPhrases, phraseConfidence(frame), frame.analysisSource ?? 'music-intelligence-analysis', baseProvenance)
        : unavailableSignal<readonly Readonly<Cinema2AudioAnalyzedPhrase>[]>(),
      section: section
        ? signal(true, section.value, section.confidence, section.source, featureProvenance(baseProvenance, null, section.authority))
        : unavailableSignal<Readonly<Cinema2AudioSection>>(),
      semanticMoments: semanticMomentsAvailable
        ? signal(true, semanticMoments, semanticMomentConfidence(frame), frame.analysisSource ?? 'music-intelligence-analysis', baseProvenance)
        : unavailableSignal<readonly Readonly<Cinema2AudioSemanticMoment>[]>(),
      buildConfidence: numericSignal(structuralSemanticsAvailable, frame.semantics.buildConfidence, featureConfidence, 'music-intelligence-semantics', baseProvenance),
      dropConfidence: numericSignal(structuralSemanticsAvailable, frame.semantics.dropConfidence, featureConfidence, 'music-intelligence-semantics', baseProvenance),
    }),
    stems: stemsAvailable
      ? signal(true, freezeStemSnapshot(frame), featureConfidence, 'stem-curves', baseProvenance)
      : unavailableSignal<Readonly<Cinema2AudioStemSnapshot>>(),
    lyrics: lyricsAvailable
      ? signal(true, freezeLyricsSnapshot(frame, eventBase), finiteConfidence(frame.lyrics.phraseConfidence), 'timed-lyrics', baseProvenance)
      : unavailableSignal<Readonly<Cinema2AudioLyricsSnapshot>>(),
    harmonic: harmonicAvailable
      ? signal(true, freezeHarmonicSnapshot(frame), finiteConfidence(frame.confidence.harmonic), 'music-intelligence-harmonic', featureProvenance(baseProvenance, frame.analysisSources?.key ?? null))
      : unavailableSignal<Readonly<Cinema2AudioHarmonicSnapshot>>(),
  }

  return Object.freeze(snapshot)
}

function resolveDiscontinuity(input: {
  frame: Readonly<MusicIntelligenceFrame>
  publication: Readonly<AudioFeatureBusPublicationMeta>
  previous: PreviousCaptureIdentity | null
  discontinuityGeneration: number
}): Readonly<Cinema2AudioIntelligenceFrame['discontinuity']> {
  const currentKey = sourceKey(input.frame)
  const previous = input.previous
  let reason: Cinema2AudioDiscontinuityReason | null = null

  if (!previous) reason = 'activation'
  else if (input.publication.kind === 'reset' && input.publication.sequence !== previous.publicationSequence) reason = 'bus-reset'
  else if (currentKey !== previous.sourceKey) reason = 'source-change'
  else if (input.frame.frameId < previous.frameId) reason = 'upstream-frame-rewind'
  else {
    const delta = finiteNonNegative(input.frame.timeSec) - previous.timeSec
    if (delta < -0.001) {
      reason = previous.timeSec > 1 && finiteNonNegative(input.frame.timeSec) <= 0.1 ? 'restart' : 'seek'
    } else if (delta > 0.75) {
      // This mirrors MusicIntelligenceEngine's own analyser discontinuity boundary.
      reason = 'seek'
    }
  }

  const generation = reason ? input.discontinuityGeneration + 1 : input.discontinuityGeneration
  return Object.freeze({
    occurred: reason != null,
    id: reason ? `cinema2-audio-discontinuity:${generation}:${input.publication.sequence}:${reason}` : null,
    generation,
    reason,
  })
}

function resolveVocalPresence(
  frame: Readonly<MusicIntelligenceFrame>,
  publication: Readonly<AudioFeatureBusPublicationMeta>,
): Readonly<Cinema2AudioSignal<number>> {
  const base = provenance(frame, publication)
  if (frame.capabilities?.stemCurves === true) {
    return numericSignal(true, frame.stems.vocalActivity, finiteConfidence(frame.confidence.overall), 'stem-curves', base)
  }
  if (frame.capabilities?.lyrics === true) {
    return numericSignal(true, frame.lyrics.vocalActivity, finiteConfidence(frame.lyrics.phraseConfidence), 'timed-lyrics', base)
  }
  return unavailableSignal<number>()
}

function currentSection(frame: Readonly<MusicIntelligenceFrame>): {
  value: Readonly<Cinema2AudioSection>
  confidence: number
  source: string | null
  authority: string | null
} | null {
  if (frame.capabilities?.sections !== true) return null
  const resolved = frame.currentResolvedSection
  if (resolved) {
    const confidence = finiteConfidence(resolved.confidence ?? frame.confidence.section) ?? 0
    const authority = resolved.provenance?.authority ?? null
    return {
      value: Object.freeze({
        id: resolved.id,
        label: resolved.label,
        type: resolved.type ?? null,
        startSec: finiteNonNegative(resolved.startSec),
        endSec: Math.max(finiteNonNegative(resolved.startSec), finiteNonNegative(resolved.endSec)),
        progress: clamp01(resolved.progress),
        intensity: clamp01(resolved.intensity),
        confidence,
        source: resolved.provenance?.analysisSource ?? resolved.source ?? null,
        authority,
        dropConfidence: finiteNullableConfidence(resolved.dropConfidence),
      }),
      confidence,
      source: resolved.provenance?.analysisSource ?? resolved.source ?? null,
      authority,
    }
  }

  if (frame.section.type == null) return null
  const confidence = finiteConfidence(frame.section.confidence) ?? 0
  const id = `${eventSourceIdentity(frame)}:section:${finiteNonNegative(frame.section.startSec)}:${finiteNonNegative(frame.section.endSec)}:${frame.section.type}`
  return {
    value: Object.freeze({
      id,
      label: frame.section.label,
      type: frame.section.type,
      startSec: finiteNonNegative(frame.section.startSec),
      endSec: Math.max(finiteNonNegative(frame.section.startSec), finiteNonNegative(frame.section.endSec)),
      progress: clamp01(frame.section.progress),
      intensity: clamp01(frame.section.intensity),
      confidence,
      source: frame.section.source,
      authority: null,
      dropConfidence: null,
    }),
    confidence,
    source: frame.section.source,
    authority: null,
  }
}

function freezePhrase(marker: Readonly<PhraseMarker>, index: number, eventBase: string): Readonly<Cinema2AudioAnalyzedPhrase> {
  const lengthBars = marker.lengthBars ?? marker.phraseLength
  const markerIdentity = marker.id ?? `${index}:${finiteNonNegative(marker.timeSec)}:${lengthBars}:${marker.source ?? 'unknown'}`
  return Object.freeze({
    id: `${eventBase}:phrase:${markerIdentity}`,
    timeSec: finiteNonNegative(marker.timeSec),
    lengthBars,
    barIndex: finiteNullableInteger(marker.barIndex),
    confidence: finiteConfidence(marker.confidence) ?? 0,
    source: marker.source ?? null,
    relatedSectionId: marker.relatedSectionId ?? null,
    structurallyDetected: marker.structurallyDetected ?? null,
  })
}

function freezeSemanticMoment(marker: Readonly<SemanticMomentMarker>, index: number, eventBase: string): Readonly<Cinema2AudioSemanticMoment> {
  const markerIdentity = marker.id ?? `${index}:${finiteNonNegative(marker.timeSec)}:${marker.type}`
  return Object.freeze({
    id: `${eventBase}:semantic:${markerIdentity}`,
    timeSec: finiteNonNegative(marker.timeSec),
    durationSec: marker.durationSec == null ? null : finiteNonNegative(marker.durationSec),
    barIndex: finiteNullableInteger(marker.barIndex),
    type: marker.type,
    confidence: finiteConfidence(marker.confidence) ?? 0,
    source: marker.source ?? null,
    relatedSectionId: marker.relatedSectionId ?? null,
  })
}

function freezeStemSnapshot(frame: Readonly<MusicIntelligenceFrame>): Readonly<Cinema2AudioStemSnapshot> {
  return Object.freeze({
    vocals: clamp01(frame.stems.vocals),
    drums: clamp01(frame.stems.drums),
    bass: clamp01(frame.stems.bass),
    instruments: clamp01(frame.stems.instruments),
    other: clamp01(frame.stems.other),
    vocalActivity: clamp01(frame.stems.vocalActivity),
    drumTransient: frame.stems.drumTransient === true,
    bassTransient: frame.stems.bassStemTransient === true,
  })
}

function freezeLyricsSnapshot(frame: Readonly<MusicIntelligenceFrame>, eventBase: string): Readonly<Cinema2AudioLyricsSnapshot> {
  const activeLineId = frame.lyrics.activeLineId ?? null
  const activeWordId = frame.lyrics.activeWordId ?? null
  return Object.freeze({
    activeLine: frame.lyrics.activeLine,
    activeLineId,
    activeWord: frame.lyrics.activeWord,
    activeWordId,
    previousLine: frame.lyrics.previousLine ?? null,
    nextLine: frame.lyrics.nextLine ?? null,
    vocalActivity: clamp01(frame.lyrics.vocalActivity),
    phraseConfidence: clamp01(frame.lyrics.phraseConfidence),
    lineProgress: clamp01(frame.lyrics.lyricLineProgress),
    wordProgress: clamp01(frame.lyrics.wordProgress ?? 0),
    wordHit: frame.lyrics.wordHit === true,
    lineEnter: frame.lyrics.lineEnter === true,
    lineExit: frame.lyrics.lineExit === true,
    isGap: frame.lyrics.isGap === true,
    lineEventId: frame.lyrics.lineEnter && activeLineId ? `${eventBase}:lyric-line:${activeLineId}` : null,
    wordEventId: frame.lyrics.wordHit && activeWordId ? `${eventBase}:lyric-word:${activeWordId}` : null,
  })
}

function freezeHarmonicSnapshot(frame: Readonly<MusicIntelligenceFrame>): Readonly<Cinema2AudioHarmonicSnapshot> {
  return Object.freeze({
    key: frame.harmonic.key,
    mode: frame.harmonic.mode,
    keyConfidence: clamp01(frame.harmonic.keyConfidence),
    chord: frame.harmonic.chord,
    chordConfidence: clamp01(frame.harmonic.chordConfidence),
    chordChanged: frame.harmonic.chordChanged === true,
    rootNote: frame.harmonic.rootNote,
    pitchHz: frame.harmonic.pitchHz != null && Number.isFinite(frame.harmonic.pitchHz) ? frame.harmonic.pitchHz : null,
    note: frame.harmonic.note,
    melodyContour: frame.harmonic.melodyContour,
  })
}

function hasStructuredHarmonic(frame: Readonly<MusicIntelligenceFrame>): boolean {
  const harmonic = frame.harmonic
  return harmonic.key != null
    || harmonic.mode != null
    || harmonic.chord != null
    || harmonic.rootNote != null
    || harmonic.pitchHz != null
    || harmonic.note != null
    || harmonic.melodyContour != null
}

function hasAuthoritativeMeydaSpectralValue(frame: Readonly<MusicIntelligenceFrame>): boolean {
  // Upstream currently encodes "Meyda unavailable" as all-zero spectral fields
  // without an explicit capability bit. A non-zero tuple proves availability;
  // an all-zero tuple is therefore kept unavailable instead of fabricating truth.
  return frame.energy.spectralCentroid !== 0
    || frame.energy.spectralSpread !== 0
    || frame.energy.spectralRolloff !== 0
    || frame.energy.spectralFlatness !== 0
}

function hasStructuralSemanticContext(frame: Readonly<MusicIntelligenceFrame>): boolean {
  if (frame.frameId <= 0) return false
  if (frame.trackId != null) return true
  if (frame.capabilities?.sections === true) return true
  if ((frame.semanticMoments?.length ?? 0) > 0) return true
  return frame.analysisSource != null && frame.analysisSource !== 'none'
}

function provenance(
  frame: Readonly<MusicIntelligenceFrame>,
  publication: Readonly<AudioFeatureBusPublicationMeta>,
): Readonly<Cinema2AudioSignalProvenance> {
  return Object.freeze({
    analysisRevision: frame.analysisRevision ?? null,
    timelineRevision: frame.timelineRevision ?? null,
    analysisSource: frame.analysisSource ?? null,
    featureSource: null,
    trackOrigin: frame.trackProvenance?.trackOrigin ?? null,
    authority: null,
    publisherId: publication.publisherId ?? null,
  })
}

function featureProvenance(
  base: Readonly<Cinema2AudioSignalProvenance>,
  featureSource: string | null,
  authority: string | null = null,
): Readonly<Cinema2AudioSignalProvenance> {
  return Object.freeze({ ...base, featureSource, authority })
}

function numericSignal(
  available: boolean,
  value: number,
  confidence: number | null,
  source: string | null,
  provenanceValue: Readonly<Cinema2AudioSignalProvenance> | null,
): Readonly<Cinema2AudioSignal<number>> {
  if (!available || !Number.isFinite(value)) return unavailableSignal<number>()
  return signal(true, value, confidence, source, provenanceValue)
}

function signal<T>(
  available: true,
  value: T,
  confidence: number | null,
  source: string | null,
  provenanceValue: Readonly<Cinema2AudioSignalProvenance> | null,
): Readonly<Cinema2AudioSignal<T>> {
  return Object.freeze({
    available,
    value,
    confidence: finiteNullableConfidence(confidence),
    source,
    provenance: provenanceValue,
  })
}

function unavailableSignal<T>(): Readonly<Cinema2AudioSignal<T>> {
  return Object.freeze({
    available: false,
    value: null,
    confidence: null,
    source: null,
    provenance: null,
  })
}

function event(
  kind: Cinema2AudioEvent['kind'],
  upstreamIdentity: string,
  timeSec: number,
  strength: number,
  confidence: number | null,
  source: string | null,
): Readonly<Cinema2AudioEvent> {
  return Object.freeze({
    id: `cinema2-audio-event:${kind}:${upstreamIdentity}`,
    kind,
    timeSec: finiteNonNegative(timeSec),
    strength: clamp01(strength),
    confidence: finiteNullableConfidence(confidence),
    source,
    upstreamIdentity,
  })
}

function beatEventIdentity(frame: Readonly<MusicIntelligenceFrame>, eventBase: string): string {
  const base = eventBase
  if (frame.rhythm.beatEventId != null && Number.isFinite(frame.rhythm.beatEventId)) {
    return `${base}:beat-event:${Math.floor(frame.rhythm.beatEventId)}`
  }
  return `${base}:beat-index:${nonNegativeInteger(frame.rhythm.beatIndex)}`
}

function eventSourceIdentity(frame: Readonly<MusicIntelligenceFrame>): string {
  return `${sourceKey(frame)}:analysis:${frame.analysisRevision ?? 'runtime'}`
}

function sourceKey(frame: Readonly<MusicIntelligenceFrame>): string {
  return frame.trackId != null
    ? `track:${frame.trackId}`
    : frame.sourceId != null
      ? `source:${frame.sourceId}`
      : 'unbound'
}

function fixedClockProgress(frame: Readonly<MusicIntelligenceFrame>, length: 4 | 8 | 16 | 32): number {
  if (length === 4) return clamp01(frame.rhythm.phrase4Progress)
  if (length === 8) return clamp01(frame.rhythm.phrase8Progress)
  if (length === 16) return clamp01(frame.rhythm.phrase16Progress)
  return clamp01(frame.rhythm.phrase32Progress)
}

function fixedClockHit(frame: Readonly<MusicIntelligenceFrame>, length: 4 | 8 | 16 | 32): boolean {
  if (length === 4) return frame.rhythm.phrase4Hit === true
  if (length === 8) return frame.rhythm.phrase8Hit === true
  if (length === 16) return frame.rhythm.phrase16Hit === true
  return frame.rhythm.phrase32Hit === true
}

function phraseConfidence(frame: Readonly<MusicIntelligenceFrame>): number | null {
  const markers = frame.phraseMarkers ?? []
  if (markers.length === 0) return null
  return markers.reduce((sum, marker) => sum + (finiteConfidence(marker.confidence) ?? 0), 0) / markers.length
}

function semanticMomentConfidence(frame: Readonly<MusicIntelligenceFrame>): number | null {
  const markers = frame.semanticMoments ?? []
  if (markers.length === 0) return null
  return markers.reduce((sum, marker) => sum + (finiteConfidence(marker.confidence) ?? 0), 0) / markers.length
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function finiteNullableInteger(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? Math.floor(value) : null
}

function finiteConfidence(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? clamp01(value) : null
}

function finiteNullableConfidence(value: number | null | undefined): number | null {
  return finiteConfidence(value)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
