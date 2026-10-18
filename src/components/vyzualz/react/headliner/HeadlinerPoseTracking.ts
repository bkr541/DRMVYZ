// Body-point tracking for Spark Skeleton. A MediaPipe Pose Landmarker (lite model, shipped in public/mediapipe so it
// works offline) finds the 33 body landmarks on the camera picture a few dozen times a second. The filter smooths
// each point so lines glide instead of jitter, and hides points the model cannot see (a DJ behind the decks has no
// visible legs). The maths is pure so it can be tested without a camera.

export const HEADLINER_POSE_MODEL_URL = '/mediapipe/pose_landmarker_lite.task'
export const HEADLINER_POSE_WASM_URL = '/mediapipe/wasm'
/** Detection runs at most this often; effects smooth between detections. */
export const HEADLINER_POSE_DETECT_HZ = 30
export const HEADLINER_POSE_POINT_COUNT = 33

/** Bone pairs between the 33 landmarks (MediaPipe's pose topology: face, arms, hands, torso, legs, feet). */
export const HEADLINER_POSE_BONES: readonly (readonly [number, number])[] = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
] as const)

export interface HeadlinerPoseLandmark {
  x: number
  y: number
  visibility?: number
}

/** One tracked body point: 0..1 across the whole camera picture (not the cropped view), with how sure the model is that it is seen. */
export interface HeadlinerPosePoint {
  x: number
  y: number
  visibility: number
}

export type HeadlinerPoseTrackerStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

export interface HeadlinerPoseSample {
  status: HeadlinerPoseTrackerStatus
  /** The latest detection (33 points), or null when nobody was found. */
  points: readonly HeadlinerPosePoint[] | null
  /** Increases with every detection, so a consumer can tell a new result from a repeat. */
  sequence: number
}

/** What the effect uses: anything that can hand out pose samples. Tests substitute their own. */
export interface HeadlinerPoseSource {
  acquire(): void
  release(): void
  sample(video: HTMLVideoElement, nowSec: number): HeadlinerPoseSample
}

/** Converts landmarks into points, dropping anything non-finite. Returns null when there are not enough landmarks. */
export function readHeadlinerPosePoints(landmarks: readonly HeadlinerPoseLandmark[]): HeadlinerPosePoint[] | null {
  if (landmarks.length < HEADLINER_POSE_POINT_COUNT) return null
  const points: HeadlinerPosePoint[] = []
  for (let index = 0; index < HEADLINER_POSE_POINT_COUNT; index += 1) {
    const landmark = landmarks[index]
    const visible = Number.isFinite(landmark.x) && Number.isFinite(landmark.y)
    points.push({
      x: visible ? landmark.x : 0,
      y: visible ? landmark.y : 0,
      visibility: visible ? Math.min(1, Math.max(0, landmark.visibility ?? 1)) : 0,
    })
  }
  return points
}

export interface HeadlinerPoseFollow {
  /** Smoothed points, or null before anyone has been seen. */
  points: readonly HeadlinerPosePoint[] | null
  /** 1 while a body is being followed; falls to 0 after the body has been gone for a moment. */
  presence: number
}

const LOST_HOLD_SEC = 0.35
const LOST_FADE_SEC = 0.3

/** Smooths detections into points that glide. A lost body is held for a moment, then fades out, so a missed detection never blinks the effect. */
export class HeadlinerPoseFilter {
  private points: HeadlinerPosePoint[] | null = null
  private target: readonly HeadlinerPosePoint[] | null = null
  private lastNowSec: number | null = null
  private lostForSec = 0
  private lastSequence = -1

  /** `smoothingSec` is the time constant: smaller follows the body tighter, larger is steadier. */
  update(sample: HeadlinerPoseSample, nowSec: number, smoothingSec: number): HeadlinerPoseFollow {
    const dt = this.lastNowSec === null ? 0 : Math.min(0.25, Math.max(0, nowSec - this.lastNowSec))
    this.lastNowSec = nowSec

    if (sample.sequence !== this.lastSequence) {
      this.lastSequence = sample.sequence
      this.target = sample.points
      if (sample.points) this.lostForSec = 0
    }
    if (!this.target) this.lostForSec += dt

    if (this.target) {
      const alpha = smoothingSec <= 0 ? 1 : 1 - Math.exp(-dt / smoothingSec)
      if (!this.points) {
        this.points = this.target.map(point => ({ ...point }))
      } else {
        for (let index = 0; index < this.points.length; index += 1) {
          const current = this.points[index]
          const goal = this.target[index]
          current.x += (goal.x - current.x) * alpha
          current.y += (goal.y - current.y) * alpha
          current.visibility += (goal.visibility - current.visibility) * Math.min(1, alpha * 2)
        }
      }
    }

    const presence = this.points === null
      ? 0
      : this.lostForSec <= LOST_HOLD_SEC ? 1 : Math.max(0, 1 - (this.lostForSec - LOST_HOLD_SEC) / LOST_FADE_SEC)
    if (presence === 0 && this.target === null) this.points = null
    return { points: this.points, presence }
  }

