// Still-image export: renders the edit through the same WebGL renderer the
// preview uses, at the edit's natural output resolution, and encodes a real Blob.

import type { MediaEditState } from './mediaEditModel'
import { MediaEditRenderer } from './MediaEditGlRenderer'
import { opacityAmount } from './mediaEditPipeline'
import { chooseImageOutputFormat, type RenderedMedia } from './mediaEditOutput'

/** Keeps the output inside every browser's canvas limits. */
export const MAX_IMAGE_EXPORT_EDGE = 8192

export interface ImageExportInput {
  /** Loadable URL of the current (unedited) content. */
  url: string
  edit: MediaEditState
  sourceMimeType: string | null
  sourceHasAlpha: boolean
  signal?: AbortSignal
}

export class MediaEditAbortError extends Error {
  constructor(message = 'Media edit render was cancelled.') {
    super(message)
    this.name = 'AbortError'
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new MediaEditAbortError()
}

export function loadImageElement(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    const cleanup = () => {
      image.onload = null
      image.onerror = null
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => { cleanup(); image.src = ''; reject(new MediaEditAbortError()) }
    image.onload = () => { cleanup(); resolve(image) }
    image.onerror = () => { cleanup(); reject(new Error('The image could not be loaded for editing.')) }
    if (signal?.aborted) { onAbort(); return }
    signal?.addEventListener('abort', onAbort, { once: true })
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

export async function renderEditedImage(input: ImageExportInput): Promise<RenderedMedia> {
  throwIfAborted(input.signal)
  const image = await loadImageElement(input.url, input.signal)
  throwIfAborted(input.signal)

  const canvas = document.createElement('canvas')
  // preserveDrawingBuffer keeps the pixels valid for the asynchronous toBlob() encode.
  const renderer = MediaEditRenderer.create(canvas, { preserveDrawingBuffer: true })
  if (!renderer) {
    throw new Error('GPU rendering is unavailable, so this image cannot be rendered.')
  }
  try {
    const geometry = renderer.render({
      source: image,
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
      edit: input.edit,
      geometry: { maxEdge: MAX_IMAGE_EXPORT_EDGE },
    })
    if (!geometry) throw renderer.lastError ?? new Error('The image could not be rendered.')
    throwIfAborted(input.signal)

    const needsAlpha = input.sourceHasAlpha || opacityAmount(input.edit.opacity) < 1
    const format = chooseImageOutputFormat(input.sourceMimeType, needsAlpha)
    let blob = await canvasToBlob(canvas, format.mimeType, format.quality)
    let resolved = format
    // Some encoders silently fall back to PNG; trust the Blob's real type, never the request.
    if (!blob || blob.type !== format.mimeType) {
      const fallback = chooseImageOutputFormat('image/png', true)
      blob = blob && blob.type === fallback.mimeType ? blob : await canvasToBlob(canvas, fallback.mimeType)
      resolved = fallback
    }
    if (!blob || blob.type !== resolved.mimeType) throw new Error('The rendered image could not be encoded.')
    throwIfAborted(input.signal)

    return {
      kind: 'image',
      blob,
      mimeType: resolved.mimeType,
      extension: resolved.extension,
      width: geometry.outputWidth,
      height: geometry.outputHeight,
      hasAlpha: resolved.supportsAlpha && needsAlpha,
    }
  } finally {
    renderer.dispose()
    canvas.width = 0
    canvas.height = 0
    image.src = ''
  }
}
