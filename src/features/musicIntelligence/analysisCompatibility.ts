import type {
  TrackAnalysisProvenance,
  TrackAnalysisSources,
  TrackIntelligenceAnalysis,
} from './types'

export const DEFAULT_TRACK_ANALYSIS_SOURCES: TrackAnalysisSources = Object.freeze({
  bpm: 'drmvyz',
  beatGrid: 'drmvyz',
  key: 'drmvyz',
  trackSections: 'drmvyz',
})

export function resolveTrackAnalysisSources(
  analysis: Pick<TrackIntelligenceAnalysis, 'analysisSources'> | null | undefined,
): TrackAnalysisSources {
  return analysis?.analysisSources
    ? { ...DEFAULT_TRACK_ANALYSIS_SOURCES, ...analysis.analysisSources }
    : { ...DEFAULT_TRACK_ANALYSIS_SOURCES }
}

export function resolveTrackAnalysisProvenance(
  analysis: Pick<TrackIntelligenceAnalysis, 'trackProvenance' | 'rekordboxSourceData'> | null | undefined,
): TrackAnalysisProvenance {
  if (analysis?.trackProvenance) {
    if (analysis.trackProvenance.trackOrigin !== 'rekordbox') return { trackOrigin: 'ordinary' }
    return {
      ...analysis.trackProvenance,
      rekordboxFeatureAvailability:
        analysis.trackProvenance.rekordboxFeatureAvailability
        ?? analysis.rekordboxSourceData?.featureAvailability,
    }
  }
  if (analysis?.rekordboxSourceData) {
    return {
      trackOrigin: 'rekordbox',
      rekordboxSource: analysis.rekordboxSourceData.source,
      rekordboxFeatureAvailability: analysis.rekordboxSourceData.featureAvailability,
    }
  }
  return { trackOrigin: 'ordinary' }
}

/** Adds only compatible Stage-2 defaults; it never rewrites legacy analysis content. */
export function withTrackAnalysisCompatibilityDefaults(
  analysis: TrackIntelligenceAnalysis,
): TrackIntelligenceAnalysis {
  return {
    ...analysis,
    analysisSources: resolveTrackAnalysisSources(analysis),
    trackProvenance: resolveTrackAnalysisProvenance(analysis),
  }
}
