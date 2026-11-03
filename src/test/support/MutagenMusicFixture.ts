/** Acceptance-only replay of stored production analysis. No detector or clock. */
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import { sampleCurveAt } from '../../features/musicIntelligence/musicalGridAnalysis'
import type { MusicIntelligenceFrame, TrackIntelligenceAnalysis } from '../../features/musicIntelligence/types'
import { buildSharedPerformanceContext, type SharedPerformanceContext } from '../../features/performanceCore'

export function mutagenAnalyzedFixtureFrame(analysis: TrackIntelligenceAnalysis, timeSec: number): MusicIntelligenceFrame {
  const sample = (name: keyof TrackIntelligenceAnalysis['energyCurves']) => sampleCurveAt(analysis.energyCurves[name], timeSec)
  return {
    ...DEFAULT_MI_FRAME,
    frameId: Math.round(timeSec * 20) + 1,
    timeSec,
    sourceId: 'mutagen-stored-analysis-replay',
    trackId: 'mutagen-analyzed-fixture',
    analysisRevision: 'mutagen-golden-auto-6.1',
    timelineRevision: 'mutagen-golden-sections',
    bands: { ...DEFAULT_MI_FRAME.bands, normalizedSub: sample('bass') * 0.75, normalizedBass: sample('bass'), normalizedMid: sample('mid'), normalizedHigh: sample('high') },
    energy: { ...DEFAULT_MI_FRAME.energy, instant: sample('instant'), shortTerm: sample('shortTerm') },
    rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: analysis.bpm ?? 0, bpmConfidence: analysis.bpmConfidence ?? 0, bpmSource: 'offline_analysis' },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: false, beatGrid: true, sections: true, trackEnergyCurve: true },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.95, rhythm: analysis.bpmConfidence ?? 0, section: 0.9 },
  }
}

export function mutagenAnalyzedFixtureContext(analysis: TrackIntelligenceAnalysis, timeSec: number, previous: SharedPerformanceContext | null): SharedPerformanceContext {
  return buildSharedPerformanceContext({ analysis, audioTimeSec: timeSec, frame: mutagenAnalyzedFixtureFrame(analysis, timeSec), trackIdentity: 'mutagen-analyzed-fixture', previous })
}
