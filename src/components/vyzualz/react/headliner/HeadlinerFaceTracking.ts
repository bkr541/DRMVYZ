// Face tracking for the Headliner face effects (Face Warp, Face Echo). A MediaPipe Face Landmarker runs on the
// camera picture a few dozen times a second; this module turns its 478 landmarks into one small, steady pose
// (where the head is, how big, how tilted) that the effects can follow. The model and its WASM runtime ship in
// public/mediapipe, so tracking works offline. The maths is pure so it can be tested without a camera.

/** The 36 landmarks around the edge of the face (MediaPipe's FACEMESH_FACE_OVAL, in loop order). */
export const HEADLINER_FACE_OVAL_INDICES: readonly number[] = Object.freeze([
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
])
/** Outer corners of the two eyes, used to read how far the head is tilted. */
const EYE_OUTER_A = 33
const EYE_OUTER_B = 263

export const HEADLINER_FACE_MODEL_URL = '/mediapipe/face_landmarker.task'
export const HEADLINER_FACE_WASM_URL = '/mediapipe/wasm'
/** Detection runs at most this often; effects smooth between detections. */
export const HEADLINER_FACE_DETECT_HZ = 30

export interface HeadlinerFaceLandmark {
  x: number
  y: number
}

/** A face in video-frame units: 0..1 across the whole camera picture (not the cropped view). */
export interface HeadlinerFacePose {
  cx: number
  cy: number
  /** Width and height of the face outline. */
  width: number
  height: number
  /** Head tilt in radians; positive turns the face clockwise on screen. */
  roll: number
}

/** The pose in canvas pixels, ready to draw with. */
export interface HeadlinerFaceBox {
  cx: number
  cy: number
  width: number
  height: number
  roll: number
}

export type HeadlinerFaceTrackerStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

export interface HeadlinerFaceSample {
  status: HeadlinerFaceTrackerStatus
  /** The latest detection, or null when no face was found in it. */
  pose: HeadlinerFacePose | null
  /** Increases with every detection, so a consumer can tell a new result from a repeat. */
  sequence: number
}

/** What the effects use: anything that can hand out face samples. Tests substitute their own. */
export interface HeadlinerFaceSource {
  acquire(): void
  release(): void
  sample(video: HTMLVideoElement, nowSec: number): HeadlinerFaceSample
}

/**
 * Works out the head pose from landmarks (each 0..1 across the video frame). Tilt is measured in pixel
 * space so a wide picture does not skew the angle.
 */
export function computeHeadlinerFacePose(
  landmarks: readonly HeadlinerFaceLandmark[],
  videoWidth: number,
  videoHeight: number,
): HeadlinerFacePose | null {
  if (landmarks.length <= EYE_OUTER_B || videoWidth <= 0 || videoHeight <= 0) return null
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const index of HEADLINER_FACE_OVAL_INDICES) {
    const point = landmarks[index]
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  const a = landmarks[EYE_OUTER_A]
  const b = landmarks[EYE_OUTER_B]
  // Landmark 33 is the subject's right eye, which sits on the left of the picture, so the eye line points rightward.
  const roll = Math.atan2((b.y - a.y) * videoHeight, (b.x - a.x) * videoWidth)
  const width = maxX - minX
  const height = maxY - minY
  if (!(width > 0) || !(height > 0)) return null
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, width, height, roll }
}

/** Maps a pose from video-frame units into canvas pixels, through the crop the picture is shown with. */
export function mapHeadlinerFaceToCanvas(
  pose: HeadlinerFacePose,
  videoWidth: number,
  videoHeight: number,
  sourceRect: { sx: number; sy: number; sw: number; sh: number },
  canvasWidth: number,
  canvasHeight: number,
): HeadlinerFaceBox {
  const scaleX = canvasWidth / Math.max(1, sourceRect.sw)
  const scaleY = canvasHeight / Math.max(1, sourceRect.sh)
  return {
    cx: (pose.cx * videoWidth - sourceRect.sx) * scaleX,
    cy: (pose.cy * videoHeight - sourceRect.sy) * scaleY,
    width: pose.width * videoWidth * scaleX,
    height: pose.height * videoHeight * scaleY,
    roll: pose.roll,
  }
}

export interface HeadlinerFaceFollow {
  pose: HeadlinerFacePose | null
  /** 1 while a face is being followed; falls to 0 after the face has been gone for a moment. */
  presence: number
}

const LOST_HOLD_SEC = 0.35
const LOST_FADE_SEC = 0.3

function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

/**
 * Smooths the detections into a pose that glides rather than jitters. A lost face is held where it was
 * for a moment, then fades out, so a single missed detection never makes an effect blink.
 */
export class HeadlinerFaceFilter {
  private pose: HeadlinerFacePose | null = null
  private target: HeadlinerFacePose | null = null
  private lastNowSec: number | null = null
  private lostForSec = 0
  private lastSequence = -1

