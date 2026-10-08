import type { Cinema2AudioEvent, Cinema2AudioIntelligenceFrame, Cinema2AudioSignal } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2VisualDirectorFrame } from '../../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import type { Cinema2MainframeImpulseId, Cinema2MainframeSectionKind } from './Cinema2MainframeReactivity'
import type { Cinema2MainframePlaybackState } from './Cinema2MainframeAudioDelivery'

/** These are *delivered* by the engine-owned choreography runtime, not detected here. */
export type Cinema2MainframeMusicalCueKind = Exclude<Cinema2MainframeImpulseId, 'eightBeat'>
export interface Cinema2MainframeMusicalCue {
  readonly kind: Cinema2MainframeMusicalCueKind
  /** Includes the rule action suffix installed by Cinema2ChoreographyRuntime.dispatchAction. */
  readonly dispatchedEventId: string
}

export interface Cinema2MainframeMusicalEvent {
  readonly kind: Cinema2MainframeImpulseId
  readonly id: string
  readonly timeSec: number
  readonly strength: number
  /** Confidence-aware Mainframe emphasis. `strength` remains the untouched upstream value. */
  readonly visualStrength?: number
  readonly confidence: number | null
  readonly source: string | null
  readonly upstreamIdentity: string | null
  readonly trackId: string | null
  readonly sourceId: string | null
  readonly analysisRevision: string | null
  readonly timelineRevision: string | null
}

