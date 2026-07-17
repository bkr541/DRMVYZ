import {
  resolveSharedPerformanceSignals,
  type SharedPerformanceContext,
  type SharedPerformanceSignalFrame,
} from '../../../../features/performanceCore'
import type {
  PixGridAudioSourceCategory,
  PixGridAudioSourceKind,
  PixGridContinuousAudioSource,
  PixGridReactionCapabilityFallback,
  PixGridReactionCurve,
  PixGridReactionSource,
  PixGridReactionTarget,
} from './PixGridTypes'

export interface PixGridAudioIntelligenceSourceDefinition {
  id: PixGridReactionSource
  label: string
  category: PixGridAudioSourceCategory
  kind: PixGridAudioSourceKind
  valueRange: readonly [number, number]
  defaultNormalization: 'identity' | 'clamp01' | 'signedClamp' | 'event'
  confidenceAvailable: boolean
  optional: boolean
  recommendedTargets: readonly PixGridReactionTarget[]
  recommendedCurve: PixGridReactionCurve
  recommendedSmoothing: Readonly<{ attack: number; hold: number; release: number; smoothing: number }>
  capabilityFallback: PixGridReactionCapabilityFallback
  diagnosticFormatter: (value: number) => string
  resolve: (context: SharedPerformanceContext, signals: SharedPerformanceSignalFrame) => number
  available: (context: SharedPerformanceContext) => boolean
  confidence: (context: SharedPerformanceContext) => number
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const percent = (value: number): string => `${Math.round(clamp01(value) * 100)}%`
const event = (value: number): string => (value > 0 ? 'triggered' : 'idle')
const eventStrength = (active: boolean, strength: number): number => active ? (strength > 0 ? clamp01(strength) : 1) : 0
const always = (): boolean => true
const overall = (context: SharedPerformanceContext): number => clamp01(context.confidence.overall)
const rhythm = (context: SharedPerformanceContext): number => clamp01(context.confidence.rhythm)
const section = (context: SharedPerformanceContext): number => clamp01(context.confidence.section)
const phrase = (context: SharedPerformanceContext): number => clamp01(context.confidence.phrase)
const semantics = (context: SharedPerformanceContext): number => clamp01(context.confidence.semantics)
const liveBands = (context: SharedPerformanceContext): boolean => context.capabilities.liveBands
const beatGrid = (context: SharedPerformanceContext): boolean => context.capabilities.beatGrid
const sections = (context: SharedPerformanceContext): boolean => context.capabilities.sections
const stemCurves = (context: SharedPerformanceContext): boolean => context.capabilities.stemCurves
const vocals = (context: SharedPerformanceContext): boolean => context.capabilities.stemCurves || context.capabilities.lyrics
const semanticMoments = (context: SharedPerformanceContext): boolean => context.analysisCapabilities?.semanticMoments === true
const rhythmEvents = (context: SharedPerformanceContext): boolean => context.capabilities.rhythmEvents
const trackEnergy = (context: SharedPerformanceContext): boolean => context.capabilities.trackEnergyCurve

const MODULATION_TARGETS = Object.freeze([
  'brightness', 'opacity', 'globalIntensity', 'glow', 'contrast', 'saturation', 'scale', 'animationSpeed',
] as const satisfies readonly PixGridReactionTarget[])
const PROGRESS_TARGETS = Object.freeze([
  'reveal', 'rowRecruitment', 'columnRecruitment', 'density', 'paletteCycle', 'positionX', 'positionY',
] as const satisfies readonly PixGridReactionTarget[])
const EVENT_TARGETS = Object.freeze([
  'brightness', 'scale', 'outlineFlash', 'sparkleDensity', 'frameAdvance', 'pixelScatter', 'sceneEmphasis',
] as const satisfies readonly PixGridReactionTarget[])

function source(
  definition: Omit<PixGridAudioIntelligenceSourceDefinition, 'valueRange' | 'defaultNormalization' | 'confidenceAvailable' | 'diagnosticFormatter'>
  & Partial<Pick<PixGridAudioIntelligenceSourceDefinition, 'valueRange' | 'defaultNormalization' | 'confidenceAvailable' | 'diagnosticFormatter'>>,
): PixGridAudioIntelligenceSourceDefinition {
  return Object.freeze({
    valueRange: [0, 1] as const,
    defaultNormalization: definition.kind === 'continuousSigned' ? 'signedClamp' : definition.kind.includes('Event') || definition.kind === 'musicalBoundary' ? 'event' : 'clamp01',
    confidenceAvailable: true,
    diagnosticFormatter: definition.kind.includes('Event') || definition.kind === 'musicalBoundary' ? event : percent,
    ...definition,
  })
}

const DEFINITIONS: readonly PixGridAudioIntelligenceSourceDefinition[] = Object.freeze([
  source({ id: 'sub', label: 'Sub', category: 'frequency', kind: 'continuousNormalized', optional: true, recommendedTargets: MODULATION_TARGETS, recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.03, hold: 0, release: 0.12, smoothing: 0.06 }, capabilityFallback: 'energy', resolve: context => context.intelligence.bands.raw.sub, available: liveBands, confidence: overall }),
  source({ id: 'bass', label: 'Bass', category: 'frequency', kind: 'continuousNormalized', optional: false, recommendedTargets: MODULATION_TARGETS, recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.02, hold: 0, release: 0.1, smoothing: 0.04 }, capabilityFallback: 'energy', resolve: context => context.bass, available: liveBands, confidence: overall }),
  source({ id: 'lowMid', label: 'Low-mid', category: 'frequency', kind: 'continuousNormalized', optional: true, recommendedTargets: MODULATION_TARGETS, recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.04, hold: 0, release: 0.14, smoothing: 0.08 }, capabilityFallback: 'energy', resolve: context => context.intelligence.bands.raw.lowMid, available: liveBands, confidence: overall }),
  source({ id: 'mid', label: 'Mid', category: 'frequency', kind: 'continuousNormalized', optional: false, recommendedTargets: MODULATION_TARGETS, recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.04, hold: 0, release: 0.14, smoothing: 0.08 }, capabilityFallback: 'midHighActivity', resolve: context => context.mid, available: liveBands, confidence: overall }),
  source({ id: 'high', label: 'High', category: 'frequency', kind: 'continuousNormalized', optional: false, recommendedTargets: [...MODULATION_TARGETS, 'sparkleDensity'], recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.02, hold: 0, release: 0.09, smoothing: 0.04 }, capabilityFallback: 'midHighActivity', resolve: context => context.high, available: liveBands, confidence: overall }),
  source({ id: 'air', label: 'Air', category: 'frequency', kind: 'continuousNormalized', optional: true, recommendedTargets: ['sparkleDensity', 'glow', 'saturation', 'outlineIntensity'], recommendedCurve: 'exponential', recommendedSmoothing: { attack: 0.02, hold: 0, release: 0.08, smoothing: 0.04 }, capabilityFallback: 'midHighActivity', resolve: context => context.intelligence.bands.raw.air, available: liveBands, confidence: overall }),
  source({ id: 'volume', label: 'Overall volume', category: 'level', kind: 'continuousNormalized', optional: false, recommendedTargets: MODULATION_TARGETS, recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.05, hold: 0, release: 0.18, smoothing: 0.08 }, capabilityFallback: 'zero', resolve: context => context.intelligence.bands.raw.volume, available: liveBands, confidence: overall }),
  source({ id: 'energy', label: 'Overall energy', category: 'level', kind: 'continuousNormalized', optional: false, recommendedTargets: MODULATION_TARGETS, recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.08, hold: 0, release: 0.2, smoothing: 0.1 }, capabilityFallback: 'zero', resolve: (_context, signals) => signals.continuous.energy, available: always, confidence: overall }),
  source({ id: 'trackRelativeEnergy', label: 'Track-relative energy', category: 'level', kind: 'continuousNormalized', optional: true, recommendedTargets: [...MODULATION_TARGETS, 'density', 'sceneEmphasis'], recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.12, hold: 0, release: 0.28, smoothing: 0.12 }, capabilityFallback: 'energy', resolve: (_context, signals) => signals.continuous.trackRelativeEnergy, available: trackEnergy, confidence: overall }),
  source({ id: 'spectralFlux', label: 'Spectral flux', category: 'development', kind: 'continuousNormalized', optional: false, recommendedTargets: ['pixelDisplacement', 'sparkleDensity', 'contrast', 'animationSpeed'], recommendedCurve: 'exponential', recommendedSmoothing: { attack: 0.02, hold: 0, release: 0.08, smoothing: 0.03 }, capabilityFallback: 'transient', resolve: (_context, signals) => signals.continuous.spectralFlux, available: always, confidence: overall }),
  source({ id: 'spectralBrightness', label: 'Spectral brightness', category: 'development', kind: 'continuousNormalized', optional: true, recommendedTargets: ['saturation', 'hueOffset', 'paletteCycle', 'glow'], recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.08, hold: 0, release: 0.2, smoothing: 0.1 }, capabilityFallback: 'midHighActivity', resolve: context => context.intelligence.energy.spectralCentroid, available: liveBands, confidence: overall }),
  source({ id: 'tension', label: 'Tension', category: 'development', kind: 'continuousNormalized', optional: false, recommendedTargets: ['animationSpeed', 'contrast', 'pixelDisplacement', 'scrollRate', 'maskContraction'], recommendedCurve: 'easeIn', recommendedSmoothing: { attack: 0.15, hold: 0, release: 0.3, smoothing: 0.12 }, capabilityFallback: 'energy', resolve: (_context, signals) => signals.continuous.tension, available: always, confidence: overall }),
  source({ id: 'complexity', label: 'Complexity', category: 'development', kind: 'continuousNormalized', optional: false, recommendedTargets: ['density', 'sparkleDensity', 'posterize', 'pixelScatter'], recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.16, hold: 0, release: 0.32, smoothing: 0.14 }, capabilityFallback: 'energy', resolve: (_context, signals) => signals.continuous.complexity, available: always, confidence: overall }),
  source({ id: 'buildProgress', label: 'Build progress', category: 'progress', kind: 'progress', optional: false, recommendedTargets: ['rowRecruitment', 'columnRecruitment', 'density', 'animationSpeed', 'glow'], recommendedCurve: 'easeIn', recommendedSmoothing: { attack: 0.04, hold: 0, release: 0.12, smoothing: 0.04 }, capabilityFallback: 'energy', resolve: (_context, signals) => signals.continuous.buildProgress, available: always, confidence: section }),
  source({ id: 'sectionProgress', label: 'Section progress', category: 'progress', kind: 'progress', optional: true, recommendedTargets: PROGRESS_TARGETS, recommendedCurve: 'linear', recommendedSmoothing: { attack: 0, hold: 0, release: 0, smoothing: 0 }, capabilityFallback: 'zero', resolve: (_context, signals) => signals.continuous.sectionProgress, available: sections, confidence: section }),
  source({ id: 'phraseProgress', label: 'Phrase progress', category: 'progress', kind: 'progress', optional: true, recommendedTargets: PROGRESS_TARGETS, recommendedCurve: 'linear', recommendedSmoothing: { attack: 0, hold: 0, release: 0, smoothing: 0 }, capabilityFallback: 'zero', resolve: (_context, signals) => signals.continuous.phraseProgress, available: beatGrid, confidence: phrase }),
  source({ id: 'barProgress', label: 'Bar progress', category: 'progress', kind: 'progress', optional: true, recommendedTargets: ['positionX', 'positionY', 'paletteCycle', 'frameIndex'], recommendedCurve: 'linear', recommendedSmoothing: { attack: 0, hold: 0, release: 0, smoothing: 0 }, capabilityFallback: 'zero', resolve: context => (context.beatWithinBar + context.beatPhase) / Math.max(1, context.timeSignature), available: beatGrid, confidence: context => context.confidence.grid }),
  source({ id: 'beatPhase', label: 'Beat phase', category: 'progress', kind: 'progress', optional: true, recommendedTargets: ['scale', 'bounceAmount', 'frameIndex', 'positionY'], recommendedCurve: 'inverse', recommendedSmoothing: { attack: 0, hold: 0, release: 0, smoothing: 0 }, capabilityFallback: 'zero', resolve: context => context.beatPhase, available: beatGrid, confidence: rhythm }),
  source({ id: 'sectionRelativeEnergy', label: 'Section-relative energy', category: 'level', kind: 'continuousNormalized', optional: true, recommendedTargets: [...MODULATION_TARGETS, 'sceneEmphasis'], recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.1, hold: 0, release: 0.22, smoothing: 0.1 }, capabilityFallback: 'energy', resolve: context => clamp01(context.energy / Math.max(0.15, context.resolvedSection?.intensity ?? context.intelligence.section.intensity ?? 0.5)), available: sections, confidence: section }),
  source({ id: 'sectionConfidence', label: 'Section confidence', category: 'confidence', kind: 'continuousNormalized', optional: true, recommendedTargets: ['opacity', 'sceneEmphasis', 'transitionStrength'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0.08, hold: 0, release: 0.16, smoothing: 0.08 }, capabilityFallback: 'zero', resolve: context => context.sectionConfidence, available: sections, confidence: section }),
  source({ id: 'phraseConfidence', label: 'Phrase confidence', category: 'confidence', kind: 'continuousNormalized', optional: true, recommendedTargets: ['opacity', 'reveal', 'frameIndex'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0.08, hold: 0, release: 0.16, smoothing: 0.08 }, capabilityFallback: 'zero', resolve: context => Math.max(context.confidence.phrase, context.intelligence.lyrics.phraseConfidence), available: context => context.capabilities.beatGrid || context.capabilities.lyrics, confidence: phrase }),
  source({ id: 'vocalEnergy', label: 'Vocal energy', category: 'stem', kind: 'continuousNormalized', optional: true, recommendedTargets: ['brightness', 'opacity', 'highlightColor', 'outlineIntensity', 'reveal'], recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.05, hold: 0, release: 0.22, smoothing: 0.08 }, capabilityFallback: 'midHighActivity', resolve: (_context, signals) => signals.continuous.vocalEnergy, available: vocals, confidence: overall }),
  source({ id: 'vocalActivity', label: 'Vocal activity', category: 'stem', kind: 'continuousNormalized', optional: true, recommendedTargets: ['opacity', 'reveal', 'layerRecruitment', 'highlightColor'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0.08, hold: 0, release: 0.28, smoothing: 0.08 }, capabilityFallback: 'midHighActivity', resolve: context => Math.max(context.intelligence.stems.vocalActivity, context.intelligence.lyrics.vocalActivity), available: vocals, confidence: overall }),
  source({ id: 'drumActivity', label: 'Drum activity', category: 'stem', kind: 'continuousNormalized', optional: true, recommendedTargets: ['brightness', 'scale', 'pixelDisplacement', 'animationSpeed'], recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.03, hold: 0, release: 0.12, smoothing: 0.04 }, capabilityFallback: 'transient', resolve: context => context.intelligence.stems.drumEnergy, available: stemCurves, confidence: overall }),
  source({ id: 'bassStemActivity', label: 'Bass stem activity', category: 'stem', kind: 'continuousNormalized', optional: true, recommendedTargets: ['brightness', 'scale', 'glow', 'rowRecruitment'], recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.04, hold: 0, release: 0.14, smoothing: 0.05 }, capabilityFallback: 'energy', resolve: context => context.intelligence.stems.bassStemEnergy, available: stemCurves, confidence: overall }),
  source({ id: 'melodyActivity', label: 'Melody / harmonic activity', category: 'stem', kind: 'continuousNormalized', optional: true, recommendedTargets: ['paletteCycle', 'hueOffset', 'saturation', 'positionY'], recommendedCurve: 'smoothstep', recommendedSmoothing: { attack: 0.1, hold: 0, release: 0.24, smoothing: 0.1 }, capabilityFallback: 'midHighActivity', resolve: context => context.intelligence.stems.instrumentEnergy, available: stemCurves, confidence: context => context.intelligence.sourceConfidence('harmonic') }),
  source({ id: 'semanticMomentStrength', label: 'Semantic moment strength', category: 'semantic', kind: 'continuousNormalized', optional: true, recommendedTargets: ['sceneEmphasis', 'transitionStrength', 'glow', 'contrast'], recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.02, hold: 0.08, release: 0.3, smoothing: 0.04 }, capabilityFallback: 'disable', resolve: (context, signals) => Math.max(signals.discrete.semanticMoment.strength, context.intelligence.semantics.buildConfidence, context.intelligence.semantics.dropConfidence, context.intelligence.semantics.fakeoutConfidence, context.intelligence.semantics.vocalHookConfidence), available: context => semanticMoments(context) || context.analysisCapabilities?.semanticClassification === true, confidence: semantics }),

  source({ id: 'beat', label: 'Beat', category: 'rhythm', kind: 'discreteEvent', optional: true, recommendedTargets: EVENT_TARGETS, recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.01, hold: 0.02, release: 0.12, smoothing: 0 }, capabilityFallback: 'disable', resolve: (_context, signals) => eventStrength(signals.discrete.beat.active, signals.discrete.beat.strength), available: context => beatGrid(context) || rhythmEvents(context), confidence: rhythm }),
  source({ id: 'downbeat', label: 'Downbeat', category: 'rhythm', kind: 'discreteEvent', optional: true, recommendedTargets: EVENT_TARGETS, recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.01, hold: 0.03, release: 0.18, smoothing: 0 }, capabilityFallback: 'beat', resolve: (_context, signals) => eventStrength(signals.discrete.downbeat.active, signals.discrete.downbeat.strength), available: beatGrid, confidence: context => context.confidence.downbeat }),
  source({ id: 'kick', label: 'Kick', category: 'rhythm', kind: 'discreteEvent', optional: true, recommendedTargets: EVENT_TARGETS, recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.005, hold: 0.02, release: 0.15, smoothing: 0 }, capabilityFallback: 'transient', resolve: (_context, signals) => eventStrength(signals.discrete.kick.active, signals.discrete.kick.strength), available: rhythmEvents, confidence: context => context.transientConfidence }),
  source({ id: 'snare', label: 'Snare', category: 'rhythm', kind: 'discreteEvent', optional: true, recommendedTargets: ['outlineFlash', 'highlightColor', 'brightness', 'frameAdvance'], recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.005, hold: 0.025, release: 0.17, smoothing: 0 }, capabilityFallback: 'transient', resolve: (_context, signals) => eventStrength(signals.discrete.snare.active, signals.discrete.snare.strength), available: rhythmEvents, confidence: context => context.transientConfidence }),
  source({ id: 'hat', label: 'Hat', category: 'rhythm', kind: 'discreteEvent', optional: true, recommendedTargets: ['sparkleDensity', 'checkerAlternation', 'frameAdvance', 'outlineIntensity'], recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.002, hold: 0.01, release: 0.08, smoothing: 0 }, capabilityFallback: 'transient', resolve: (_context, signals) => eventStrength(signals.discrete.hat.active, signals.discrete.hat.strength), available: rhythmEvents, confidence: context => context.transientConfidence }),
  source({ id: 'transient', label: 'General transient', category: 'rhythm', kind: 'discreteEvent', optional: false, recommendedTargets: EVENT_TARGETS, recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.002, hold: 0.015, release: 0.1, smoothing: 0 }, capabilityFallback: 'beat', resolve: (_context, signals) => eventStrength(signals.discrete.transient.active, signals.discrete.transient.strength), available: rhythmEvents, confidence: context => context.transientConfidence }),
  source({ id: 'barEntry', label: 'Bar entry', category: 'boundary', kind: 'musicalBoundary', optional: true, recommendedTargets: ['frameAdvance', 'paletteCycle', 'direction', 'sceneEmphasis'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0, hold: 0.04, release: 0.08, smoothing: 0 }, capabilityFallback: 'beat', resolve: (_context, signals) => signals.discrete.barEntry.active ? 1 : 0, available: beatGrid, confidence: context => context.confidence.grid }),
  source({ id: 'fourBarBoundary', label: 'Four-bar boundary', category: 'boundary', kind: 'musicalBoundary', optional: true, recommendedTargets: ['layerRecruitment', 'groupRecruitment', 'paletteCycle', 'sceneEmphasis'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0, hold: 0.06, release: 0.12, smoothing: 0 }, capabilityFallback: 'beat', resolve: (_context, signals) => signals.discrete.fourBarBoundary.active ? 1 : 0, available: beatGrid, confidence: context => context.confidence.grid }),
  source({ id: 'eightBarBoundary', label: 'Eight-bar boundary', category: 'boundary', kind: 'musicalBoundary', optional: true, recommendedTargets: ['layerRecruitment', 'groupRecruitment', 'paletteCycle', 'sceneEmphasis'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0, hold: 0.08, release: 0.15, smoothing: 0 }, capabilityFallback: 'beat', resolve: (_context, signals) => signals.discrete.eightBarBoundary.active ? 1 : 0, available: beatGrid, confidence: context => context.confidence.grid }),
  source({ id: 'sixteenBarBoundary', label: 'Sixteen-bar boundary', category: 'boundary', kind: 'musicalBoundary', optional: true, recommendedTargets: ['layerRecruitment', 'groupRecruitment', 'paletteCycle', 'sceneEmphasis'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0, hold: 0.1, release: 0.18, smoothing: 0 }, capabilityFallback: 'beat', resolve: (_context, signals) => signals.discrete.sixteenBarBoundary.active ? 1 : 0, available: beatGrid, confidence: context => context.confidence.grid }),
  source({ id: 'phraseEntry', label: 'Phrase entry', category: 'boundary', kind: 'musicalBoundary', optional: true, recommendedTargets: ['layerRecruitment', 'frameAdvance', 'paletteCycle', 'transitionStrength'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0, hold: 0.08, release: 0.14, smoothing: 0 }, capabilityFallback: 'beat', resolve: context => context.boundaries.barBoundary && context.phraseProgress < 0.04 ? 1 : 0, available: context => context.capabilities.beatGrid || context.analysisCapabilities?.phraseHierarchy === true, confidence: phrase }),
  source({ id: 'sectionEntry', label: 'Section entry', category: 'boundary', kind: 'sectionEvent', optional: true, recommendedTargets: ['sceneEmphasis', 'transitionStrength', 'layerRecruitment', 'paletteCycle'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0, hold: 0.1, release: 0.2, smoothing: 0 }, capabilityFallback: 'disable', resolve: (_context, signals) => signals.discrete.sectionEntry.active ? 1 : 0, available: sections, confidence: section }),
  source({ id: 'sectionExit', label: 'Section exit', category: 'boundary', kind: 'sectionEvent', optional: true, recommendedTargets: ['transitionStrength', 'hide', 'dissolveThreshold'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0, hold: 0.08, release: 0.18, smoothing: 0 }, capabilityFallback: 'disable', resolve: (_context, signals) => signals.discrete.sectionExit.active ? 1 : 0, available: sections, confidence: section }),
  source({ id: 'dropImpact', label: 'Drop impact', category: 'semantic', kind: 'semanticEvent', optional: false, recommendedTargets: ['brightness', 'scale', 'pixelScatter', 'sceneEmphasis', 'glow'], recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.002, hold: 0.05, release: 0.28, smoothing: 0 }, capabilityFallback: 'transient', resolve: (_context, signals) => signals.discrete.dropImpact.active ? signals.discrete.dropImpact.strength : 0, available: always, confidence: semantics }),
  source({ id: 'dropOccurrenceChange', label: 'Drop occurrence change', category: 'semantic', kind: 'sectionEvent', optional: true, recommendedTargets: ['paletteCycle', 'layerRecruitment', 'groupRecruitment', 'sceneEmphasis'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0, hold: 0.1, release: 0.22, smoothing: 0 }, capabilityFallback: 'disable', resolve: context => context.boundaries.sectionEntry && (context.sectionType === 'drop' || context.macroSectionType === 'drop') ? 1 : 0, available: sections, confidence: section }),
  source({ id: 'semanticMoment', label: 'Semantic moment', category: 'semantic', kind: 'semanticEvent', optional: true, recommendedTargets: ['sceneEmphasis', 'transitionStrength', 'highlightColor', 'pixelScatter'], recommendedCurve: 'easeOut', recommendedSmoothing: { attack: 0.005, hold: 0.08, release: 0.3, smoothing: 0 }, capabilityFallback: 'disable', resolve: (_context, signals) => signals.discrete.semanticMoment.active ? signals.discrete.semanticMoment.strength : 0, available: semanticMoments, confidence: semantics }),
  source({ id: 'trackMapCueEvent', label: 'Track Map cue event', category: 'cue', kind: 'discreteEvent', optional: true, recommendedTargets: ['sceneEmphasis', 'transitionStrength', 'frameAdvance', 'paletteCycle'], recommendedCurve: 'gate', recommendedSmoothing: { attack: 0, hold: 0.04, release: 0.12, smoothing: 0 }, capabilityFallback: 'disable', resolve: () => 0, available: () => false, confidence: () => 0 }),
])

