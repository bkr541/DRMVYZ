import type { Cinema2AudioEvent, Cinema2AudioIntelligenceFrame, Cinema2AudioSignal } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2VisualDirectorFrame } from '../../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import type { Cinema2MainframeImpulseId } from './Cinema2MainframeReactivity'

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
    events.push(Object.freeze({
      kind, id, timeSec, strength: clamp01(strength), confidence, source, upstreamIdentity,
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
    const suffix = `:mainframe-${cue.kind}-cue`
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

/** Called only with the selected canonical bridge frame; this does not publish audio. */
export function readCinema2MainframeContinuous(audio: Readonly<Cinema2AudioIntelligenceFrame> | null, director: Readonly<Cinema2VisualDirectorFrame> | null) {
  const d = readCinema2MainframeDirector(director)
  if (!audio) return Object.freeze({ sub: 0, bass: 0, mid: 0, high: 0, flux: 0, vocal: 0, build: 0, overall: 0, significance: 0, momentum: 0, impact: 0, variation: 0 })
  return Object.freeze({
    sub: number(audio.bands.sub) ?? 0,
    bass: number(audio.bands.bass) ?? 0,
    mid: Math.max(number(audio.bands.lowMid) ?? 0, number(audio.bands.mid) ?? 0),
    high: Math.max(number(audio.bands.high) ?? 0, number(audio.bands.air) ?? 0),
    flux: Math.max(number(audio.features.spectralFlux) ?? 0, number(audio.features.transientEnergy) ?? 0),
    vocal: number(audio.features.vocalPresence) ?? 0,
    build: Math.max(number(audio.features.buildProgress) ?? 0, number(audio.structure.buildConfidence) ?? 0, d.build ?? 0),
    overall: Math.max(number(audio.features.overallEnergy) ?? 0, number(audio.features.trackEnergy) ?? 0),
    significance: d.intensity ?? 0,
    momentum: d.momentum ?? 0,
    impact: d.impact ?? 0,
    variation: d.variation ?? 0,
  })
}
