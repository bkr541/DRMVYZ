import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  buildSharedPerformanceContext,
  type SharedPerformanceContext,
} from '../../../features/performanceCore/context'
import type { ShaderAudioUniformFrame, ShaderTimingUniformFrame } from '../react/shaders/audio/shaderAudioTypes'
import type { ReactSectionType, ReactTrackSection, ReactTrackSectionSource } from '../react/ReactTypes'
import { ShaderFeedbackResetTracker } from '../react/shaders/feedback/ShaderFeedbackResetTracker'
import type { ModulationValidationError } from '../react/shaders/modulation/shaderModulationTypes'
import { ShaderPerformanceProgramExecutor } from '../react/shaders/performance/ShaderPerformanceProgramExecutor'
import { resolveShaderRoutesForDefinition } from '../react/shaders/performance/ShaderPerformanceRoutes'
import type { ShaderPerformanceRuntimeSnapshot } from '../react/shaders/performance/ShaderPerformanceProgramTypes'
import type {
  ShaderDefinition,
  ShaderParamValue,
  ShaderParamValues,
} from '../react/shaders/registry/shaderRegistryTypes'
import { REACTOR_SCENE_ID } from '../react/shaders/scenes/reactor'
import type { CinemaFrameContext } from './CinemaRendererContracts'

export interface CinemaShaderPerformanceResolution {
  values: Record<string, ShaderParamValue>
  snapshot: ShaderPerformanceRuntimeSnapshot
  feedbackResetRequested: boolean
  choreographyAction: string | null
  invalidRoutes: Readonly<Record<string, ModulationValidationError>>
}

/** Per-Cinema-node runtime state for canonical Shader performance execution. */
export class CinemaShaderPerformanceBridge {
  private readonly executor = new ShaderPerformanceProgramExecutor()
  private readonly feedbackResetTracker = new ShaderFeedbackResetTracker()
  private previousContext: SharedPerformanceContext | null = null
  private lastResetGeneration = -1
  private lastReactorRecipe: string | null = null

  constructor(private readonly definition: Readonly<ShaderDefinition>) {
    this.executor.setDefinition(definition as ShaderDefinition, definition.id)
  }

  reset(): void {
    this.executor.reset()
    this.feedbackResetTracker.resetTracking()
    this.previousContext = null
    this.lastReactorRecipe = null
  }

  resolve(
    frame: Readonly<CinemaFrameContext>,
    manualValues: ShaderParamValues,
  ): CinemaShaderPerformanceResolution {
    const resetGenerationChanged = frame.transport.reset.required
      && frame.transport.reset.generation !== this.lastResetGeneration
    if (resetGenerationChanged) this.reset()
    this.lastResetGeneration = frame.transport.reset.generation

    const musicIntelligence = createMusicIntelligenceFrame(frame)
    const resolvedSections = createResolvedSections(frame)
    const context = buildSharedPerformanceContext({
      audioTimeSec: frame.transport.audioTimeSec,
      frame: musicIntelligence,
      resolvedSections,
      durationSec: frame.transport.durationSec ?? undefined,
      trackIdentity: frame.transport.trackId,
      seekIdentity: frame.transport.seeking ? frame.transport.reset.identity : null,
      loopIdentity: frame.transport.looped ? frame.transport.reset.identity : null,
      trackChangeIdentity: frame.transport.discontinuityReasons.includes('track-change')
        ? frame.transport.reset.identity
        : frame.transport.trackId,
      timingDiscontinuityIdentity: frame.transport.reset.identity ?? this.lastResetGeneration,
      previous: this.previousContext,
    })
    const reconstruct = this.previousContext === null || resetGenerationChanged
    this.previousContext = context

    const audio = createShaderAudioFrame(frame)
    const timing = createShaderTimingFrame(frame)
    const routes = resolveShaderRoutesForDefinition(this.definition as ShaderDefinition, [])
    const result = this.executor.resolve({
      definition: this.definition as ShaderDefinition,
      sceneId: this.definition.id,
      manualValues,
      routes,
      context,
      audio,
      timing,
      musicIntelligence,
      deltaTimeSec: frame.timing.deltaTimeSec,
      reconstruct,
    })

    const policyReset = this.feedbackResetTracker.update({
      sceneId: this.definition.id,
      trackId: frame.transport.trackId,
      playbackTime: frame.transport.audioTimeSec,
      sectionType: frame.music.sectionType,
      dropImpact: frame.audio.dropImpact,
      w: frame.viewport.width,
      h: frame.viewport.height,
      contextJustRestored: frame.transport.discontinuityReasons.includes('timing-discontinuity'),
    }, this.definition.feedbackReset)
    const currentRecipe = this.definition.id === REACTOR_SCENE_ID && typeof manualValues.recipe === 'string'
      ? manualValues.recipe
      : null
    const namedRecipeChanged = currentRecipe !== null
      && currentRecipe !== 'custom'
      && this.lastReactorRecipe !== null
      && currentRecipe !== this.lastReactorRecipe
    this.lastReactorRecipe = currentRecipe
    const choreographyFeedbackReset = result.choreography != null
      && (result.choreography.clearFeedback === 'at-start'
        || (reconstruct && result.choreography.clearFeedback !== 'preserve'))

    return {
      values: result.effectiveValues,
      snapshot: result.performance.snapshot,
      feedbackResetRequested: policyReset
        || namedRecipeChanged
        || result.performance.feedbackResetRequested
        || choreographyFeedbackReset,
      choreographyAction: result.choreographyAction,
      invalidRoutes: result.invalidRoutes,
    }
  }
}