// Fallback IDs intentionally remain a compact enum in persisted assignments. Some
// registry recommendations above are expressed through the nearest persisted
// fallback and are resolved by the runtime, never by a second analysis engine.

export const PIX_GRID_AUDIO_INTELLIGENCE_SOURCES = DEFINITIONS
export const PIX_GRID_AUDIO_INTELLIGENCE_SOURCE_BY_ID = new Map(DEFINITIONS.map(definition => [definition.id, definition]))

export function getPixGridAudioIntelligenceSource(sourceId: PixGridReactionSource): PixGridAudioIntelligenceSourceDefinition {
  const definition = PIX_GRID_AUDIO_INTELLIGENCE_SOURCE_BY_ID.get(sourceId)
  if (!definition) throw new Error(`Unknown PixGrid Audio Intelligence source: ${sourceId}`)
  return definition
}

export function isPixGridContinuousSourceDefinition(definition: PixGridAudioIntelligenceSourceDefinition): definition is PixGridAudioIntelligenceSourceDefinition & { id: PixGridContinuousAudioSource } {
  return definition.kind !== 'discreteEvent' && definition.kind !== 'musicalBoundary' && definition.kind !== 'sectionEvent' && definition.kind !== 'semanticEvent'
}

export function resolvePixGridAudioIntelligenceInventory(context: SharedPerformanceContext): {
  values: Record<PixGridReactionSource, number>
  capabilities: Record<PixGridReactionSource, boolean>
  confidence: Record<PixGridReactionSource, number>
} {
  const signals = resolveSharedPerformanceSignals(context)
  const values = {} as Record<PixGridReactionSource, number>
  const capabilities = {} as Record<PixGridReactionSource, boolean>
  const confidence = {} as Record<PixGridReactionSource, number>
  for (const definition of DEFINITIONS) {
    values[definition.id] = clamp01(definition.resolve(context, signals))
    capabilities[definition.id] = definition.available(context)
    confidence[definition.id] = clamp01(definition.confidence(context))
  }
  return { values, capabilities, confidence }
}
