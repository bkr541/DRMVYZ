import type { Cinema2AudioEvent } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import type { Cinema2MainframePlaybackState } from '../mainframe/Cinema2MainframeAudioDelivery'
import {
  Cinema2MainframeDropCoordinator,
  classifyCinema2MainframeSection,
  readCinema2MainframeContinuous,
  resolveCinema2MainframeEventVisualStrength,
  type Cinema2MainframeMusicalEvent,
} from '../mainframe/Cinema2MainframeMusicAdapter'
import type { Cinema2MainframeImpulseId, Cinema2MainframeSectionKind } from '../mainframe/Cinema2MainframeReactivity'

export const CINEMA2_ATL_HOE_EVENT_IDS = Object.freeze([
  'kick', 'snare', 'transient', 'beat', 'downbeat', 'bar', 'phrase', 'section', 'drop',
] as const)
export type Cinema2AtlHoeEventId = typeof CINEMA2_ATL_HOE_EVENT_IDS[number]

export const CINEMA2_ATL_HOE_ENVELOPES = Object.freeze({
  kick: Object.freeze({ attackMs: 8, holdMs: 28, releaseMs: 170, targets: Object.freeze(['sign', 'streetlights'] as const) }),
  snare: Object.freeze({ attackMs: 14, holdMs: 38, releaseMs: 260, targets: Object.freeze(['windows', 'foliage'] as const) }),
  transient: Object.freeze({ attackMs: 5, holdMs: 10, releaseMs: 105, targets: Object.freeze(['windows', 'stars'] as const) }),
  beat: Object.freeze({ attackMs: 20, holdMs: 18, releaseMs: 190, targets: Object.freeze(['streetlights'] as const) }),
  downbeat: Object.freeze({ attackMs: 12, holdMs: 75, releaseMs: 430, targets: Object.freeze(['crowns', 'sign'] as const) }),
  bar: Object.freeze({ attackMs: 35, holdMs: 90, releaseMs: 520, targets: Object.freeze(['road', 'skyline'] as const) }),
  phrase: Object.freeze({ attackMs: 75, holdMs: 170, releaseMs: 900, targets: Object.freeze(['skyline', 'sky'] as const) }),
  section: Object.freeze({ attackMs: 90, holdMs: 150, releaseMs: 850, targets: Object.freeze(['atmosphere', 'skyline'] as const) }),
  drop: Object.freeze({ attackMs: 6, holdMs: 170, releaseMs: 1_450, targets: Object.freeze(['sign', 'road', 'crowns', 'lightning'] as const) }),
})

/** Documented ownership keeps one loud signal from becoming a global brightness knob. */
export const CINEMA2_ATL_HOE_SIGNAL_COMPONENT_MATRIX = Object.freeze({
  sub: Object.freeze(['road', 'low-facades'] as const),
  bass: Object.freeze(['sign', 'streetlights'] as const),
  mid: Object.freeze(['windows', 'hero-buildings'] as const),
  high: Object.freeze(['crowns', 'spires', 'stars'] as const),
  flux: Object.freeze(['window-sparkle', 'foliage'] as const),
  vocal: Object.freeze(['sign-letters', 'center-skyline'] as const),
  build: Object.freeze(['vertical-routes', 'haze'] as const),
  director: Object.freeze(['atmosphere', 'program-variation'] as const),
})

export type Cinema2AtlHoeContinuousSignals = ReturnType<typeof readCinema2MainframeContinuous>

export interface Cinema2AtlHoeMusicFrame {
  readonly continuous: Cinema2AtlHoeContinuousSignals
  readonly impulses: Readonly<Record<Cinema2AtlHoeEventId, number>>
  readonly eventIds: Readonly<Record<Cinema2AtlHoeEventId, string | null>>
  readonly events: readonly Readonly<Cinema2MainframeMusicalEvent>[]
  readonly section: Cinema2MainframeSectionKind
  readonly sectionId: string | null
  readonly stage: 'rest' | 'active' | 'buildup' | 'drop' | 'recovery'
  readonly dropEventId: string | null
}

interface EnvelopeSlot { value: number; holdSec: number; lastId: string | null }
const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

