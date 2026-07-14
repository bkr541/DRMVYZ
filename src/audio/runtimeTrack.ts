import type { Track, TrackAnalysisRuntime, PersistedTrackMetadata } from '../types'
import type { ImportedTrackIntelligence } from '../features/rekordboxImport/types'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../types'
import { generateId, getFilenameWithoutExtension } from '../utils/audioUtils'
import {
  computeAnalysisKey,
  CURRENT_ANALYSIS_VERSION,
} from '../features/trackIntelligence/TrackAnalysisCoordinator'
import { isCurrentAnalysisVersion } from '../features/musicIntelligence/analysisVersion'

/** Backward-compatible input for signed URLs, restored remote tracks, and saved audio_tracks rows. */
export interface PreparedTrackInput {
  file: File
  imported?: ImportedTrackIntelligence
}

export interface RuntimeTrackUrlInput {
  name: string
  url: string
  dbId?: string
  runtimeId?: string
  storagePath?: string | null
  title?: string
  artist?: string | null
  duration?: number | null
  persistedMetadata?: PersistedTrackMetadata
  analysisRuntime?: TrackAnalysisRuntime
}

export function runtimeIdForAudioTrack(dbId: string): string {
  return `audio-${dbId}`
}

function buildAnalysisRuntime(
  source: Pick<Track, 'sourceKind' | 'url'> & { sourceFile?: File; importedAnalysisSeed?: ImportedTrackIntelligence['analysisSeed'] },
  restored?: TrackAnalysisRuntime,
): TrackAnalysisRuntime {
  const restoredIsCurrent = Boolean(
    restored &&
    isCurrentAnalysisVersion(restored.analysisVersion) &&
    (!restored.analysis || isCurrentAnalysisVersion(restored.analysis.analysisVersion)),
  )
  const analysisKey = restoredIsCurrent && restored?.analysisKey
    ? restored.analysisKey
    : computeAnalysisKey(source)
  return {
    ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
    ...(restoredIsCurrent ? restored : {
      bpmOverride: restored?.bpmOverride ?? null,
      bpmOverrideSource: restored?.bpmOverrideSource ?? null,
      detectedBpm: restored?.detectedBpm ?? null,
      gridStale: restored?.bpmOverride != null,
    }),
    analysisKey,
    analysisVersion: CURRENT_ANALYSIS_VERSION,
    status: restoredIsCurrent ? (restored?.status ?? 'queued') : 'queued',
    analysis: restoredIsCurrent ? (restored?.analysis ?? null) : null,
  }
}

export function createLocalRuntimeTrack(file: File, imported?: ImportedTrackIntelligence): Track {
  const url = URL.createObjectURL(file)
  const importedMetadata = imported?.metadata
  const title = importedMetadata?.title?.trim() || getFilenameWithoutExtension(file.name)
  const analysisRuntime = buildAnalysisRuntime({ sourceKind: 'file', url, sourceFile: file, importedAnalysisSeed: imported?.analysisSeed })
  if (importedMetadata) {
    const seedKey = [
      importedMetadata.source,
      importedMetadata.sourceTrackId ?? 'unknown-track',
      importedMetadata.bpm ?? 'no-bpm',
      importedMetadata.musicalKey ?? 'no-key',
      imported?.cueMarkers.length ?? 0,
    ].join(':')
    analysisRuntime.analysisKey = `${analysisRuntime.analysisKey}:external:${seedKey}`
  }

  return {
    id:                 generateId(),
    name:               file.name,
    displayName:        title,
    title:              importedMetadata?.title ?? undefined,
    artist:             importedMetadata?.artist ?? undefined,
    url,
    duration:           importedMetadata?.durationSec ?? 0,
    persistedMetadata:  importedMetadata ? {
      bpm:        importedMetadata.bpm ?? null,
      musicalKey: importedMetadata.musicalKey ?? null,
      genre:      importedMetadata.genre ?? null,
    } : undefined,
    externalMetadata:   importedMetadata,
    importedCueMarkers: imported?.cueMarkers ?? [],
    importedCueRegions: imported?.cueRegions ?? [],
    importedAnalysisSeed: imported?.analysisSeed,
    sourceKind:         'file',
    sourceFile:         file,
    analysisRuntime,
  }
}

export function createPreparedRuntimeTrack(input: PreparedTrackInput): Track {
  return createLocalRuntimeTrack(input.file, input.imported)
}

export function createRemoteRuntimeTrack(input: RuntimeTrackUrlInput): Track {
  const title = input.title?.trim() || getFilenameWithoutExtension(input.name)
  return {
    id:                input.dbId ? runtimeIdForAudioTrack(input.dbId) : (input.runtimeId ?? generateId()),
    dbId:              input.dbId,
    name:              input.name,
    displayName:       title,
    title:             input.title,
    artist:            input.artist,
    url:               input.url,
    duration:          input.duration ?? 0,
    storagePath:       input.storagePath,
    persistedMetadata: input.persistedMetadata,
    sourceKind:        'remote',
    analysisRuntime:   buildAnalysisRuntime(
      { sourceKind: 'remote', url: input.url },
      input.analysisRuntime,
    ),
  }
}

export function getTrackRuntimeId(track: Track | null | undefined): string | null {
  return track?.id ?? null
}

export function getTrackAudioTrackId(track: Track | null | undefined): string | null {
  return track?.dbId ?? null
}

export function isPersistedTrack(track: Track | null | undefined): boolean {
  return getTrackAudioTrackId(track) !== null
}