  /** `smoothingSec` is the time constant: smaller follows the head tighter, larger is steadier. */
  update(sample: HeadlinerFaceSample, nowSec: number, smoothingSec: number): HeadlinerFaceFollow {
    const dt = this.lastNowSec === null ? 0 : Math.min(0.25, Math.max(0, nowSec - this.lastNowSec))
    this.lastNowSec = nowSec

    if (sample.sequence !== this.lastSequence) {
      this.lastSequence = sample.sequence
      this.target = sample.pose
      if (sample.pose) this.lostForSec = 0
    }
    if (!this.target) this.lostForSec += dt

    if (this.target) {
      if (!this.pose) {
        this.pose = { ...this.target }
      } else {
        const alpha = smoothingSec <= 0 ? 1 : 1 - Math.exp(-dt / smoothingSec)
        this.pose = {
          cx: this.pose.cx + (this.target.cx - this.pose.cx) * alpha,
          cy: this.pose.cy + (this.target.cy - this.pose.cy) * alpha,
          width: this.pose.width + (this.target.width - this.pose.width) * alpha,
          height: this.pose.height + (this.target.height - this.pose.height) * alpha,
          roll: this.pose.roll + shortestAngleDelta(this.pose.roll, this.target.roll) * alpha,
        }
      }
    }

    const presence = this.pose === null
      ? 0
      : this.lostForSec <= LOST_HOLD_SEC ? 1 : Math.max(0, 1 - (this.lostForSec - LOST_HOLD_SEC) / LOST_FADE_SEC)
    if (presence === 0 && this.target === null) this.pose = null
    return { pose: this.pose, presence }
  }

  reset(): void {
    this.pose = null
    this.target = null
    this.lastNowSec = null
    this.lostForSec = 0
    this.lastSequence = -1
  }
}

// ── MediaPipe tracker ──────────────────────────────────────────────────────────

interface FaceLandmarkerLike {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { faceLandmarks: readonly (readonly HeadlinerFaceLandmark[])[] }
  close(): void
}

export type HeadlinerFaceLandmarkerLoader = () => Promise<FaceLandmarkerLike>

/** Creates the real landmarker: GPU first, CPU if the GPU delegate cannot start. Imported on demand so it stays out of the main bundle. */
export const loadMediaPipeFaceLandmarker: HeadlinerFaceLandmarkerLoader = async () => {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(HEADLINER_FACE_WASM_URL)
  const create = (delegate: 'GPU' | 'CPU') => FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: HEADLINER_FACE_MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  })
  try {
    return await create('GPU')
  } catch {
    return await create('CPU')
  }
}

/** One shared landmarker for every effect that wants a face; it loads on first use and closes when the last user lets go. */
export class HeadlinerFaceTracker implements HeadlinerFaceSource {
  private landmarker: FaceLandmarkerLike | null = null
  private users = 0
  private loading = false
  private status: HeadlinerFaceTrackerStatus = 'idle'
  private pose: HeadlinerFacePose | null = null
  private sequence = 0
  private lastDetectSec = Number.NEGATIVE_INFINITY
  private lastTimestampMs = 0

  constructor(private readonly load: HeadlinerFaceLandmarkerLoader = loadMediaPipeFaceLandmarker) {}

  acquire(): void {
    this.users += 1
  }

  release(): void {
    this.users = Math.max(0, this.users - 1)
    if (this.users === 0) this.close()
  }

  getStatus(): HeadlinerFaceTrackerStatus {
    return this.status
  }

  sample(video: HTMLVideoElement, nowSec: number): HeadlinerFaceSample {
    if (this.users > 0 && this.status === 'idle') void this.start()
    if (nowSec < this.lastDetectSec) this.lastDetectSec = Number.NEGATIVE_INFINITY
    if (this.landmarker && nowSec - this.lastDetectSec >= 1 / HEADLINER_FACE_DETECT_HZ) {
      this.lastDetectSec = nowSec
      this.detect(video)
    }
    return { status: this.status, pose: this.pose, sequence: this.sequence }
  }

  private async start(): Promise<void> {
    if (this.loading) return
    this.loading = true
    this.status = 'loading'
    try {
      const landmarker = await this.load()
      if (this.users === 0) {
        landmarker.close()
        this.status = 'idle'
        return
      }
      this.landmarker = landmarker
      this.status = 'ready'
    } catch (error) {
      this.status = 'unavailable'
      console.warn('[Headliner] Face tracking could not start:', error)
    } finally {
      this.loading = false
    }
  }

  private detect(video: HTMLVideoElement): void {
    const landmarker = this.landmarker
    if (!landmarker || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return
    // MediaPipe needs strictly increasing timestamps.
    const timestampMs = Math.max(this.lastTimestampMs + 1, Math.round(performance.now()))
    this.lastTimestampMs = timestampMs
    try {
      const result = landmarker.detectForVideo(video, timestampMs)
      const landmarks = result.faceLandmarks[0]
      this.pose = landmarks ? computeHeadlinerFacePose(landmarks, video.videoWidth, video.videoHeight) : null
      this.sequence += 1
    } catch (error) {
      console.warn('[Headliner] Face detection failed:', error)
      this.pose = null
      this.sequence += 1
    }
  }

  private close(): void {
    this.landmarker?.close()
    this.landmarker = null
    this.pose = null
    this.sequence += 1
    if (this.status !== 'unavailable') this.status = 'idle'
  }
}

let sharedTracker: HeadlinerFaceSource | null = null

/** The tracker every face effect uses. */
export function getHeadlinerFaceTracker(): HeadlinerFaceSource {
  sharedTracker ??= new HeadlinerFaceTracker()
  return sharedTracker
}

/** Swaps the shared tracker (tests, or a future alternative detector). Pass null to restore the MediaPipe one. */
export function setHeadlinerFaceTracker(source: HeadlinerFaceSource | null): void {
  sharedTracker = source
}
