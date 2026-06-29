import type { Track, TrackAnalysisRuntime, PersistedTrackMetadata } from '../types'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../types'
import { generateId, getFilenameWithoutExtension } from '../utils/audioUtils'
import {
  computeAnalysisKey,
  CURRENT_ANALYSIS_VERSION,
} from '../features/trackIntelligence/TrackAnalysisCoordinator'

/** Backward-compatible input for signed URLs, restored remote tracks, and saved audio_tracks rows. */
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
  source: Pick<Track, 'sourceKind' | 'url'> & { sourceFile?: File },
  restored?: TrackAnalysisRuntime,
): TrackAnalysisRuntime {
  const analysisKey = restored?.analysisKey || computeAnalysisKey(source)
  return {
    ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
    ...restored,
    analysisKey,
    analysisVersion: restored?.analysisVersion || CURRENT_ANALYSIS_VERSION,
    status: restored?.status ?? 'queued',
  }
}

export function createLocalRuntimeTrack(file: File): Track {
  const url = URL.createObjectURL(file)
  return {
    id:              generateId(),
    name:            file.name,
    displayName:     getFilenameWithoutExtension(file.name),
    url,
    duration:        0,
    sourceKind:      'file',
    sourceFile:      file,
    analysisRuntime: buildAnalysisRuntime({ sourceKind: 'file', url, sourceFile: file }),
  }
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
