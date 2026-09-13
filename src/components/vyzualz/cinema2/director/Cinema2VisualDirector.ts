import type {
  Cinema2AudioAnalyzedPhrase,
  Cinema2AudioEvent,
  Cinema2AudioIntelligenceFrame,
  Cinema2AudioSection,
  Cinema2AudioSemanticMoment,
  Cinema2AudioSignal,
} from '../audio/Cinema2AudioIntelligenceBridge'

export const CINEMA2_VISUAL_DIRECTOR_FRAME_VERSION = 1 as const

export type Cinema2VisualPhase = 'low' | 'steady' | 'rising' | 'building' | 'peak' | 'release'

export interface Cinema2VisualDirectorSignal<T> {
  available: boolean
  value: T | null
  confidence: number | null
  evidence: readonly string[]
}

export interface Cinema2VisualDirectorAuthority {
  /** False distinguishes "no event this frame" from unavailable event truth. */
  available: boolean
  occurred: boolean
  authority: number
  confidence: number | null
  eventIds: readonly string[]
}

export interface Cinema2VisualDirectorSectionContext {
  id: string
  label: string
  type: string | null
  progress: number
  intensity: number
  dropConfidence: number | null
}

export type Cinema2VisualDirectorTransitionKind = 'section-change' | 'structural-boundary'

export interface Cinema2VisualDirectorTransitionContext {
  available: boolean
  occurred: boolean
  kind: Cinema2VisualDirectorTransitionKind | null
  authority: number
  confidence: number | null
  eventId: string | null
  fromSectionId: string | null
  toSectionId: string | null
}

export interface Cinema2VisualDirectorFrame {
  version: typeof CINEMA2_VISUAL_DIRECTOR_FRAME_VERSION
  visualFrameId: number
  discontinuityGeneration: number
  phase: Readonly<Cinema2VisualDirectorSignal<Cinema2VisualPhase>>
  continuous: Readonly<{
    intensity: Readonly<Cinema2VisualDirectorSignal<number>>
    momentum: Readonly<Cinema2VisualDirectorSignal<number>>
  }>
  authority: Readonly<{
    impact: Readonly<Cinema2VisualDirectorAuthority>
    variation: Readonly<Cinema2VisualDirectorAuthority>
  }>
  context: Readonly<{
    build: Readonly<Cinema2VisualDirectorSignal<number>>
    section: Readonly<Cinema2VisualDirectorSignal<Readonly<Cinema2VisualDirectorSectionContext>>>
    transition: Readonly<Cinema2VisualDirectorTransitionContext>
  }>
}

interface NumericEvidence {
  value: number
  weight: number
  confidence: number | null
  evidence: string
}

interface AuthorityEvidence {
  authority: number
  confidence: number | null
  eventId: string
}

interface DirectorState {
  timeSec: number | null
  intensity: number | null
  sectionId: string | null
  phase: Cinema2VisualPhase | null
}

const IMPACT_SEMANTIC_WEIGHTS: Readonly<Partial<Record<Cinema2AudioSemanticMoment['type'], number>>> = Object.freeze({
  drop_impact: 1,
  major_impact: 1,
  high_impact: 0.9,
  drop: 0.95,
  fakeout: 0.72,
  fakeout_candidate: 0.58,
  silence_or_stop: 0.62,
  energy_release: 0.52,
  release: 0.5,
})

const TRANSITION_SEMANTIC_WEIGHTS: Readonly<Partial<Record<Cinema2AudioSemanticMoment['type'], number>>> = Object.freeze({
  build_start: 0.72,
  pre_drop_start: 0.84,
  breakdown_entry: 0.8,
  energy_release: 0.72,
  silence_or_stop: 0.75,
  section_entry: 0.88,
  section_exit: 0.8,
  breakdown: 0.76,
  release: 0.7,
})

const EMPTY_EVIDENCE = Object.freeze([]) as readonly string[]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function finiteConfidence(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? clamp01(value) : null
}