export interface Cinema2MainframeDirectorSignals {
  readonly intensity: number | null
  readonly momentum: number | null
  readonly build: number | null
  readonly impact: number | null
  readonly variation: number | null
  readonly sectionType: string | null
  readonly transition: Readonly<Cinema2VisualDirectorFrame['context']['transition']> | null
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const number = (signal: Readonly<Cinema2AudioSignal<number>> | undefined): number | null =>
  signal?.available && typeof signal.value === 'number' && Number.isFinite(signal.value) ? clamp01(signal.value) : null
const directorNumber = (signal: { available: boolean; value: number | null } | undefined): number | null =>
  signal?.available && typeof signal.value === 'number' && Number.isFinite(signal.value) ? clamp01(signal.value) : null
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / Math.max(1e-6, edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export function classifyCinema2MainframeSection(value: string | null | undefined): Cinema2MainframeSectionKind {
  const normalized = value?.trim().toLowerCase().replace(/[\s_-]+/g, '') ?? ''
  if (normalized.includes('verse')) return 'verse'
  if (normalized.includes('build') || normalized.includes('predrop') || normalized.includes('riser')) return 'buildup'
  if (normalized.includes('break') || normalized.includes('ambient') || normalized.includes('intro') || normalized.includes('outro')) return 'breakdown'
  if (normalized.includes('drop') || normalized.includes('chorus') || normalized.includes('peak')) return 'drop'
  return normalized ? 'other' : 'unknown'
}

/** Event-specific confidence policy. Rhythm hits remain useful at middling confidence;
 * uncertain structural claims cannot trigger full-board choreography or auto-pattern changes. */
export function resolveCinema2MainframeEventVisualStrength(
  kind: Cinema2MainframeImpulseId,
  strength: number,
  confidence: number | null,
  source: string | null,
): number {
  const raw = clamp01(strength)
  const fallback = source ? 0.78 : 0.62
  const c = confidence == null ? fallback : clamp01(confidence)
  if (kind === 'drop') return c < 0.45 ? 0 : raw * (0.32 + 0.68 * smoothstep(0.45, 0.86, c))
  if (kind === 'section') return c < 0.5 ? 0 : raw * (0.28 + 0.72 * smoothstep(0.5, 0.88, c))
  if (kind === 'phrase') return c < 0.32 ? 0 : raw * (0.35 + 0.65 * smoothstep(0.32, 0.82, c))
  if (kind === 'fourBeat' || kind === 'eightBeat') return raw * (0.5 + 0.5 * c)
  if (kind === 'downbeat') return raw * (0.52 + 0.48 * c)
  // Kicks, snares, beats and transients are immediate authoritative rhythm
  // events; confidence scales them but does not turn a bass-heavy passage off.
  return raw * (0.4 + 0.6 * c)
}

/** Preserve director availability instead of converting absent authority into a synthetic impact. */
export function readCinema2MainframeDirector(director: Readonly<Cinema2VisualDirectorFrame> | null): Readonly<Cinema2MainframeDirectorSignals> {
  return Object.freeze({
    intensity: directorNumber(director?.continuous.intensity),
    momentum: directorNumber(director?.continuous.momentum),
    build: directorNumber(director?.context.build),
    impact: director?.authority.impact.available ? clamp01(director.authority.impact.authority) : null,
    variation: director?.authority.variation.available ? clamp01(director.authority.variation.authority) : null,
    sectionType: director?.context.section.available ? director.context.section.value?.type ?? null : null,
    transition: director?.context.transition.available ? director.context.transition : null,
  })
}

/**
 * The choreography engine is the single event selector (including its phrase/drop
 * fallback policy). This adapter only restores upstream timing/confidence/source
 * information to the resulting intent for Mainframe's lighting envelopes.
 */
export function resolveCinema2MainframeMusicalEvents(
  frame: Readonly<Cinema2ModuleFrameReadContext>,
  cues: readonly Readonly<Cinema2MainframeMusicalCue>[],
): readonly Readonly<Cinema2MainframeMusicalEvent>[] {
  const audio = frame.audio
  if (!audio) return Object.freeze([])
  const events: Cinema2MainframeMusicalEvent[] = []
  const seen = new Set<string>()
  const make = (
    kind: Cinema2MainframeImpulseId,
    id: string,
    timeSec: number,
    strength: number,
    confidence: number | null,
    source: string | null,
    upstreamIdentity: string | null,
  ) => {
    if (!id || !Number.isFinite(timeSec) || seen.has(`${kind}\u0000${id}`)) return
    seen.add(`${kind}\u0000${id}`)
    const rawStrength = clamp01(strength)
    const visualStrength = resolveCinema2MainframeEventVisualStrength(kind, rawStrength, confidence, source)
    if (visualStrength <= 0) return
    events.push(Object.freeze({
      kind, id, timeSec, strength: rawStrength, visualStrength, confidence, source, upstreamIdentity,
      trackId: audio.upstream.trackId, sourceId: audio.upstream.sourceId,
      analysisRevision: audio.upstream.analysisRevision, timelineRevision: audio.upstream.timelineRevision,
    }))
  }
  const rhythm = (kind: Cinema2MainframeMusicalCueKind): Readonly<Cinema2AudioEvent> | null => {
    switch (kind) {
      case 'kick': case 'snare': case 'beat': case 'downbeat': case 'transient': return audio.rhythm[kind]
      case 'fourBeat': return audio.rhythm.fixedClocks[4].boundary
      case 'phrase': return audio.rhythm.fixedClocks[16].boundary
      default: return null
    }
  }
  for (const cue of cues) {
    // The dispatch runtime owns this suffix convention; strip only its final action ID.
    const suffix = `:mainframe-${cue.kind === 'fourBeat' ? 'four-beat' : cue.kind}-cue`
    if (!cue.dispatchedEventId.endsWith(suffix)) continue
    const id = cue.dispatchedEventId.slice(0, -suffix.length)
    if (cue.kind === 'phrase' && audio.structure.analyzedPhrases.available) {
      const phrase = audio.structure.analyzedPhrases.value?.find(item => item.id === id)
      if (phrase) { make('phrase', id, phrase.timeSec, phrase.confidence, phrase.confidence, phrase.source, id); continue }
    }
    if (cue.kind === 'drop' && audio.structure.semanticMoments.available) {
      const moment = audio.structure.semanticMoments.value?.find(item => item.id === id)
      if (moment) { make('drop', id, moment.timeSec, moment.confidence, moment.confidence, moment.source, id); continue }
    }
    if (cue.kind === 'section') {
      const transition = frame.director?.context.transition
      if (transition?.occurred && transition.eventId === id) {
        make('section', id, audio.upstream.timeSec, transition.authority, transition.confidence,
          audio.structure.section.available ? audio.structure.section.value?.source ?? null : null, id)
      }
      continue
    }
    // The shared choreography drop fallback uses the director's section transition.
    if (cue.kind === 'drop') {
      const transition = frame.director?.context.transition
      if (transition?.occurred && transition.eventId === id) {
        make('drop', id, audio.upstream.timeSec, transition.authority, transition.confidence,
          audio.structure.section.available ? audio.structure.section.value?.source ?? null : null, id)
      }
      continue
    }
    const sourceEvent = rhythm(cue.kind)
    if (sourceEvent?.id === id) {
      make(cue.kind, id, sourceEvent.timeSec, sourceEvent.strength, sourceEvent.confidence, sourceEvent.source, sourceEvent.upstreamIdentity)
    }
  }
  // The eight-beat marker is a canonical fixed-clock event, not a second detector.
  const eight = audio.rhythm.fixedClocks[8].boundary
  if (eight) make('eightBeat', eight.id, eight.timeSec, eight.strength, eight.confidence, eight.source, eight.upstreamIdentity)
  return Object.freeze(events)
}

/** One transport/bridge discontinuity decision for the pattern and drop consumers. */
export function shouldResetCinema2MainframeDropState(
  frame: Readonly<Cinema2ModuleFrameReadContext>,
  current: Readonly<{ timeSec: number; sourceIdentity: string; playback: Cinema2MainframePlaybackState }>,
  previous: Readonly<{ timeSec: number | null; sourceIdentity: string | null; contextGeneration: number | null; playback: Cinema2MainframePlaybackState | null }>,
): boolean {
  return Boolean(frame.audio?.discontinuity.occurred && frame.audio.discontinuity.reason !== 'activation')
    || (previous.timeSec != null && current.timeSec < previous.timeSec - 1e-6)
    || (previous.sourceIdentity != null && current.sourceIdentity !== previous.sourceIdentity)
    || (previous.contextGeneration != null && frame.contextGeneration !== previous.contextGeneration)
    || (previous.playback != null && previous.playback !== current.playback && (previous.playback === 'stopped' || current.playback === 'stopped'))
}

/**
 * Mainframe's single drop-consumption point. Choreography (the same runtime used
 * by Electric Storm) has already selected the events; this only coalesces
 * duplicate representations of one impact and shares the result with lighting
 * and the optional drop-based pattern trigger. No audio detection happens here.
 */
export class Cinema2MainframeDropCoordinator {
  private readonly seenIds = new Set<string>()
  private readonly seenOrder: string[] = []
  private lastImpactTimeSec: number | null = null

  update(
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    events: readonly Readonly<Cinema2MainframeMusicalEvent>[],
  ): Readonly<{ events: readonly Readonly<Cinema2MainframeMusicalEvent>[]; dropEventId: string | null }> {
    const accepted: Cinema2MainframeMusicalEvent[] = events.filter(event => event.kind !== 'drop')
    // A published marker wins over a simultaneous section fallback. Both come
    // from the canonical choreography selection, not from a second detector.
    const markers = frame.audio?.structure.semanticMoments.available
      ? new Set(frame.audio.structure.semanticMoments.value?.map(moment => moment.id) ?? []) : new Set<string>()
    const candidates = events.filter(event => event.kind === 'drop'
      && (event.visualStrength ?? resolveCinema2MainframeEventVisualStrength('drop', event.strength, event.confidence, event.source)) > 0)
      .sort((a, b) => Number(markers.has(b.id)) - Number(markers.has(a.id)))
    let dropEventId: string | null = null
    for (const event of candidates) {
      if (this.seenIds.has(event.id)) continue
      this.seenIds.add(event.id)
      this.seenOrder.push(event.id)
      if (this.seenOrder.length > 512) this.seenIds.delete(this.seenOrder.shift()!)

      // A marker and a section-change report of the same downbeat may arrive
      // on adjacent frames with different upstream IDs. Keep only one impact.
      if (this.lastImpactTimeSec != null && Math.abs(event.timeSec - this.lastImpactTimeSec) <= 1.25) continue
      this.lastImpactTimeSec = event.timeSec
      if (dropEventId == null) {
        accepted.push(event)
        dropEventId = event.id
      }
    }
    return Object.freeze({ events: Object.freeze(accepted), dropEventId })
  }

  reset(): void {
    this.seenIds.clear()
    this.seenOrder.length = 0
    this.lastImpactTimeSec = null
  }
}

/** Called only with the selected canonical bridge frame; this does not publish audio. */
export function readCinema2MainframeContinuous(audio: Readonly<Cinema2AudioIntelligenceFrame> | null, director: Readonly<Cinema2VisualDirectorFrame> | null) {
  const d = readCinema2MainframeDirector(director)
  if (!audio) return Object.freeze({
    sub: 0, bass: 0, mid: 0, high: 0, flux: 0, vocal: 0,
    buildProgress: 0, buildConfidence: 0, buildIntensity: 0, build: 0,
    overall: 0, significance: 0, momentum: 0, impact: 0, variation: 0,
    section: 'unknown' as const, sectionProgress: 0, sectionIntensity: 0, sectionConfidence: 0, phraseProgress: 0,
  })
  const sectionSignal = audio.structure.section
  const sectionValue = sectionSignal.available ? sectionSignal.value : null
  const section = classifyCinema2MainframeSection(sectionValue?.type ?? sectionValue?.label ?? d.sectionType)
  const buildProgress = number(audio.features.buildProgress)
    ?? (section === 'buildup' ? clamp01(sectionValue?.progress ?? 0) : 0)
  const explicitBuildConfidence = number(audio.structure.buildConfidence)
  const sectionConfidence = sectionSignal.available
    ? clamp01(sectionSignal.confidence ?? 0.65) : 0
  const buildConfidence = explicitBuildConfidence
    ?? (section === 'buildup' ? (sectionConfidence || 0.72) : 0)
  const overall = number(audio.features.overallEnergy) ?? number(audio.features.trackEnergy) ?? 0
  const buildIntensity = clamp01(Math.max(
    section === 'buildup' ? sectionValue?.intensity ?? 0 : 0,
    number(audio.features.tension) ?? 0,
    d.build ?? 0,
    0.65 * overall,
  ))
  return Object.freeze({
    sub: number(audio.bands.sub) ?? 0,
    bass: number(audio.bands.bass) ?? 0,
    mid: Math.max(number(audio.bands.lowMid) ?? 0, number(audio.bands.mid) ?? 0),
    high: Math.max(number(audio.bands.high) ?? 0, number(audio.bands.air) ?? 0),
    flux: Math.max(number(audio.features.spectralFlux) ?? 0, number(audio.features.transientEnergy) ?? 0),
    vocal: number(audio.features.vocalPresence) ?? 0,
    buildProgress,
    buildConfidence,
    buildIntensity,
    build: buildProgress,
    // The live, normalized frame energy must win over the broader offline track curve.
    // Taking max() held quiet passages at the track-level energy and erased dynamics.
    overall,
    significance: d.intensity ?? 0,
    momentum: d.momentum ?? 0,
    impact: d.impact ?? 0,
    variation: d.variation ?? 0,
    section,
    sectionProgress: clamp01(sectionValue?.progress ?? 0),
    sectionIntensity: clamp01(sectionValue?.intensity ?? overall),
    sectionConfidence,
    phraseProgress: clamp01(audio.rhythm.fixedClocks[16]?.progress ?? 0),
  })
}