function provenance(frame: Readonly<Cinema2ModuleFrameReadContext>) {
  const upstream = frame.audio?.upstream
  return {
    trackId: upstream?.trackId ?? null,
    sourceId: upstream?.sourceId ?? null,
    analysisRevision: upstream?.analysisRevision ?? null,
    timelineRevision: upstream?.timelineRevision ?? null,
  }
}

function musicalEvent(
  frame: Readonly<Cinema2ModuleFrameReadContext>,
  kind: Cinema2MainframeImpulseId,
  source: Readonly<Pick<Cinema2AudioEvent, 'id' | 'timeSec' | 'strength' | 'confidence' | 'source' | 'upstreamIdentity'>>,
): Readonly<Cinema2MainframeMusicalEvent> | null {
  const visualStrength = resolveCinema2MainframeEventVisualStrength(kind, source.strength, source.confidence, source.source)
  if (visualStrength <= 0) return null
  return Object.freeze({ kind, id: source.id, timeSec: source.timeSec, strength: clamp01(source.strength), visualStrength,
    confidence: source.confidence, source: source.source, upstreamIdentity: source.upstreamIdentity, ...provenance(frame) })
}

function structuralEvent(
  frame: Readonly<Cinema2ModuleFrameReadContext>, kind: 'phrase' | 'section' | 'drop', id: string,
  timeSec: number, strength: number, confidence: number | null, source: string | null,
): Readonly<Cinema2MainframeMusicalEvent> | null {
  return musicalEvent(frame, kind, { id, timeSec, strength, confidence, source, upstreamIdentity: id })
}

export class Cinema2AtlHoeMusicAdapter {
  private readonly envelopes = Object.fromEntries(CINEMA2_ATL_HOE_EVENT_IDS.map(id => [id, { value: 0, holdSec: 0, lastId: null }])) as Record<Cinema2AtlHoeEventId, EnvelopeSlot>
  private readonly dropCoordinator = new Cinema2MainframeDropCoordinator()
  private sectionId: string | null = null

