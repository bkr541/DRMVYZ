// Public API for the Music Intelligence system.

export type {
  MusicIntelligenceFrame,
  MIBands,
  MIRhythm,
  MIEnergy,
  MISection,
  MIHarmonic,
  MIStems,
  MILyrics,
  MISemantics,
  SectionSource,
  MelodyContourLabel,
  MoodLabel,
  TextureLabel,
  TrackIntelligenceAnalysis,
  TrackSectionMI,
  BeatMarkerMI,
  PhraseMarker,
  FeatureCurve,
  FeatureCurvePoint,
  StemFeatureCurve,
  StemTrackCurves,
  ChordMarker,
  LyricLineMI,
  LyricWordMI,
  SemanticMomentMarker,
  AnalysisStatus,
  VisualAutomationSuggestion,
} from './types'

export { DEFAULT_MI_FRAME } from './constants'

export { AudioFeatureBus } from './AudioFeatureBus'

export {
  EMAFilter,
  PeakFollower,
  RunningMax,
  FeatureRingBuffer,
  AttackReleaseFilter,
  applyCurve,
} from './featureSmoothing'

export type { CurveType, CurveParams } from './featureSmoothing'

export type { BandConfig, ExtendedBandStats, BandAnalysisResult } from './bandAnalysis'
export { MultiBandAnalyzer, DEFAULT_BAND_CONFIGS, getBandAvg } from './bandAnalysis'

export type { RhythmAnalysisResult } from './rhythmAnalysis'
export { RhythmAnalyzer } from './rhythmAnalysis'

export type { BeatGridState } from './beatGrid'
export { BeatGrid } from './beatGrid'

export type { MeydaFeatureSnapshot, EnergyAnalysisResult } from './energyAnalysis'
export { EnergyAnalyzer } from './energyAnalysis'

export {
  selectBands,
  selectRhythm,
  selectEnergy,
  selectCurrentSection,
  miFrameToAudioBandValues,
  getModulationSourceValue,
  getTriggerSourceValue,
  getConditionSourceValue,
} from './selectors'

export type {
  MusicIntelligenceEngineOptions,
  AnalyserInputFrame,
  AudioFrameInput,
} from './MusicIntelligenceEngine'

export {
  MusicIntelligenceEngine,
  musicIntelligenceEngine,
} from './MusicIntelligenceEngine'

export type { SectionDetectionOptions } from './sectionAnalysis'
export { detectSections } from './sectionAnalysis'

export type { TrackAnalysisOptions } from './offlineTrackAnalyzer'
export { analyzeTrackBuffer } from './offlineTrackAnalyzer'

export { useTrackAnalysisStore } from './trackAnalysisStorage'

export type { HarmonicAnalysisResult } from './harmonicAnalysis'
export { HarmonicAnalyzer } from './harmonicAnalysis'

export type { StemAnalysisBackend } from './stemAnalysis'
export {
  StemCurveInterpolator,
  nullStemBackend,
  setStemAnalysisBackend,
  getStemAnalysisBackend,
  emptyStems,
} from './stemAnalysis'

export { SemanticAnalyzer, detectSemanticMoments, suggestVisualAutomation } from './semanticAnalysis'

export type {
  ModulationSourceKey,
  MISourceCategory,
  MISourceDef,
} from '../../lib/miSourceRegistry'
export {
  MI_SOURCE_REGISTRY,
  MI_SOURCES_BY_CATEGORY,
  MI_SOURCE_CATEGORY_LABELS,
  getMISourceLabel,
  getMISourceDef,
} from '../../lib/miSourceRegistry'
