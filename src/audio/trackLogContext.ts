import type { Track } from '../types'

/** The parts of a track a diagnostic needs to name the file behind it. Everything is optional so a failure path can pass whatever it still has. */
export type TrackLogSource = Partial<Pick<Track, 'id' | 'name' | 'url' | 'sourceKind' | 'sourceFile' | 'isRekordbox'>>

export interface TrackLogContext {
  trackId: string | null
  /** The file's name as the browser gave it (a browser never reveals the folder or volume). */
  fileName: string | null
  fileSizeBytes: number | null
  fileType: string | null
  /** ISO time the file was last modified; a file changed after it was picked can fail to read. */
  fileModified: string | null
  sourceKind: Track['sourceKind'] | null
  /** Only the scheme ("blob", "https", "file"), never the URL: signed URLs carry credentials. */
  urlScheme: string | null
  isRekordbox: boolean
  /** A macOS "._" sidecar file: it has an audio extension but holds no audio, so it can never load. */
  looksLikeSidecarStub: boolean
}

function schemeOf(url: string | undefined): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url ?? '')
  return match ? match[1]!.toLowerCase() : null
}

function isoOrNull(timestamp: number | undefined): string | null {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null
  try { return new Date(timestamp).toISOString() } catch { return null }
}

/**
 * Structured log fields that identify the file behind a track. Put the result in a log's context object (not its message text), so error reporting that
 * forwards message strings never carries a filename.
 */
export function describeTrackForLog(track: TrackLogSource | null | undefined, fallbackTrackId: string | null = null): TrackLogContext {
  const file = track?.sourceFile
  const fileName = file?.name || track?.name || null
  return {
    trackId: track?.id ?? fallbackTrackId,
    fileName,
    fileSizeBytes: typeof file?.size === 'number' ? file.size : null,
    fileType: file?.type || null,
    fileModified: isoOrNull(file?.lastModified),
    sourceKind: track?.sourceKind ?? null,
    urlScheme: schemeOf(track?.url),
    isRekordbox: Boolean(track?.isRekordbox),
    looksLikeSidecarStub: Boolean(fileName && fileName.startsWith('._')),
  }
}
