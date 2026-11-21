import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { RgbWaveformAnalysis } from '../../../../features/waveform/rgbWaveformTypes'
import type { AudioEngine } from '../../../../hooks/useAudioEngine'
import { useReactStore } from '../../../../stores/reactStore'
import { useVisualStore } from '../../../../stores/visualStore'
import { cueMarkerBelongsToTrack } from '../../../../types/cue'
import type { ReactTrackSection } from '../ReactTypes'
import type { TrackTimelineModel } from './trackTimelineModel'

/** Capture the selected track and transport together before loading the ZIP exporter. */
export function captureTrackTimelineExport({ engine, analysis, rgbWaveform, model, resolvedSections }: {
  engine: AudioEngine
  analysis: TrackIntelligenceAnalysis
  rgbWaveform: RgbWaveformAnalysis
  model: TrackTimelineModel
  resolvedSections: readonly ReactTrackSection[]
}) {
  const track = engine.currentTrack
  const trackAnalysis = engine.currentAnalysis
  if (!track || !trackAnalysis || !rgbWaveform.binCount) throw new Error('Track analysis is unavailable.')

  const state = useReactStore.getState()
  const frame = AudioFeatureBus.getFrame()
  const frameMatchesTrack = frame.trackId === track.id || frame.sourceId === track.id
  const { raw: _raw, ...playbackFrame } = frame
  const runtime = track.analysisRuntime
  const seed = track.importedAnalysisSeed ?? null
  const externalMetadata = track.externalMetadata ?? null
  const rekordboxSource = trackAnalysis.rekordboxSourceData ?? null
  const nativePhrases = track.importedRekordboxPhrases?.length
    ? track.importedRekordboxPhrases
    : seed?.rekordboxPhrases ?? rekordboxSource?.phrases ?? []

  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    track: {
      title: track.title?.trim() || track.displayName || track.name,
      displayName: track.displayName,
      filename: track.name,
      artist: track.artist?.trim() || externalMetadata?.artist || null,
      durationSec: model.durationSec,
      sampleRate: rgbWaveform.sampleRate,
      channels: model.meta.channels,
      persistedMetadata: track.persistedMetadata ?? null,
      isRekordbox: Boolean(track.isRekordbox || externalMetadata || seed || rekordboxSource),
    },
    transport: {
      positionSec: engine.getCurrentTime(),
      isPlaying: engine.isPlaying,
      effectiveBpm: engine.currentEffectiveBpm,
      analyzedBpm: engine.currentAnalyzedBpm,
      bpmConfidence: engine.currentBpmConfidence,
      bpmSource: engine.currentBpmSource,
      key: engine.currentKey,
      analysisStatus: engine.currentAnalysisStatus,
      runtime: {
        bpmOverride: runtime.bpmOverride,
        bpmOverrideSource: runtime.bpmOverrideSource,
        gridStale: runtime.gridStale,
        bpmReanalysisStatus: runtime.bpmReanalysisStatus,
      },
    },
    trackAnalysis,
    effectiveGrid: {
      bpm: analysis.bpmUsedForGrid ?? analysis.bpm,
      beatGridOffsetSec: analysis.beatGridOffsetSec,
      source: analysis.musicalGrid?.source ?? null,
      isOverride: engine.currentEffectiveBeatGrid !== null,
      beatGrid: analysis.beatGrid,
      downbeats: analysis.downbeats,
    },
    rgbWaveform: {
      ...rgbWaveform,
      positivePeaks: Array.from(rgbWaveform.positivePeaks),
      negativePeaks: Array.from(rgbWaveform.negativePeaks),
      rms: Array.from(rgbWaveform.rms),
      lowEnergy: Array.from(rgbWaveform.lowEnergy),
      midEnergy: Array.from(rgbWaveform.midEnergy),
      highEnergy: Array.from(rgbWaveform.highEnergy),
    },
    timeline: model,
    rekordbox: {
      externalMetadata,
      cueMarkers: track.importedCueMarkers ?? [],
      cueRegions: track.importedCueRegions ?? [],
      pssiPhrases: nativePhrases,
      analysisSeed: seed,
      sourceAnalysis: rekordboxSource,
      diagnostics: trackAnalysis.analysisDiagnostics?.rekordbox ?? null,
    },
    trackMap: {
      resolvedSections,
      manualSections: state.manualTrackSectionsByTrackId[track.id] ?? [],
      suppressedSectionIds: state.suppressedAutoSectionsByTrackId[track.id] ?? [],
      manualCueMarkers: useVisualStore.getState().cueMarkers.filter(cue => cueMarkerBelongsToTrack(cue, track.id)),
      presetAutomationCues: state.presetAutomationCuesByTrackId[track.id] ?? [],
      pixGridActionCues: state.pixGridActionCuesByTrackId[track.id] ?? [],
    },
    playbackSnapshot: frameMatchesTrack ? playbackFrame : null,
  }
}

export type TrackTimelineExportData = ReturnType<typeof captureTrackTimelineExport>
