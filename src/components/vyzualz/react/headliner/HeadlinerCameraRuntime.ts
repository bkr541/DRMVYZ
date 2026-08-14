export type HeadlinerCameraSlotId = 'camera-1' | 'camera-2' | 'camera-3' | 'camera-4'
export type HeadlinerCameraRuntimeStatus = 'idle' | 'requesting' | 'live' | 'error' | 'disconnected'
export type HeadlinerCameraErrorCode = 'permission-denied' | 'unavailable' | 'capture-error'

export interface HeadlinerCameraRuntimeSnapshot {
  slotId: HeadlinerCameraSlotId
  status: HeadlinerCameraRuntimeStatus
  errorCode: HeadlinerCameraErrorCode | null
  message: string | null
}

export interface HeadlinerCameraFrameSource {
  slotId: HeadlinerCameraSlotId
  sourceId: 'default-front-camera'
  video: HTMLVideoElement
  stream: MediaStream
}

export const HEADLINER_CAMERA_SLOT_IDS: readonly HeadlinerCameraSlotId[] = Object.freeze([
  'camera-1',
  'camera-2',
  'camera-3',
  'camera-4',
])

export const HEADLINER_DEFAULT_CAMERA_CONSTRAINTS: Readonly<MediaStreamConstraints> = Object.freeze({
  audio: false,
  video: Object.freeze({
    facingMode: Object.freeze({ ideal: 'user' }),
  }),
})

const IDLE_SNAPSHOT: HeadlinerCameraRuntimeSnapshot = Object.freeze({
  slotId: 'camera-1',
  status: 'idle',
  errorCode: null,
  message: null,
})

function errorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') {
    return error.name
  }
  return ''
}

export function resolveHeadlinerCameraError(error: unknown): Pick<HeadlinerCameraRuntimeSnapshot, 'errorCode' | 'message'> {
  switch (errorName(error)) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        errorCode: 'permission-denied',
        message: 'Camera permission was denied. Allow camera access, then leave and re-enter Headliner to try again.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        errorCode: 'unavailable',
        message: 'The default front camera is unavailable. Check that a camera is connected and not in use by another app.',
      }
    default:
      return {
        errorCode: 'capture-error',
        message: 'DRMVYZ could not start the default front camera.',
      }
  }
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach(track => track.stop())
}

export class HeadlinerCameraRuntime {
  readonly slotId: HeadlinerCameraSlotId

  private snapshot: HeadlinerCameraRuntimeSnapshot
  private listeners = new Set<() => void>()
  private desiredActive = false
  private requestPromise: Promise<void> | null = null
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null
  private videoCleanup: (() => void) | null = null
  private trackCleanup: (() => void) | null = null

  constructor(slotId: HeadlinerCameraSlotId = 'camera-1') {
    this.slotId = slotId
    this.snapshot = { ...IDLE_SNAPSHOT, slotId }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): HeadlinerCameraRuntimeSnapshot => this.snapshot

  getFrameSource = (): HeadlinerCameraFrameSource | null => {
    if (this.snapshot.status !== 'live' || !this.video || !this.stream) return null
    return {
      slotId: this.slotId,
      sourceId: 'default-front-camera',
      video: this.video,
      stream: this.stream,
    }
  }

  start(video: HTMLVideoElement): Promise<void> {
    this.desiredActive = true
    this.video = video

    if (this.stream) {
      this.attachStream(video, this.stream)
      return Promise.resolve()
    }
    if (this.requestPromise) return this.requestPromise

    if (!navigator.mediaDevices?.getUserMedia) {
      this.setError(new DOMException('Camera capture is unavailable.', 'NotFoundError'))
      return Promise.resolve()
    }

    this.setSnapshot({ status: 'requesting', errorCode: null, message: null })
    const request = navigator.mediaDevices.getUserMedia(HEADLINER_DEFAULT_CAMERA_CONSTRAINTS)
      .then(stream => {
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length === 0) {
          stopStream(stream)
          this.setError(new DOMException('No video track was returned.', 'NotFoundError'))
          return
        }

        if (!this.desiredActive || !this.video) {
          stopStream(stream)
          return
        }

        this.stream = stream
        this.attachStream(this.video, stream)
      })
      .catch(error => {
        if (this.desiredActive) this.setError(error)
      })
      .finally(() => {
        this.requestPromise = null
      })

    this.requestPromise = request
    return request
  }

  stop(): void {
    this.desiredActive = false
    this.detachRuntimeResources(true)
    this.setSnapshot({ status: 'idle', errorCode: null, message: null })
  }

  private attachStream(video: HTMLVideoElement, stream: MediaStream): void {
    this.videoCleanup?.()
    this.trackCleanup?.()

    video.srcObject = stream
    video.muted = true
    video.playsInline = true

    const markLive = () => {
      if (!this.desiredActive || this.stream !== stream || this.video !== video) return
      this.setSnapshot({ status: 'live', errorCode: null, message: null })
    }
    video.addEventListener('loadeddata', markLive)
    video.addEventListener('canplay', markLive)
    this.videoCleanup = () => {
      video.removeEventListener('loadeddata', markLive)
      video.removeEventListener('canplay', markLive)
      if (video.srcObject === stream) video.srcObject = null
    }

    const track = stream.getVideoTracks()[0]
    const handleEnded = () => {
      if (!this.desiredActive || this.stream !== stream) return
      this.setSnapshot({
        status: 'disconnected',
        errorCode: null,
        message: 'The camera connection was lost.',
      })
    }
    track.addEventListener('ended', handleEnded)
    this.trackCleanup = () => track.removeEventListener('ended', handleEnded)

    const playResult = video.play()
    if (playResult && typeof playResult.catch === 'function') {
      void playResult.catch(() => {
        // Muted MediaStream playback normally succeeds without user gesture.
        // A later loadeddata/canplay event is the authoritative live signal.
      })
    }
  }

  private detachRuntimeResources(stopTracks: boolean): void {
    this.videoCleanup?.()
    this.videoCleanup = null
    this.trackCleanup?.()
    this.trackCleanup = null

    const stream = this.stream
    this.stream = null
    this.video = null
    if (stopTracks) stopStream(stream)
  }

  private setError(error: unknown): void {
    this.detachRuntimeResources(true)
    const resolved = resolveHeadlinerCameraError(error)
    this.setSnapshot({ status: 'error', ...resolved })
  }

  private setSnapshot(patch: Omit<HeadlinerCameraRuntimeSnapshot, 'slotId'>): void {
    const next: HeadlinerCameraRuntimeSnapshot = { slotId: this.slotId, ...patch }
    if (
      next.status === this.snapshot.status
      && next.errorCode === this.snapshot.errorCode
      && next.message === this.snapshot.message
    ) return
    this.snapshot = next
    this.listeners.forEach(listener => listener())
  }
}