function freezeSignal<T>(
  available: boolean,
  value: T | null,
  confidence: number | null,
  evidence: readonly string[] = EMPTY_EVIDENCE,
): Readonly<Cinema2VisualDirectorSignal<T>> {
  return Object.freeze({
    available,
    value: available ? value : null,
    confidence: available ? finiteConfidence(confidence) : null,
    evidence: available ? Object.freeze([...evidence]) : EMPTY_EVIDENCE,
  })
}

function unavailableSignal<T>(): Readonly<Cinema2VisualDirectorSignal<T>> {
  return freezeSignal<T>(false, null, null)
}

function addAudioSignal(
  evidence: NumericEvidence[],
  signal: Readonly<Cinema2AudioSignal<number>>,
  weight: number,
  label: string,
): void {
  if (!signal.available || typeof signal.value !== 'number' || !Number.isFinite(signal.value)) return
  evidence.push({ value: clamp01(signal.value), weight, confidence: signal.confidence, evidence: label })
}

function weightedSignal(evidence: readonly NumericEvidence[]): Readonly<Cinema2VisualDirectorSignal<number>> {
  const usable = evidence.filter(item => item.weight > 0 && Number.isFinite(item.value))
  const totalWeight = usable.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) return unavailableSignal<number>()
  const value = clamp01(usable.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight)
  const confidenceItems = usable.filter(item => item.confidence != null)
  const confidenceWeight = confidenceItems.reduce((sum, item) => sum + item.weight, 0)
  const confidence = confidenceWeight > 0
    ? confidenceItems.reduce((sum, item) => sum + (item.confidence ?? 0) * item.weight, 0) / confidenceWeight
    : null
  return freezeSignal(true, value, confidence, usable.map(item => item.evidence))
}

function sectionContext(signal: Readonly<Cinema2AudioSignal<Readonly<Cinema2AudioSection>>>): Readonly<Cinema2VisualDirectorSignal<Readonly<Cinema2VisualDirectorSectionContext>>> {
  if (!signal.available || !signal.value) return unavailableSignal<Readonly<Cinema2VisualDirectorSectionContext>>()
  const section = signal.value
  return freezeSignal(true, Object.freeze({
    id: section.id,
    label: section.label,
    type: section.type,
    progress: clamp01(section.progress),
    intensity: clamp01(section.intensity),
    dropConfidence: finiteConfidence(section.dropConfidence),
  }), signal.confidence, ['structure.section'])
}

function crossedStructuralItems<T extends { readonly id: string; readonly timeSec: number }>(
  items: readonly Readonly<T>[],
  previousTimeSec: number | null,
  currentTimeSec: number,
): readonly Readonly<T>[] {
  if (previousTimeSec == null || currentTimeSec <= previousTimeSec) return Object.freeze([])
  return Object.freeze(items.filter(item => item.timeSec > previousTimeSec && item.timeSec <= currentTimeSec + 1e-6))
}

function addAuthorityEvent(
  evidence: AuthorityEvidence[],
  event: Readonly<Cinema2AudioEvent> | null,
  weight: number,
): void {
  if (!event) return
  evidence.push({
    authority: clamp01(event.strength * weight),
    confidence: event.confidence,
    eventId: event.id,
  })
}

function authorityFromEvidence(
  available: boolean,
  evidence: readonly AuthorityEvidence[],
): Readonly<Cinema2VisualDirectorAuthority> {
  if (!available) {
    return Object.freeze({ available: false, occurred: false, authority: 0, confidence: null, eventIds: EMPTY_EVIDENCE })
  }
  if (evidence.length === 0) {
    return Object.freeze({ available: true, occurred: false, authority: 0, confidence: null, eventIds: EMPTY_EVIDENCE })
  }
  const authority = Math.max(...evidence.map(item => clamp01(item.authority)))
  const confidenceValues = evidence.map(item => finiteConfidence(item.confidence)).filter((value): value is number => value != null)
  return Object.freeze({
    available: true,
    occurred: true,
    authority,
    confidence: confidenceValues.length > 0 ? Math.max(...confidenceValues) : null,
    eventIds: Object.freeze([...new Set(evidence.map(item => item.eventId))]),
  })
}