function createShaderAudioFrame(frame: Readonly<CinemaFrameContext>): ShaderAudioUniformFrame {
  const hat = frame.impulses.transient && !frame.impulses.kick && !frame.impulses.snare
  return {
    sub: frame.audio.sub,
    bass: frame.audio.bass,
    lowMid: frame.audio.mid,
    mid: frame.audio.mid,
    highMid: (frame.audio.mid + frame.audio.high) * 0.5,
    high: frame.audio.high,
    air: frame.audio.high,
    kick: frame.impulses.kick ? Math.max(1, frame.audio.bass) : frame.audio.bass,
    snare: frame.impulses.snare ? Math.max(1, frame.audio.mid) : frame.audio.mid,
    hat: hat ? Math.max(1, frame.audio.high) : frame.audio.high,
    kickHit: frame.impulses.kick ? 1 : 0,
    snareHit: frame.impulses.snare ? 1 : 0,
    hatHit: hat ? 1 : 0,
    beatHit: frame.impulses.beat ? 1 : 0,
    downbeatHit: frame.impulses.downbeat ? 1 : 0,
    energy: frame.audio.energy,
    spectralCentroid: frame.audio.centroid,
    spectralFlux: frame.audio.flux,
    spectralSpread: 0,
    spectralFlatness: Math.max(0, 1 - frame.audio.harmonicity),
    tension: frame.audio.tension,
    buildProgress: frame.audio.buildProgress,
    dropImpact: frame.audio.dropImpact,
  }
}

function createShaderTimingFrame(frame: Readonly<CinemaFrameContext>): ShaderTimingUniformFrame {
  return {
    time: frame.timing.elapsedTimeSec,
    deltaTime: frame.timing.deltaTimeSec,
    playbackTime: frame.transport.audioTimeSec,
    playbackProgress: frame.transport.durationSec
      ? clamp01(frame.transport.audioTimeSec / frame.transport.durationSec)
      : 0,
    beatPhase: frame.music.beatPhase,
    barPhase: frame.music.clocks.states.bar.phase,
    phrasePhase: frame.music.clocks.states.bar8.phase,
    phrase4Progress: frame.music.clocks.states.bar4.phase,
    phrase8Progress: frame.music.clocks.states.bar8.phase,
    phrase16Progress: frame.music.clocks.states.phrase.phase,
    phrase32Progress: 0,
    sectionPhase: frame.music.sectionProgress,
    beatIndex: frame.music.beatIndex ?? 0,
    beatInBar: frame.music.beatInBar ?? 0,
    barIndex: frame.music.barIndex ?? 0,
    phrase4Hit: frame.impulses.phrase4 ? 1 : 0,
    phrase8Hit: frame.impulses.phrase8 ? 1 : 0,
    phrase16Hit: frame.music.clocks.phrase ? 1 : 0,
    phrase32Hit: 0,
    sectionType: encodeSectionType(frame.music.sectionType),
    sectionStartPulse: frame.impulses.sectionStart ? 1 : 0,
    sectionChangePulse: frame.impulses.sectionStart ? 1 : 0,
  }
}

