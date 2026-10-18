// Person segmentation for the Headliner silhouette effects (Aura, Energy Outline, Outline Echo, Particle Body).
// A MediaPipe Image Segmenter (selfie model, shipped in public/mediapipe so it works offline) runs on a small copy
// of the camera picture a few dozen times a second and is turned into a soft white-on-transparent mask canvas.
// While the model loads, or if it cannot start, `HeadlinerSilhouetteSource` falls back to the learned-background
// approximation used by the clone effects, so the effects still work (less precisely) without the model.

import type { HeadlinerSourceRect } from './HeadlinerCompositor'
import { HeadlinerPerformerIsolator } from './HeadlinerIsolation'
import { reportHeadlinerTrackerFailure } from './HeadlinerTrackerNotices'

export const HEADLINER_SEGMENT_MODEL_URL = '/mediapipe/selfie_segmenter.tflite'
export const HEADLINER_SEGMENT_WASM_URL = '/mediapipe/wasm'
/** Segmentation runs at most this often; the mask is reused between runs. */
export const HEADLINER_SEGMENT_HZ = 30
/** The picture handed to the model is this wide (the model works at 256 px anyway). */
export const HEADLINER_SEGMENT_INPUT_WIDTH = 256

export type HeadlinerSegmenterStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

export interface HeadlinerSegmentSample {
  status: HeadlinerSegmenterStatus
  /** White canvas whose alpha is how sure the model is that a pixel is the performer; null until the first result. */
  mask: HTMLCanvasElement | null
  /** Increases with every new mask. */
  sequence: number
}

export interface HeadlinerSegmentSource {
  acquire(): void
  release(): void
  sample(video: HTMLVideoElement, sourceRect: HeadlinerSourceRect, nowSec: number): HeadlinerSegmentSample
}

/** Confidence (0..1) to alpha (0..255): a smoothstep around the middle sharpens the edge without making it hard. */
export function confidenceToAlpha(confidence: number): number {
  const t = Math.min(1, Math.max(0, (confidence - 0.3) / 0.4))
  return Math.round(255 * t * t * (3 - 2 * t))
}

/** Writes confidences into RGBA (white, alpha = person), blending with the previous mask by `smoothing` (0 = none) to calm flicker. */
export function writeSegmentMask(confidence: ArrayLike<number>, rgba: Uint8ClampedArray, smoothing: number): void {
  const keep = Math.min(0.9, Math.max(0, smoothing))
  for (let pixel = 0, index = 0; pixel < confidence.length; pixel += 1, index += 4) {
    const alpha = confidenceToAlpha(confidence[pixel])
    rgba[index] = 255
    rgba[index + 1] = 255
    rgba[index + 2] = 255
    rgba[index + 3] = keep > 0 ? rgba[index + 3] * keep + alpha * (1 - keep) : alpha
  }
}

/** Which of the model's masks is the person: a two-class model lists background first, a one-class model has only the person. */
export function pickPersonMask<T>(masks: readonly T[] | undefined): T | null {
  if (!masks || masks.length === 0) return null
  return masks.length === 1 ? masks[0] : masks[masks.length - 1]
}

interface SegmentMaskLike {
  width: number
  height: number
  getAsFloat32Array(): Float32Array
}
interface SegmenterLike {
  segmentForVideo(image: HTMLCanvasElement, timestampMs: number): { confidenceMasks?: readonly SegmentMaskLike[]; close?: () => void }
  close(): void
}
export type HeadlinerSegmenterLoader = () => Promise<SegmenterLike>

/** Creates the real segmenter: GPU first, CPU if the GPU delegate cannot start. Imported on demand so it stays out of the main bundle. */
export const loadMediaPipeSegmenter: HeadlinerSegmenterLoader = async () => {
  const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(HEADLINER_SEGMENT_WASM_URL)
  const create = (delegate: 'GPU' | 'CPU') => ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: HEADLINER_SEGMENT_MODEL_URL, delegate },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  })
  try {
    return await create('GPU') as unknown as SegmenterLike
  } catch {
    return await create('CPU') as unknown as SegmenterLike
  }
}

/** One shared segmenter for every effect that wants a silhouette; it loads on first use and closes when the last user lets go. */
export class HeadlinerSegmenter implements HeadlinerSegmentSource {
  private segmenter: SegmenterLike | null = null
  private users = 0
  private loading = false
  private status: HeadlinerSegmenterStatus = 'idle'
  private sequence = 0
  private lastRunSec = Number.NEGATIVE_INFINITY
  private runFailureReported = false
  private lastTimestampMs = 0
  private input: HTMLCanvasElement | null = null
  private mask: HTMLCanvasElement | null = null
  private image: ImageData | null = null

  constructor(private readonly load: HeadlinerSegmenterLoader = loadMediaPipeSegmenter) {}

  acquire(): void {
    this.users += 1
  }

  release(): void {
    this.users = Math.max(0, this.users - 1)
    if (this.users === 0) this.close()
  }

