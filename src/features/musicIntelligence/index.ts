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
  ChordMarker,
  LyricLineMI,
  LyricWordMI,
  SemanticMomentMarker,
  AnalysisStatus,
} from './types'

export { DEFAULT_MI_FRAME } from './constants'

export { AudioFeatureBus } from './AudioFeatureBus'

export {
  EMAFilter,
  PeakFollower,
  RunningMax,
  FeatureRingBuffer,
} from './featureSmoothing'

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
