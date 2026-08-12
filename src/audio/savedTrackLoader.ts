import type { AudioEngine } from '../hooks/useAudioEngine'
import type { SavedAudioTrack } from '../stores/audioStore'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../types'
import type { TrackIntelligenceAnalysis } from '../features/musicIntelligence/types'
import type { RuntimeTrackUrlInput } from './runtimeTrack'
import { listTrackAnalysisPayloads } from '../lib/audioDb'
import type { Json } from '../types/database'
import {
  requestAudioSourceMutation,
  SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE,
  type AudioSourceMutationAuthority,
  type AudioSourceMutationOptions,
} from './audioSourcePolicy'

export interface PersistedAudioTrackInput extends SavedAudioTrack {
  analysisPayload?: TrackIntelligenceAnalysis | null
}

export interface SavedTrackLoaderDependencies {
  getSignedUrl: (storagePath: string) => Promise<string | null>
}

export interface LoadSavedTrackOptions {
  autoplay?: boolean
  forceReload?: boolean
  shouldCommit?: () => boolean
  sourceMutationAuthority?: AudioSourceMutationAuthority
}

export interface LoadSavedTrackResult {
  input: RuntimeTrackUrlInput
  reusedRuntimeTrack: boolean
}

export class SavedTrackLoadCancelledError extends Error {
  constructor() {
    super('Saved track load was cancelled.')
    this.name = 'SavedTrackLoadCancelledError'
  }
}

const signedUrlPromises = new Map<string, { expiresAt: number; promise: Promise<string | null> }>()
const SIGNED_URL_CACHE_MS = 5 * 60_000

function boundedMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '')
  const normalized = raw.trim() || 'The saved track could not be loaded.'
  return normalized.length > 180 ? `${normalized.slice(0, 177)}…` : normalized
}

async function resolveSignedUrl(
  storagePath: string,
  getSignedUrl: SavedTrackLoaderDependencies['getSignedUrl'],
): Promise<string | null> {
  const now = Date.now()
  const cached = signedUrlPromises.get(storagePath)
  if (cached && cached.expiresAt > now) return cached.promise
  const promise = getSignedUrl(storagePath).catch(error => {
    signedUrlPromises.delete(storagePath)
    throw error
  })
  signedUrlPromises.set(storagePath, { expiresAt: now + SIGNED_URL_CACHE_MS, promise })
  const url = await promise
  if (!url) signedUrlPromises.delete(storagePath)
  return url
}


function isAnalysisPayload(value: Json | null | undefined): value is Json & TrackIntelligenceAnalysis {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.analysisVersion === 'string'
    && typeof candidate.durationMs === 'number'
    && Array.isArray(candidate.beatGrid)
    && Array.isArray(candidate.sections)
}

async function hydrateAnalysis(track: PersistedAudioTrackInput): Promise<PersistedAudioTrackInput> {
  if (track.analysisPayload) return track
  try {
    const result = await listTrackAnalysisPayloads([track.dbId])
    const payload = result.error ? null : result.rows[0]?.analysis_payload
    return isAnalysisPayload(payload)
      ? { ...track, analysisPayload: payload as unknown as TrackIntelligenceAnalysis }
      : track
  } catch (error) {
    console.warn('[savedTrackLoader] analysis hydration failed:', error)
    return track
  }
}

export function buildSavedTrackRuntimeInput(
  track: PersistedAudioTrackInput,
  url: string,
): RuntimeTrackUrlInput {
  const analysisRuntime = track.analysisPayload
    ? {
        ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
        status: 'complete' as const,
        analysis: track.analysisPayload,
        analysisVersion: track.analysisPayload.analysisVersion,
        error: null,
      }
    : undefined

  return {
    name: track.fileName || track.title,
    title: track.title,
    artist: track.artist,
    url,
    dbId: track.dbId,
    storagePath: track.storagePath,
    duration: track.durationSec,
    persistedMetadata: {
      bpm: track.bpm,
      musicalKey: track.musicalKey,
      genre: track.genre,
      sampleRate: track.sampleRate,
      channels: track.channels,
    },
    ...(analysisRuntime ? { analysisRuntime } : {}),
  }
}

export async function loadSavedTrackIntoEngine(
  engine: AudioEngine,
  track: PersistedAudioTrackInput,
  dependencies: SavedTrackLoaderDependencies,
  options: LoadSavedTrackOptions = {},
): Promise<LoadSavedTrackResult> {
  if (!track.dbId) throw new Error('This saved track has no canonical audio track ID.')
  if (!track.storagePath) throw new Error('This saved track has no accessible audio file.')

  const mutationOptions: AudioSourceMutationOptions = options.sourceMutationAuthority
    ? { authority: options.sourceMutationAuthority }
    : {}
  const guardedMutationOptions: AudioSourceMutationOptions = { ...mutationOptions, notifyOnBlocked: false }
  const assertSourceMutationAllowed = () => {
    if (!requestAudioSourceMutation(mutationOptions)) throw new Error(SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE)
  }

  try {
    // Reject a forbidden Show Manager source request before URL resolution,
    // analysis hydration, or any engine/runtime mutation can begin.
    assertSourceMutationAllowed()
    if (!options.forceReload && engine.currentAudioTrackId === track.dbId && engine.currentTrack) {
      const hydratedTrack = await hydrateAnalysis(track)
      assertSourceMutationAllowed()
      if (options.shouldCommit && !options.shouldCommit()) throw new SavedTrackLoadCancelledError()
      const analysis = hydratedTrack.analysisPayload ?? null
      if (analysis && engine.currentTrack.analysisRuntime?.analysis !== analysis) {
        engine.updateTrackRuntime(engine.currentTrack.id, {
          status: 'complete',
          analysis,
          analysisVersion: analysis.analysisVersion,
          error: null,
        })
      }
      if (engine.source !== 'file') await engine.setSource('file', guardedMutationOptions)
      if (options.shouldCommit && !options.shouldCommit()) throw new SavedTrackLoadCancelledError()
      if (options.autoplay) engine.play()
      return {
        input: buildSavedTrackRuntimeInput(hydratedTrack, engine.currentTrack.url),
        reusedRuntimeTrack: true,
      }
    }

    const [url, hydratedTrack] = await Promise.all([
      resolveSignedUrl(track.storagePath, dependencies.getSignedUrl),
      hydrateAnalysis(track),
    ])
    if (!url) throw new Error('Unable to create a signed playback URL for this track.')
    assertSourceMutationAllowed()
    if (options.shouldCommit && !options.shouldCommit()) throw new SavedTrackLoadCancelledError()
    const input = buildSavedTrackRuntimeInput(hydratedTrack, url)
    if (engine.tracks.length > 0) engine.replaceTrackUrls([input], guardedMutationOptions)
    else engine.addTrackUrls([input], guardedMutationOptions)
    if (engine.source !== 'file') await engine.setSource('file', guardedMutationOptions)
    if (options.shouldCommit && !options.shouldCommit()) throw new SavedTrackLoadCancelledError()
    if (options.autoplay) engine.play()
    return { input, reusedRuntimeTrack: false }
  } catch (error) {
    if (error instanceof SavedTrackLoadCancelledError) throw error
    throw new Error(boundedMessage(error))
  }
}

export function clearSavedTrackSignedUrlCache(storagePath?: string): void {
  if (storagePath) signedUrlPromises.delete(storagePath)
  else signedUrlPromises.clear()
}
