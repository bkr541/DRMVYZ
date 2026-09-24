import type { MediaMetadata } from '../../../types/database'
import type { RenderedMedia } from './mediaEditOutput'

/**
 * Metadata for content that has just been re-rendered. Everything describing the
 * OLD bytes (palette, fingerprint, detected type, SVG classification) is dropped
 * and the technical fields are set from the render; organization-style fields the
 * editor never touches (fps, loopable, BPM, key, energy…) are carried over.
 */
export function deriveEditedMetadata(
  previous: MediaMetadata,
  rendered: RenderedMedia,
  contentFingerprint?: string,
): MediaMetadata {
  const {
    contentFingerprint: _fingerprint,
    paletteAnalysis: _palette,
    paletteAnalysisError: _paletteError,
    dominantColors: _dominant,
    analyzedAt: _analyzedAt,
    svgValidation: _svg,
    detectedMimeType: _mime,
    ...kept
  } = previous
  return {
    ...kept,
    width: rendered.width,
    height: rendered.height,
    ...(rendered.durationSec !== undefined ? { duration: rendered.durationSec } : {}),
    hasAlpha: rendered.hasAlpha,
    detectedMimeType: rendered.mimeType,
    ...(contentFingerprint ? { contentFingerprint } : {}),
  }
}

/**
 * The Deck pipeline pins media by content fingerprint. When an item already has
 * one, replacing its bytes must change it so Decks report a stale source instead
 * of silently compiling different content. Items with no fingerprint stay so.
 */
export async function nextContentFingerprint(
  previous: MediaMetadata,
  blob: Blob,
  operationHint: string,
): Promise<string | undefined> {
  if (!previous.contentFingerprint) return undefined
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return `edited:${operationHint}`
  try {
    const digest = await subtle.digest('SHA-256', await blob.arrayBuffer())
    return `sha256:${Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return `edited:${operationHint}`
  }
}