function createMusicIntelligenceFrame(frame: Readonly<CinemaFrameContext>): MusicIntelligenceFrame {
  const sections = createResolvedSections(frame)
  const current = sections.find(section => section.id === frame.music.sectionId)
    ?? sections.find(section => frame.transport.audioTimeSec >= section.startSec && frame.transport.audioTimeSec < section.endSec)
    ?? null
  const hatHit = frame.impulses.transient && !frame.impulses.kick && !frame.impulses.snare
  const hasMI = frame.capabilities.musicIntelligence
  const confidence = hasMI ? 1 : 0
  return {
    ...DEFAULT_MI_FRAME,
    timeSec: frame.transport.audioTimeSec,
    frameId: frame.timing.frameIndex + 1,
    sourceId: frame.transport.trackId,
    trackId: frame.transport.trackId,
    bands: {
      sub: frame.audio.sub,
      bass: frame.audio.bass,
      lowMid: frame.audio.mid,
      mid: frame.audio.mid,
      high: frame.audio.high,
      air: frame.audio.high,
      volume: frame.audio.volume,
      normalizedSub: frame.audio.sub,
      normalizedBass: frame.audio.bass,
      normalizedLowMid: frame.audio.mid,
      normalizedMid: frame.audio.mid,
      normalizedHigh: frame.audio.high,
      normalizedAir: frame.audio.high,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: frame.music.bpm ?? 0,
      bpmConfidence: frame.capabilities.beatGrid ? 1 : 0,
      beatPhase: frame.music.beatPhase,
      beatHit: frame.impulses.beat,
      beatIndex: frame.music.beatIndex ?? 0,
      beatInBar: frame.music.beatInBar ?? 0,
      barIndex: frame.music.barIndex ?? 0,
      downbeatHit: frame.impulses.downbeat,
      phrase4Progress: frame.music.clocks.states.bar4.phase,
      phrase8Progress: frame.music.clocks.states.bar8.phase,
      phrase16Progress: frame.music.clocks.states.phrase.phase,
      phrase4Hit: frame.impulses.phrase4,
      phrase8Hit: frame.impulses.phrase8,
      phrase16Hit: frame.music.clocks.phrase,
      kickHit: frame.impulses.kick,
      kickStrength: frame.impulses.kick ? Math.max(1, frame.audio.bass) : frame.audio.bass,
      snareHit: frame.impulses.snare,
      snareStrength: frame.impulses.snare ? Math.max(1, frame.audio.mid) : frame.audio.mid,
      hatHit,
      hatStrength: hatHit ? Math.max(1, frame.audio.high) : frame.audio.high,
      transient: frame.impulses.transient ? Math.max(1, frame.audio.flux) : frame.audio.flux,
      transientConfidence: frame.capabilities.analyser ? 1 : 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: frame.audio.energy,
      shortTerm: frame.audio.energy,
      longTerm: frame.audio.energy,
      peak: Math.max(frame.audio.volume, frame.audio.rms, frame.audio.energy),
      rms: frame.audio.rms,
      spectralFlux: frame.audio.flux,
      percentile: frame.audio.energy,
      buildProgress: frame.audio.buildProgress,
      dropImpact: frame.audio.dropImpact,
      tension: frame.audio.tension,
      complexity: frame.audio.complexity,
      spectralCentroid: frame.audio.centroid,
      spectralFlatness: Math.max(0, 1 - frame.audio.harmonicity),
    },
    section: {
      type: normalizeSectionType(frame.music.sectionType),
      label: current?.label ?? frame.music.sectionType ?? '',
      startSec: current?.startSec ?? inferSectionStart(frame),
      endSec: current?.endSec ?? inferSectionEnd(frame),
      progress: frame.music.sectionProgress,
      intensity: frame.audio.energy,
      confidence: frame.capabilities.authoritativeSections ? 1 : 0,
      source: 'inferred',
    },
    stems: {
      ...DEFAULT_MI_FRAME.stems,
      vocalEnergy: frame.audio.vocalPresence,
      vocalActivity: frame.audio.vocalPresence,
    },
    lyrics: {
      ...DEFAULT_MI_FRAME.lyrics,
      activeLine: frame.lyrics.lineText,
      activeLineId: frame.lyrics.lineId,
      activeWord: frame.lyrics.wordText,
      activeWordId: frame.lyrics.wordId,
      vocalActivity: frame.audio.vocalPresence,
      phraseConfidence: frame.capabilities.lyrics ? 1 : 0,
      lyricLineProgress: frame.lyrics.lineProgress,
      wordProgress: frame.lyrics.wordProgress,
      wordHit: frame.impulses.lyricWord,
      lineEnter: frame.impulses.lyricCue,
      lineExit: frame.lyrics.lineEnded === true,
      isGap: frame.lyrics.lineAbsent === true,
    },
    semantics: {
      ...DEFAULT_MI_FRAME.semantics,
      buildConfidence: frame.audio.buildProgress,
      dropConfidence: frame.audio.dropImpact,
      vocalHookConfidence: frame.audio.vocalPresence,
    },
    capabilities: {
      liveBands: frame.capabilities.analyser,
      rhythmEvents: frame.capabilities.musicIntelligence || frame.capabilities.sharedPerformance,
      beatGrid: frame.capabilities.beatGrid,
      sections: frame.capabilities.authoritativeSections,
      trackEnergyCurve: frame.capabilities.musicIntelligence,
      stemCurves: false,
      lyrics: frame.capabilities.lyrics,
    },
    resolvedSections: sections,
    currentResolvedSection: current ? { ...current, progress: frame.music.sectionProgress } : null,
    analysisRevision: frame.transport.trackId,
    timelineRevision: sections.map(section => `${section.id}:${section.startSec}:${section.endSec}`).join('|'),
    raw: {
      freqData: frame.audio.fft as Uint8Array<ArrayBuffer> | null,
      timeDomainData: frame.audio.waveform as Uint8Array<ArrayBuffer> | null,
    },
    confidence: {
      overall: confidence,
      rhythm: frame.capabilities.beatGrid ? 1 : confidence,
      harmonic: 0,
      section: frame.capabilities.authoritativeSections ? 1 : 0,
    },
  }
}