  reset(): void {
    this.points = null
    this.target = null
    this.lastNowSec = null
    this.lostForSec = 0
    this.lastSequence = -1
  }
}

// ── MediaPipe tracker ──────────────────────────────────────────────────────────

interface PoseLandmarkerLike {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { landmarks: readonly (readonly HeadlinerPoseLandmark[])[] }
  close(): void
}

export type HeadlinerPoseLandmarkerLoader = () => Promise<PoseLandmarkerLike>

/** Creates the real landmarker: GPU first, CPU if the GPU delegate cannot start. Imported on demand so it stays out of the main bundle. */
export const loadMediaPipePoseLandmarker: HeadlinerPoseLandmarkerLoader = async () => {
  const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(HEADLINER_POSE_WASM_URL)
  const create = (delegate: 'GPU' | 'CPU') => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: HEADLINER_POSE_MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  })
  try {
    return await create('GPU') as unknown as PoseLandmarkerLike
  } catch {
    return await create('CPU') as unknown as PoseLandmarkerLike
  }
}

/** One shared landmarker; it loads on first use and closes when the last user lets go. */
export class HeadlinerPoseTracker implements HeadlinerPoseSource {
  private landmarker: PoseLandmarkerLike | null = null
  private users = 0
  private loading = false
  private status: HeadlinerPoseTrackerStatus = 'idle'
  private points: HeadlinerPosePoint[] | null = null
  private sequence = 0
  private lastDetectSec = Number.NEGATIVE_INFINITY
  private lastTimestampMs = 0

  constructor(private readonly load: HeadlinerPoseLandmarkerLoader = loadMediaPipePoseLandmarker) {}

  acquire(): void {
    this.users += 1
  }

  release(): void {
    this.users = Math.max(0, this.users - 1)
    if (this.users === 0) this.close()
  }

  sample(video: HTMLVideoElement, nowSec: number): HeadlinerPoseSample {
    if (this.users > 0 && this.status === 'idle') void this.start()
    if (nowSec < this.lastDetectSec) this.lastDetectSec = Number.NEGATIVE_INFINITY
    if (this.landmarker && nowSec - this.lastDetectSec >= 1 / HEADLINER_POSE_DETECT_HZ) {
      this.lastDetectSec = nowSec
      this.detect(video)
    }
    return { status: this.status, points: this.points, sequence: this.sequence }
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
      console.warn('[Headliner] Body tracking could not start:', error)
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
      const landmarks = result.landmarks[0]
      this.points = landmarks ? readHeadlinerPosePoints(landmarks) : null
      this.sequence += 1
    } catch (error) {
      console.warn('[Headliner] Body detection failed:', error)
      this.points = null
      this.sequence += 1
    }
  }

  private close(): void {
    this.landmarker?.close()
    this.landmarker = null
    this.points = null
    this.sequence += 1
    if (this.status !== 'unavailable') this.status = 'idle'
  }
}

let sharedTracker: HeadlinerPoseSource | null = null

/** The tracker every body-point effect uses. */
export function getHeadlinerPoseTracker(): HeadlinerPoseSource {
  sharedTracker ??= new HeadlinerPoseTracker()
  return sharedTracker
}

/** Swaps the shared tracker (tests). Pass null to restore the MediaPipe one. */
export function setHeadlinerPoseTracker(source: HeadlinerPoseSource | null): void {
  sharedTracker = source
}

/** Maps a point from video-frame units into canvas pixels, through the crop the picture is shown with. */
export function mapHeadlinerPoseToCanvas(
  point: { x: number; y: number },
  videoWidth: number,
  videoHeight: number,
  sourceRect: { sx: number; sy: number; sw: number; sh: number },
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (point.x * videoWidth - sourceRect.sx) * (canvasWidth / Math.max(1, sourceRect.sw)),
    y: (point.y * videoHeight - sourceRect.sy) * (canvasHeight / Math.max(1, sourceRect.sh)),
  }
}