function phaseConfidence(
  phase: Cinema2VisualPhase,
  intensity: Readonly<Cinema2VisualDirectorSignal<number>>,
  momentum: Readonly<Cinema2VisualDirectorSignal<number>>,
  build: Readonly<Cinema2VisualDirectorSignal<number>>,
  impact: Readonly<Cinema2VisualDirectorAuthority>,
  dropConfidence: number | null,
): number | null {
  const values: Array<number | null> = []
  if (phase === 'building') values.push(build.confidence)
  else if (phase === 'peak') values.push(impact.confidence, dropConfidence, intensity.confidence)
  else if (phase === 'rising') values.push(momentum.confidence, intensity.confidence)
  else values.push(intensity.confidence, momentum.confidence)
  const available = values.filter((value): value is number => value != null)
  return available.length > 0 ? Math.max(...available) : null
}

/**
 * Engine-owned, preset-agnostic interpretation layer between Audio Intelligence
 * and future choreography. It reports generic significance only and has no
 * access to writable targets, preset identity, rendering resources or actions.
 */
export class Cinema2VisualDirector {
  private state: DirectorState = { timeSec: null, intensity: null, sectionId: null, phase: null }

  reset(): void {
    this.state = { timeSec: null, intensity: null, sectionId: null, phase: null }
  }