  update(
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    previousTimeSec: number | null,
    deltaTimeSec: number,
    playback: Cinema2MainframePlaybackState,
    suppressEvents = false,
  ): Readonly<Cinema2AtlHoeMusicFrame> {
    if (playback === 'stopped') this.reset()
    const continuous = readCinema2MainframeContinuous(playback === 'stopped' ? null : frame.audio, playback === 'stopped' ? null : frame.director)
    const audio = frame.audio
    const currentSection = audio?.structure.section.available ? audio.structure.section.value : null
    const nextSectionId = currentSection?.id ?? this.sectionId
    const sectionChanged = !!currentSection?.id && currentSection.id !== this.sectionId
    const section = continuous.section
    const candidates: Cinema2MainframeMusicalEvent[] = []
    const push = (event: Readonly<Cinema2MainframeMusicalEvent> | null) => { if (event) candidates.push(event) }

    if (playback === 'playing' && audio && !suppressEvents) {
      for (const [id, kind] of [['kick', 'kick'], ['snare', 'snare'], ['transient', 'transient'], ['beat', 'beat'], ['downbeat', 'downbeat']] as const) {
        const event = audio.rhythm[id]
        if (event) push(musicalEvent(frame, kind, event))
      }
      const bar = audio.rhythm.fixedClocks[4].boundary
      if (bar) push(musicalEvent(frame, 'fourBeat', bar))

      const phrase = audio.structure.analyzedPhrases.available
        ? audio.structure.analyzedPhrases.value?.find(item => item.timeSec > (previousTimeSec ?? -Infinity) && item.timeSec <= audio.upstream.timeSec + 0.05)
        : null
      if (phrase) push(structuralEvent(frame, 'phrase', phrase.id, phrase.timeSec, phrase.confidence, phrase.confidence, phrase.source))
      else if (audio.rhythm.fixedClocks[16].boundary) push(musicalEvent(frame, 'phrase', audio.rhythm.fixedClocks[16].boundary!))

      if (sectionChanged && currentSection) {
        push(structuralEvent(frame, 'section', `section:${currentSection.id}`, audio.upstream.timeSec,
          currentSection.intensity, currentSection.confidence, currentSection.source))
      }
      const transition = frame.director?.context.transition
      if (transition?.occurred && transition.eventId && !candidates.some(event => event.kind === 'section')) {
        push(structuralEvent(frame, 'section', transition.eventId, audio.upstream.timeSec,
          transition.authority, transition.confidence, currentSection?.source ?? null))
      }

      if (audio.structure.semanticMoments.available) {
        for (const moment of audio.structure.semanticMoments.value ?? []) {
          const type = String(moment.type).toLowerCase().replace(/[\s_-]+/g, '')
          if (moment.timeSec > (previousTimeSec ?? -Infinity) && moment.timeSec <= audio.upstream.timeSec + 0.05
            && (type.includes('drop') || type.includes('majorimpact') || type.includes('highimpact'))) {
            push(structuralEvent(frame, 'drop', moment.id, moment.timeSec, moment.confidence, moment.confidence, moment.source))
          }
        }
      }
      if (sectionChanged && currentSection && classifyCinema2MainframeSection(currentSection.type ?? currentSection.label) === 'drop') {
        push(structuralEvent(frame, 'drop', `section-drop:${currentSection.id}`, audio.upstream.timeSec,
          currentSection.dropConfidence ?? currentSection.intensity, currentSection.confidence, currentSection.source))
      }
    }

    const coordinated = this.dropCoordinator.update(frame, candidates)
    const byId: Record<Cinema2AtlHoeEventId, Readonly<Cinema2MainframeMusicalEvent> | null> = Object.fromEntries(
      CINEMA2_ATL_HOE_EVENT_IDS.map(id => [id, null]),
    ) as Record<Cinema2AtlHoeEventId, Readonly<Cinema2MainframeMusicalEvent> | null>
    for (const event of coordinated.events) {
      const id: Cinema2AtlHoeEventId = event.kind === 'fourBeat' ? 'bar' : event.kind as Cinema2AtlHoeEventId
      if (id in byId) byId[id] = event
    }

    const dt = Math.max(0, Number.isFinite(deltaTimeSec) ? deltaTimeSec : 0)
    const impulses = {} as Record<Cinema2AtlHoeEventId, number>
    const eventIds = {} as Record<Cinema2AtlHoeEventId, string | null>
    for (const id of CINEMA2_ATL_HOE_EVENT_IDS) {
      const slot = this.envelopes[id]
      const event = byId[id]
      const fresh = playback === 'playing' && !!event && event.id !== slot.lastId
      if (fresh) {
        slot.lastId = event.id
        slot.value = Math.max(slot.value, event.visualStrength ?? event.strength)
        slot.holdSec = CINEMA2_ATL_HOE_ENVELOPES[id].holdMs / 1_000
      } else if (playback === 'playing') {
        if (slot.holdSec > 0) slot.holdSec = Math.max(0, slot.holdSec - dt)
        else slot.value = Math.max(0, slot.value - dt / (CINEMA2_ATL_HOE_ENVELOPES[id].releaseMs / 1_000))
      }
      impulses[id] = slot.value
      eventIds[id] = fresh ? event.id : null
    }
    this.sectionId = nextSectionId

    const qualifiedBuild = continuous.buildConfidence >= 0.45
      ? continuous.buildProgress * (0.35 + 0.65 * continuous.buildIntensity) : 0
    const stage = coordinated.dropEventId ? 'drop'
      : impulses.drop > 0.03 ? 'recovery'
        : qualifiedBuild > 0.08 ? 'buildup'
          : section === 'breakdown' && continuous.overall < 0.3 ? 'rest'
            : continuous.overall > 0.055 || continuous.vocal > 0.08 ? 'active' : 'rest'
    return Object.freeze({ continuous, impulses: Object.freeze(impulses), eventIds: Object.freeze(eventIds),
      events: coordinated.events, section, sectionId: nextSectionId, stage, dropEventId: coordinated.dropEventId })
  }

  reset(): void {
    for (const slot of Object.values(this.envelopes)) { slot.value = 0; slot.holdSec = 0; slot.lastId = null }
    this.dropCoordinator.reset()
    this.sectionId = null
  }
}
