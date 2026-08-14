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

export const HEADLINER_MUTE_LOSS_GRACE_MS = 1_500
export const HEADLINER_STARTUP_FRAME_TIMEOUT_MS = 5_000
export const HEADLINER_RECOVERY_DELAYS_MS = Object.freeze([750, 1_500, 3_000] as const)

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
  private mediaDevicesCleanup: (() => void) | null = null
  private muteLossTimer: number | null = null
  private startupFrameTimer: number | null = null
  private recoveryTimer: number | null = null
  private recoveryAttempt = 0

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
    this.observeMediaDevices()

    if (this.stream) {
      this.attachStream(video, this.stream)
      return Promise.resolve()
    }
    if (this.requestPromise) return this.requestPromise

    this.recoveryAttempt = 0
    return this.requestCapture(false)
  }

  stop(): void {
    this.desiredActive = false
    this.clearMuteLossTimer()
    this.clearStartupFrameTimer()
    this.clearRecoveryTimer()
    this.mediaDevicesCleanup?.()
    this.mediaDevicesCleanup = null
    this.detachStreamResources(true)
    this.video = null
    this.recoveryAttempt = 0
    this.setSnapshot({ status: 'idle', errorCode: null, message: null })
  }

  private requestCapture(recovering: boolean): Promise<void> {
    if (!this.desiredActive || !this.video) return Promise.resolve()
    if (this.requestPromise) return this.requestPromise

    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.getUserMedia) {
      this.setError(new DOMException('Camera capture is unavailable.', 'NotFoundError'))
      return Promise.resolve()
    }

    this.clearRecoveryTimer()
    if (recovering) this.detachStreamResources(true)
    if (!recovering) this.setSnapshot({ status: 'requesting', errorCode: null, message: null })

    const request = mediaDevices.getUserMedia(HEADLINER_DEFAULT_CAMERA_CONSTRAINTS)
      .then(stream => {
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length === 0) {
          stopStream(stream)
          this.handleCaptureFailure(new DOMException('No video track was returned.', 'NotFoundError'), recovering)
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
        if (this.desiredActive) this.handleCaptureFailure(error, recovering)
      })
      .finally(() => {
        this.requestPromise = null
      })

    this.requestPromise = request
    return request
  }

  private attachStream(video: HTMLVideoElement, stream: MediaStream): void {
    this.videoCleanup?.()
    this.videoCleanup = null
    this.trackCleanup?.()
    this.trackCleanup = null
    this.clearMuteLossTimer()
    this.clearStartupFrameTimer()

    video.srcObject = stream
    video.muted = true
    video.playsInline = true

    const markLive = () => {
      if (!this.desiredActive || this.stream !== stream || this.video !== video) return
      const track = stream.getVideoTracks()[0]
      if (!track || track.readyState === 'ended' || track.muted) return
      this.clearMuteLossTimer()
      this.clearStartupFrameTimer()
      this.clearRecoveryTimer()
      this.recoveryAttempt = 0
      this.setSnapshot({ status: 'live', errorCode: null, message: null })
    }
    const handleVideoError = () => {
      if (!this.desiredActive || this.stream !== stream || this.video !== video) return
      this.transitionToDisconnected('The camera connection was lost.', true)
    }
    video.addEventListener('loadeddata', markLive)
    video.addEventListener('canplay', markLive)
    video.addEventListener('error', handleVideoError)
    this.videoCleanup = () => {
      video.removeEventListener('loadeddata', markLive)
      video.removeEventListener('canplay', markLive)
      video.removeEventListener('error', handleVideoError)
      if (video.srcObject === stream) video.srcObject = null
    }

    const track = stream.getVideoTracks()[0]
    const handleEnded = () => {
      if (!this.desiredActive || this.stream !== stream) return
      this.transitionToDisconnected('The camera connection was lost.', true)
    }
    const handleMute = () => {
      if (!this.desiredActive || this.stream !== stream || this.muteLossTimer !== null) return
      this.muteLossTimer = window.setTimeout(() => {
        this.muteLossTimer = null
        if (!this.desiredActive || this.stream !== stream || !track.muted) return
        this.transitionToDisconnected('The camera signal stopped responding.', false)
      }, HEADLINER_MUTE_LOSS_GRACE_MS)
    }
    const handleUnmute = () => {
      if (!this.desiredActive || this.stream !== stream) return
      this.clearMuteLossTimer()
      if (this.snapshot.status === 'disconnected' && track.readyState !== 'ended') {
        if (video.readyState >= 2) markLive()
      }
    }
    track.addEventListener('ended', handleEnded)
    track.addEventListener('mute', handleMute)
    track.addEventListener('unmute', handleUnmute)
    this.trackCleanup = () => {
      track.removeEventListener('ended', handleEnded)
      track.removeEventListener('mute', handleMute)
      track.removeEventListener('unmute', handleUnmute)
    }

    this.startupFrameTimer = window.setTimeout(() => {
      this.startupFrameTimer = null
      if (!this.desiredActive || this.stream !== stream || this.snapshot.status === 'live') return
      if (this.recoveryAttempt > 0) {
        this.transitionToDisconnected('The camera did not resume video frames.', true)
      } else {
        this.setError(new DOMException('Camera frames did not become available.', 'NotReadableError'))
      }
    }, HEADLINER_STARTUP_FRAME_TIMEOUT_MS)

    const playResult = video.play()
    if (playResult && typeof playResult.catch === 'function') {
      void playResult.catch(() => {
        // Muted MediaStream playback normally succeeds without user gesture.
        // A later loadeddata/canplay event is the authoritative live signal.
      })
    }
  }

  private handleCaptureFailure(error: unknown, recovering: boolean): void {
    const resolved = resolveHeadlinerCameraError(error)
    if (!recovering) {
      this.setError(error)
      return
    }

    this.detachStreamResources(true)
    if (resolved.errorCode === 'permission-denied') {
      this.setSnapshot({
        status: 'disconnected',
        errorCode: resolved.errorCode,
        message: 'The camera connection was lost. Camera permission is required to reconnect.',
      })
      return
    }

    this.setSnapshot({
      status: 'disconnected',
      errorCode: resolved.errorCode,
      message: 'The camera connection was lost. DRMVYZ is waiting to reconnect.',
    })
    this.scheduleRecovery()
  }

  private transitionToDisconnected(message: string, releaseStream: boolean): void {
    this.clearMuteLossTimer()
    this.clearStartupFrameTimer()
    if (releaseStream) this.detachStreamResources(true)
    this.setSnapshot({ status: 'disconnected', errorCode: null, message })
    this.scheduleRecovery()
  }

  private scheduleRecovery(delayOverride?: number): void {
    if (!this.desiredActive || !this.video || this.recoveryTimer !== null) return
    if (this.snapshot.errorCode === 'permission-denied') return
    if (this.recoveryAttempt >= HEADLINER_RECOVERY_DELAYS_MS.length) return

    const delay = delayOverride ?? HEADLINER_RECOVERY_DELAYS_MS[this.recoveryAttempt]
    this.recoveryAttempt += 1
    this.recoveryTimer = window.setTimeout(() => {
      this.recoveryTimer = null
      if (!this.desiredActive || !this.video) return
      void this.requestCapture(true)
    }, delay)
  }

  private observeMediaDevices(): void {
    if (this.mediaDevicesCleanup) return
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.addEventListener) return

    const handleDeviceChange = () => {
      if (!this.desiredActive || !this.video || this.requestPromise) return
      if (this.snapshot.status !== 'disconnected' && this.snapshot.status !== 'error') return
      if (this.snapshot.errorCode === 'permission-denied') return
      this.recoveryAttempt = 0
      this.clearRecoveryTimer()
      this.scheduleRecovery(0)
    }
    mediaDevices.addEventListener('devicechange', handleDeviceChange)
    this.mediaDevicesCleanup = () => mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }

  private detachStreamResources(stopTracks: boolean): void {
    this.videoCleanup?.()
    this.videoCleanup = null
    this.trackCleanup?.()
    this.trackCleanup = null
    this.clearMuteLossTimer()
    this.clearStartupFrameTimer()

    const stream = this.stream
    this.stream = null
    if (stopTracks) stopStream(stream)
  }

  private clearMuteLossTimer(): void {
    if (this.muteLossTimer === null) return
    window.clearTimeout(this.muteLossTimer)
    this.muteLossTimer = null
  }

  private clearStartupFrameTimer(): void {
    if (this.startupFrameTimer === null) return
    window.clearTimeout(this.startupFrameTimer)
    this.startupFrameTimer = null
  }

  private clearRecoveryTimer(): void {
    if (this.recoveryTimer === null) return
    window.clearTimeout(this.recoveryTimer)
    this.recoveryTimer = null
  }

  private setError(error: unknown): void {
    this.detachStreamResources(true)
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