  capture(audio: Readonly<Cinema2AudioIntelligenceFrame>): Readonly<Cinema2VisualDirectorFrame> {
    if (audio.discontinuity.occurred) this.reset()

    const currentTimeSec = audio.upstream.timeSec
    const priorTimeSec = this.state.timeSec
    const section = sectionContext(audio.structure.section)

    const intensityEvidence: NumericEvidence[] = []
    addAudioSignal(intensityEvidence, audio.features.trackEnergy, 0.34, 'features.trackEnergy')
    addAudioSignal(intensityEvidence, audio.features.overallEnergy, 0.3, 'features.overallEnergy')
    addAudioSignal(intensityEvidence, audio.features.rms, 0.12, 'features.rms')
    if (section.available && section.value) {
      intensityEvidence.push({
        value: section.value.intensity,
        weight: 0.24,
        confidence: section.confidence,
        evidence: 'structure.section.intensity',
      })
    }
    const intensity = weightedSignal(intensityEvidence)

    const buildEvidence: NumericEvidence[] = []
    addAudioSignal(buildEvidence, audio.features.buildProgress, 0.56, 'features.buildProgress')
    addAudioSignal(buildEvidence, audio.structure.buildConfidence, 0.44, 'structure.buildConfidence')
    if (section.available && section.value && (section.value.type === 'build' || section.value.type === 'preDrop')) {
      buildEvidence.push({
        value: Math.max(section.value.progress, section.value.intensity * 0.72),
        weight: 0.28,
        confidence: section.confidence,
        evidence: 'structure.section.build-context',
      })
    }
    const build = weightedSignal(buildEvidence)

    const intensityDelta = intensity.available && intensity.value != null && this.state.intensity != null
      && priorTimeSec != null && currentTimeSec > priorTimeSec && currentTimeSec - priorTimeSec <= 2
      ? intensity.value - this.state.intensity
      : null

    const momentumEvidence: NumericEvidence[] = []
    addAudioSignal(momentumEvidence, audio.features.spectralFlux, 0.32, 'features.spectralFlux')
    addAudioSignal(momentumEvidence, audio.features.transientEnergy, 0.24, 'features.transientEnergy')
    addAudioSignal(momentumEvidence, audio.features.tension, 0.22, 'features.tension')
    if (build.available && build.value != null) {
      momentumEvidence.push({ value: build.value, weight: 0.22, confidence: build.confidence, evidence: 'director.build-context' })
    }
    if (intensityDelta != null && intensityDelta > 0) {
      momentumEvidence.push({
        value: clamp01(intensityDelta * 3.5),
        weight: 0.3,
        confidence: intensity.confidence,
        evidence: 'director.intensity-rise',
      })
    }
    const momentum = weightedSignal(momentumEvidence)

    const semanticItems = audio.structure.semanticMoments.available && audio.structure.semanticMoments.value
      ? crossedStructuralItems(audio.structure.semanticMoments.value, priorTimeSec, currentTimeSec)
      : Object.freeze([]) as readonly Readonly<Cinema2AudioSemanticMoment>[]
    const phraseItems = audio.structure.analyzedPhrases.available && audio.structure.analyzedPhrases.value
      ? crossedStructuralItems(audio.structure.analyzedPhrases.value, priorTimeSec, currentTimeSec)
      : Object.freeze([]) as readonly Readonly<Cinema2AudioAnalyzedPhrase>[]

    const impactEvidence: AuthorityEvidence[] = []
    addAuthorityEvent(impactEvidence, audio.rhythm.beat, 0.22)
    addAuthorityEvent(impactEvidence, audio.rhythm.downbeat, 0.52)
    addAuthorityEvent(impactEvidence, audio.rhythm.kick, 0.78)
    addAuthorityEvent(impactEvidence, audio.rhythm.snare, 0.58)
    addAuthorityEvent(impactEvidence, audio.rhythm.transient, 0.76)
    for (const moment of semanticItems) {
      const weight = IMPACT_SEMANTIC_WEIGHTS[moment.type]
      if (weight == null) continue
      impactEvidence.push({ authority: weight * moment.confidence, confidence: moment.confidence, eventId: moment.id })
    }
    const impactAvailable = audio.capabilities.rhythmEvents || audio.capabilities.beatGrid || audio.capabilities.semanticMoments
    let impact = authorityFromEvidence(impactAvailable, impactEvidence)
    const dropConfidence = audio.structure.dropConfidence.available && audio.structure.dropConfidence.value != null
      ? clamp01(audio.structure.dropConfidence.value)
      : section.available && section.value?.dropConfidence != null
        ? section.value.dropConfidence
        : null
    if (impact.occurred && dropConfidence != null && dropConfidence > impact.authority) {
      impact = Object.freeze({ ...impact, authority: clamp01(Math.max(impact.authority, dropConfidence * 0.95)) })
    }

    const currentSectionId = section.available && section.value ? section.value.id : null
    const sectionChanged = this.state.sectionId != null && currentSectionId != null && this.state.sectionId !== currentSectionId

    const variationEvidence: AuthorityEvidence[] = []
    const clockWeights = [[4, 0.28], [8, 0.42], [16, 0.66], [32, 0.9]] as const
    for (const [length, weight] of clockWeights) {
      const boundary = audio.rhythm.fixedClocks[length].boundary
      if (boundary) variationEvidence.push({ authority: weight, confidence: boundary.confidence, eventId: boundary.id })
    }
    for (const phrase of phraseItems) {
      variationEvidence.push({ authority: 0.82 * phrase.confidence, confidence: phrase.confidence, eventId: phrase.id })
    }
    if (sectionChanged && currentSectionId) {
      variationEvidence.push({
        authority: 0.94 * (section.confidence ?? 1),
        confidence: section.confidence,
        eventId: `cinema2-director:section-change:${audio.discontinuity.generation}:${this.state.sectionId}->${currentSectionId}`,
      })
    }
    for (const moment of semanticItems) {
      const weight = TRANSITION_SEMANTIC_WEIGHTS[moment.type]
      if (weight == null) continue
      variationEvidence.push({ authority: weight * moment.confidence, confidence: moment.confidence, eventId: moment.id })
    }
    const variationAvailable = audio.capabilities.beatGrid
      || audio.capabilities.analyzedPhrases
      || audio.capabilities.sections
      || audio.capabilities.semanticMoments
    const variation = authorityFromEvidence(variationAvailable, variationEvidence)

    const transitionSemantic = semanticItems
      .map(moment => ({ moment, weight: TRANSITION_SEMANTIC_WEIGHTS[moment.type] ?? 0 }))
      .filter(item => item.weight > 0)
      .sort((left, right) => (right.weight * right.moment.confidence) - (left.weight * left.moment.confidence))[0]
    const transitionAvailable = audio.capabilities.sections || audio.capabilities.semanticMoments
    const transition: Readonly<Cinema2VisualDirectorTransitionContext> = sectionChanged && currentSectionId
      ? Object.freeze({
          available: true,
          occurred: true,
          kind: 'section-change' as const,
          authority: clamp01(0.94 * (section.confidence ?? 1)),
          confidence: section.confidence,
          eventId: `cinema2-director:section-change:${audio.discontinuity.generation}:${this.state.sectionId}->${currentSectionId}`,
          fromSectionId: this.state.sectionId,
          toSectionId: currentSectionId,
        })
      : transitionSemantic
        ? Object.freeze({
            available: true,
            occurred: true,
            kind: 'structural-boundary' as const,
            authority: clamp01(transitionSemantic.weight * transitionSemantic.moment.confidence),
            confidence: transitionSemantic.moment.confidence,
            eventId: transitionSemantic.moment.id,
            fromSectionId: this.state.sectionId,
            toSectionId: currentSectionId,
          })
        : Object.freeze({
            available: transitionAvailable,
            occurred: false,
            kind: null,
            authority: 0,
            confidence: null,
            eventId: null,
            fromSectionId: null,
            toSectionId: currentSectionId,
          })

    const peakEvidence = Math.max(
      dropConfidence ?? 0,
      impact.occurred ? impact.authority : 0,
      section.available && section.value?.type === 'drop' ? section.value.intensity : 0,
    )
    const buildValue = build.available && build.value != null ? build.value : 0
    const momentumValue = momentum.available && momentum.value != null ? momentum.value : 0
    const intensityValue = intensity.available && intensity.value != null ? intensity.value : null
    let phase: Cinema2VisualPhase | null = null
    if (peakEvidence >= 0.72 || (this.state.phase === 'peak' && peakEvidence >= 0.58)) phase = 'peak'
    else if (buildValue >= 0.56 || (this.state.phase === 'building' && buildValue >= 0.42)) phase = 'building'
    else if (intensityDelta != null && intensityDelta <= -0.08) phase = 'release'
    else if (intensityValue != null && intensityValue <= 0.24) phase = 'low'
    else if (momentum.available && (momentumValue >= 0.58 || (this.state.phase === 'rising' && momentumValue >= 0.42))) phase = 'rising'
    else if (intensity.available || momentum.available || build.available) phase = 'steady'

    const phaseSignal = phase == null
      ? unavailableSignal<Cinema2VisualPhase>()
      : freezeSignal(true, phase, phaseConfidence(phase, intensity, momentum, build, impact, dropConfidence), [
          ...(intensity.available ? ['director.intensity'] : []),
          ...(momentum.available ? ['director.momentum'] : []),
          ...(build.available ? ['director.build-context'] : []),
          ...(dropConfidence != null ? ['structure.dropConfidence'] : []),
        ])

    const frame: Cinema2VisualDirectorFrame = {
      version: CINEMA2_VISUAL_DIRECTOR_FRAME_VERSION,
      visualFrameId: audio.visualFrameId,
      discontinuityGeneration: audio.discontinuity.generation,
      phase: phaseSignal,
      continuous: Object.freeze({ intensity, momentum }),
      authority: Object.freeze({ impact, variation }),
      context: Object.freeze({ build, section, transition }),
    }

    this.state = {
      timeSec: currentTimeSec,
      intensity: intensity.available ? intensity.value : null,
      sectionId: currentSectionId,
      phase,
    }

    return Object.freeze(frame)
  }
}