  sample(video: HTMLVideoElement, sourceRect: HeadlinerSourceRect, nowSec: number): HeadlinerSegmentSample {
    if (this.users > 0 && this.status === 'idle') void this.start()
    if (nowSec < this.lastRunSec) this.lastRunSec = Number.NEGATIVE_INFINITY
    if (this.segmenter && nowSec - this.lastRunSec >= 1 / HEADLINER_SEGMENT_HZ) {
      this.lastRunSec = nowSec
      this.run(video, sourceRect)
    }
    return { status: this.status, mask: this.sequence > 0 ? this.mask : null, sequence: this.sequence }
  }

  private async start(): Promise<void> {
    if (this.loading) return
    this.loading = true
    this.status = 'loading'
    try {
      const segmenter = await this.load()
      if (this.users === 0) {
        segmenter.close()
        this.status = 'idle'
        return
      }
      this.segmenter = segmenter
      this.status = 'ready'
    } catch (error) {
      this.status = 'unavailable'
      console.warn('[Headliner] Person segmentation could not start:', error)
      reportHeadlinerTrackerFailure('person', 'start', error)
    } finally {
      this.loading = false
    }
  }

  private run(video: HTMLVideoElement, sourceRect: HeadlinerSourceRect): void {
    const segmenter = this.segmenter
    if (!segmenter || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return
    const width = HEADLINER_SEGMENT_INPUT_WIDTH
    const height = Math.max(1, Math.round(width * (sourceRect.sh / Math.max(1, sourceRect.sw))))
    if (typeof document === 'undefined') return
    this.input ??= document.createElement('canvas')
    if (this.input.width !== width || this.input.height !== height) {
      this.input.width = width
      this.input.height = height
    }
    const inputContext = this.input.getContext('2d')
    if (!inputContext) return
    // MediaPipe needs strictly increasing timestamps.
    const timestampMs = Math.max(this.lastTimestampMs + 1, Math.round(performance.now()))
    this.lastTimestampMs = timestampMs
    try {
      inputContext.drawImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh, 0, 0, width, height)
      const result = segmenter.segmentForVideo(this.input, timestampMs)
      const person = pickPersonMask(result.confidenceMasks)
      if (person) this.store(person)
      result.close?.()
    } catch (error) {
      console.warn('[Headliner] Person segmentation failed:', error)
      if (!this.runFailureReported) {
        this.runFailureReported = true
        reportHeadlinerTrackerFailure('person', 'detect', error)
      }
    }
  }

  private store(person: SegmentMaskLike): void {
    const { width, height } = person
    if (width <= 0 || height <= 0) return
    this.mask ??= document.createElement('canvas')
    const resized = this.mask.width !== width || this.mask.height !== height
    if (resized) {
      this.mask.width = width
      this.mask.height = height
      this.image = null
    }
    const context = this.mask.getContext('2d')
    if (!context) return
    this.image ??= context.createImageData(width, height)
    writeSegmentMask(person.getAsFloat32Array(), this.image.data, 0.35)
    context.putImageData(this.image, 0, 0)
    this.sequence += 1
  }

  private close(): void {
    this.segmenter?.close()
    this.segmenter = null
    this.sequence = 0
    this.image = null
    if (this.status !== 'unavailable') this.status = 'idle'
    for (const canvas of [this.input, this.mask]) {
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
    }
    this.input = null
    this.mask = null
  }
}

let sharedSegmenter: HeadlinerSegmentSource | null = null

/** The segmenter every silhouette effect uses. */
export function getHeadlinerSegmenter(): HeadlinerSegmentSource {
  sharedSegmenter ??= new HeadlinerSegmenter()
  return sharedSegmenter
}

/** Swaps the shared segmenter (tests). Pass null to restore the MediaPipe one. */
export function setHeadlinerSegmenter(source: HeadlinerSegmentSource | null): void {
  sharedSegmenter = source
}

// ── Silhouette source with fallback ────────────────────────────────────────────

export interface HeadlinerSilhouette {
  /** White canvas whose alpha is the performer, or null while nothing is available yet. */
  mask: HTMLCanvasElement | null
  /** 'person' = segmentation model; 'background' = learned-background fallback; 'none' = not available yet. */
  source: 'person' | 'background' | 'none'
}

/** What an effect holds: acquires the segmenter on first use, falls back to the learned background if the model is unavailable. */
export class HeadlinerSilhouetteSource {
  private held: HeadlinerSegmentSource | null = null
  private isolator: HeadlinerPerformerIsolator | null = null

  constructor(private readonly provider: () => HeadlinerSegmentSource = getHeadlinerSegmenter) {}

  update(video: HTMLVideoElement, sourceRect: HeadlinerSourceRect, nowSec: number): HeadlinerSilhouette {
    if (!this.held) {
      this.held = this.provider()
      this.held.acquire()
    }
    const sample = this.held.sample(video, sourceRect, nowSec)
    if (sample.mask) return { mask: sample.mask, source: 'person' }
    if (sample.status !== 'unavailable') return { mask: null, source: 'none' }
    this.isolator ??= new HeadlinerPerformerIsolator()
    const mask = this.isolator.update(video, sourceRect, 'background', 0.6)
    return mask ? { mask, source: 'background' } : { mask: null, source: 'none' }
  }

  /** Lets go of the model (effect turned off) without disposing the source. */
  release(): void {
    this.held?.release()
    this.held = null
    this.isolator?.relearn()
  }

  dispose(): void {
    this.release()
    this.isolator?.dispose()
    this.isolator = null
  }
}
