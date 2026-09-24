// Output-format decisions and filename helpers shared by the image and video
// exporters. The MIME type, file extension, storage path and database row must
// always agree, so every one of them derives from a single OutputFormat.

export interface RenderedMedia {
  kind: 'image' | 'video'
  blob: Blob
  /** Bare MIME type (no codec parameters), e.g. "video/mp4". */
  mimeType: string
  /** Extension without the dot; always matches mimeType. */
  extension: string
  width: number
  height: number
  durationSec?: number
  hasAlpha: boolean
  /** Videos only: whether the rendered file carries the source's audio. */
  hasAudio?: boolean
}

export interface OutputFormat {
  mimeType: string
  extension: string
}

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

export function extensionForMime(mimeType: string): string | null {
  return EXTENSION_BY_MIME[baseMimeType(mimeType)] ?? null
}

/** "video/webm;codecs=vp9,opus" → "video/webm". */
export function baseMimeType(mimeType: string): string {
  return (mimeType.split(';')[0] ?? '').trim().toLowerCase()
}

// ── Images ───────────────────────────────────────────────────────────────────

export const IMAGE_ENCODE_QUALITY = 0.92

export interface ImageFormatChoice extends OutputFormat {
  /** Present for lossy encoders. */
  quality?: number
  supportsAlpha: boolean
}

/**
 * Keep the source's family when it can hold the result: JPEG stays JPEG unless
 * transparency is needed, WebP stays WebP, everything else is written as PNG.
 */
export function chooseImageOutputFormat(sourceMimeType: string | null, needsAlpha: boolean): ImageFormatChoice {
  const source = baseMimeType(sourceMimeType ?? '')
  if (source === 'image/jpeg' && !needsAlpha) {
    return { mimeType: 'image/jpeg', extension: 'jpg', quality: IMAGE_ENCODE_QUALITY, supportsAlpha: false }
  }
  if (source === 'image/webp') {
    return { mimeType: 'image/webp', extension: 'webp', quality: IMAGE_ENCODE_QUALITY, supportsAlpha: true }
  }
  return { mimeType: 'image/png', extension: 'png', supportsAlpha: true }
}

// ── Video ────────────────────────────────────────────────────────────────────

export type VideoContainer = 'mp4' | 'webm'

interface VideoCandidate extends OutputFormat {
  container: VideoContainer
  /** Full MediaRecorder MIME string including codecs. */
  recorderMime: string
  audio: boolean
}

const VIDEO_CANDIDATES: readonly VideoCandidate[] = [
  { container: 'mp4', mimeType: 'video/mp4', extension: 'mp4', recorderMime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', audio: true },
  { container: 'mp4', mimeType: 'video/mp4', extension: 'mp4', recorderMime: 'video/mp4;codecs=avc1,mp4a.40.2', audio: true },
  { container: 'mp4', mimeType: 'video/mp4', extension: 'mp4', recorderMime: 'video/mp4;codecs=avc1', audio: false },
  { container: 'mp4', mimeType: 'video/mp4', extension: 'mp4', recorderMime: 'video/mp4', audio: false },
  { container: 'webm', mimeType: 'video/webm', extension: 'webm', recorderMime: 'video/webm;codecs=vp9,opus', audio: true },
  { container: 'webm', mimeType: 'video/webm', extension: 'webm', recorderMime: 'video/webm;codecs=vp8,opus', audio: true },
  { container: 'webm', mimeType: 'video/webm;codecs=vp9', extension: 'webm', recorderMime: 'video/webm;codecs=vp9', audio: false },
  { container: 'webm', mimeType: 'video/webm;codecs=vp8', extension: 'webm', recorderMime: 'video/webm;codecs=vp8', audio: false },
  { container: 'webm', mimeType: 'video/webm', extension: 'webm', recorderMime: 'video/webm', audio: false },
]

export interface VideoFormatChoice extends OutputFormat {
  container: VideoContainer
  recorderMime: string
}

/**
 * Picks a container this runtime can really record. The source's own container
 * wins when supported (MP4/MOV → MP4, WebM → WebM); otherwise the other
 * supported one is used and the caller renames the file to match. Returns null
 * when the runtime can record neither.
 */
export function pickVideoExportFormat(
  sourceMimeType: string | null,
  hasAudio: boolean,
  isTypeSupported: (mime: string) => boolean,
): VideoFormatChoice | null {
  const source = baseMimeType(sourceMimeType ?? '')
  const preferred: VideoContainer = source === 'video/webm' ? 'webm' : 'mp4'
  const ordered = [
    ...VIDEO_CANDIDATES.filter(candidate => candidate.container === preferred),
    ...VIDEO_CANDIDATES.filter(candidate => candidate.container !== preferred),
  ]
  // A candidate that names an audio codec is only usable when there is audio to carry;
  // codec-less candidates work for both because the recorder picks the codecs itself.
  const usable = ordered.filter(candidate => hasAudio || !candidate.audio)
  const match = usable.find(candidate => isTypeSupported(candidate.recorderMime))
  if (!match) return null
  return {
    container: match.container,
    mimeType: baseMimeType(match.mimeType),
    extension: match.extension,
    recorderMime: match.recorderMime,
  }
}

// ── Names ────────────────────────────────────────────────────────────────────

const INVALID_NAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]/

export function stripExtension(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,8}$/, '')
}

/** "clip.mov" + "mp4" → "clip.mp4". */
export function withExtension(name: string, extension: string): string {
  return `${stripExtension(name)}.${extension}`
}

/** A user-chosen title as a file name: "Sunset v2.1" + "png" → "Sunset v2.1.png" (a matching extension is not doubled). */
export function fileNameForTitle(title: string, extension: string): string {
  return title.toLowerCase().endsWith(`.${extension.toLowerCase()}`) ? title : `${title}.${extension}`
}

/** Default Save As title: "Sunset" → "Sunset (edited)". */
export function suggestEditedTitle(title: string): string {
  const base = title.trim()
  return base ? `${base} (edited)` : 'Edited media'
}

export type MediaNameValidation =
  | { ok: true; name: string }
  | { ok: false; error: string }

export const MAX_MEDIA_NAME_LENGTH = 160

export function validateMediaName(input: string): MediaNameValidation {
  const trimmed = input.trim()
  // Control characters (tabs, newlines…) are rejected before whitespace is collapsed.
  if (INVALID_NAME_CHARACTERS.test(trimmed)) return { ok: false, error: 'Names cannot contain \\ / : * ? " < > | or control characters.' }
  const name = trimmed.replace(/\s+/g, ' ')
  if (!name) return { ok: false, error: 'Enter a name for the new media.' }
  if (name.length > MAX_MEDIA_NAME_LENGTH) return { ok: false, error: `Use ${MAX_MEDIA_NAME_LENGTH} characters or fewer.` }
  if (/^\.+$/.test(name)) return { ok: false, error: 'Choose a name that is not just dots.' }
  return { ok: true, name }
}