function createResolvedSections(frame: Readonly<CinemaFrameContext>): ReactTrackSection[] {
  const timeline = frame.music.resolvedSections ?? []
  if (timeline.length > 0) {
    return timeline.map(section => ({
      id: section.id,
      label: section.label,
      type: normalizeSectionType(section.type) ?? 'unknown',
      startSec: section.startSec,
      endSec: section.endSec,
      intensity: section.intensity,
      confidence: section.confidence,
      source: normalizeSectionSource(section.source),
      dropConfidence: section.dropConfidence,
      interpretation: section.familyId || section.occurrenceIndex != null ? {
        familyId: section.familyId ?? undefined,
        occurrenceIndex: section.occurrenceIndex ?? undefined,
      } : undefined,
    }))
  }
  if (!frame.music.sectionId || !frame.music.sectionType) return []
  return [{
    id: frame.music.sectionId,
    label: frame.music.sectionType,
    type: normalizeSectionType(frame.music.sectionType) ?? 'unknown',
    startSec: inferSectionStart(frame),
    endSec: inferSectionEnd(frame),
    intensity: frame.audio.energy,
    confidence: frame.capabilities.authoritativeSections ? 1 : 0.25,
    source: 'auto',
    dropConfidence: frame.audio.dropImpact,
  }]
}

function inferSectionStart(frame: Readonly<CinemaFrameContext>): number {
  const duration = inferSectionDuration(frame)
  return Math.max(0, frame.transport.audioTimeSec - duration * frame.music.sectionProgress)
}

function inferSectionEnd(frame: Readonly<CinemaFrameContext>): number {
  return inferSectionStart(frame) + inferSectionDuration(frame)
}

function inferSectionDuration(frame: Readonly<CinemaFrameContext>): number {
  if (frame.transport.durationSec && frame.transport.durationSec > 0) {
    return Math.max(1, Math.min(32, frame.transport.durationSec))
  }
  return 16
}

function normalizeSectionType(value: string | null): ReactSectionType | null {
  if (!value) return null
  const normalized = value.replace(/[\s_-]+/g, '').toLowerCase()
  switch (normalized) {
    case 'intro': return 'intro'
    case 'verse': return 'verse'
    case 'build': return 'build'
    case 'predrop': return 'preDrop'
    case 'drop': return 'drop'
    case 'breakdown': return 'breakdown'
    case 'bridge': return 'bridge'
    case 'outro': return 'outro'
    default: return 'unknown'
  }
}

function normalizeSectionSource(value: string | null): ReactTrackSectionSource | undefined {
  switch (value) {
    case 'auto':
    case 'user-created':
    case 'user-edited-auto':
    case 'mock': return value
    default: return undefined
  }
}

function encodeSectionType(value: string | null): number {
  switch (normalizeSectionType(value)) {
    case 'intro': return 1
    case 'verse': return 2
    case 'build': return 3
    case 'preDrop': return 4
    case 'drop': return 5
    case 'breakdown': return 6
    case 'bridge': return 7
    case 'outro': return 8
    case 'unknown': return 9
    default: return 0
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}
