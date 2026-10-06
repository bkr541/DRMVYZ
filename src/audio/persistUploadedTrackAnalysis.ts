import { analyzeTrackBuffer } from '../features/musicIntelligence/offlineTrackAnalyzer'
import { downsampleWaveform } from '../components/vyzualz/hooks/useWaveformPeaks'
import { upsertTrackAnalysisPayload } from '../lib/audioDb'

/**
 * Runs the full Music Intelligence analysis (beat grid, sections, phrases) and the
 * Lyric Manager waveform peaks on a freshly uploaded file and stores both on its
 * track_analyses row, so saved tracks render in Lyric Manager without being loaded.
 */
export async function persistUploadedTrackAnalysis(trackId: string, file: File): Promise<void> {
  const context = new OfflineAudioContext(1, 1, 44_100)
  const buffer = await context.decodeAudioData(await file.arrayBuffer())
  const analysis = await analyzeTrackBuffer(buffer)
  const result = await upsertTrackAnalysisPayload(trackId, analysis, downsampleWaveform(buffer))
  if (result.error) throw new Error(result.error)
}
