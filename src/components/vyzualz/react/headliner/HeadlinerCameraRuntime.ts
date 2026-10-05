import { createLogger } from '../../../../lib/logger'
import { getNativeCameraBridge, type NativeCameraAccessStatus } from '../../../../native/cameraAccessBridge'
import { HEADLINER_DEFAULT_CAMERA_SOURCE_ID, type HeadlinerInputSourceId } from './HeadlinerSettings'
import { describeHeadlinerCameraDevices } from './HeadlinerCameraDevices'

export type HeadlinerCameraSlotId = 'camera-1' | 'camera-2' | 'camera-3' | 'camera-4'
export type HeadlinerCameraRuntimeStatus = 'idle' | 'requesting' | 'live' | 'error' | 'disconnected'
export type HeadlinerCameraErrorCode =
  | 'permission-denied'
  | 'no-camera'
  | 'camera-busy'
  | 'no-video'
  | 'capture-error'

export interface HeadlinerCameraRuntimeSnapshot {
  slotId: HeadlinerCameraSlotId
  status: HeadlinerCameraRuntimeStatus
  errorCode: HeadlinerCameraErrorCode | null
  message: string | null
  /** Name of the camera actually delivering frames (the browser's track label), once one is open. */
  cameraLabel: string | null
  /** The OS-level camera permission seen at the last preflight; null outside the desktop app. */
  osAccess: NativeCameraAccessStatus | null
}

export interface HeadlinerCameraFrameSource {
  slotId: HeadlinerCameraSlotId
  sourceId: HeadlinerInputSourceId
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

export function buildHeadlinerCameraConstraints(sourceId: HeadlinerInputSourceId): MediaStreamConstraints {
  if (sourceId === HEADLINER_DEFAULT_CAMERA_SOURCE_ID) return HEADLINER_DEFAULT_CAMERA_CONSTRAINTS
  return { audio: false, video: { deviceId: { exact: sourceId } } }
}

export const HEADLINER_MUTE_LOSS_GRACE_MS = 1_500
// Opening a camera can take several seconds on a cold start (macOS wakes the device, virtual cameras
// spin up a pipeline), so a short deadline reports working cameras as broken.
export const HEADLINER_STARTUP_FRAME_TIMEOUT_MS = 10_000
export const HEADLINER_RECOVERY_DELAYS_MS = Object.freeze([750, 1_500, 3_000] as const)

const IDLE_SNAPSHOT: HeadlinerCameraRuntimeSnapshot = Object.freeze({
  slotId: 'camera-1',
  status: 'idle',
  errorCode: null,
  message: null,
  cameraLabel: null,
  osAccess: null,
})

const log = createLogger('react', 'headliner-camera')

export interface HeadlinerCameraErrorContext {
  /** True when the user picked a specific camera rather than the default. */
  specificDevice?: boolean
  osAccess?: NativeCameraAccessStatus | null
}

const ERROR_TITLES: Record<HeadlinerCameraErrorCode, string> = {
  'permission-denied': 'Camera Permission Required',
  'no-camera': 'No Camera Found',
  'camera-busy': 'Camera Busy',
  'no-video': 'Camera Detected but Video Failed to Start',
  'capture-error': 'Camera Error',
}

export function headlinerCameraErrorMessage(
  code: HeadlinerCameraErrorCode,
  context: HeadlinerCameraErrorContext = {},
  errorName = '',
): string {
  switch (code) {
    case 'permission-denied':
      if (context.osAccess === 'restricted') {
        return 'Camera access is restricted on this computer (for example by parental controls or a managed-device policy), so DRMVYZ cannot open it.'
      }
      if (context.osAccess === 'denied') {
        return 'Your system is blocking camera access for DRMVYZ. Turn DRMVYZ on in your system camera privacy settings, then quit and reopen DRMVYZ.'
      }
      return 'Camera access was blocked. Allow DRMVYZ to use the camera in your system camera privacy settings, then try again.'
    case 'no-camera':
      return context.specificDevice
        ? 'The selected camera is not connected. Reconnect it or choose another camera.'
        : 'No camera was found. Connect a camera (or start a virtual camera such as OBS), then try again.'
    case 'camera-busy':
      return 'The camera could not be opened. It may be in use by another app. Close other apps that use the camera, then try again.'
    case 'no-video':
      return 'A camera was detected but it never sent video. Another app may be holding it, or it may need a moment to wake up. Try again.'
    default:
      return `DRMVYZ could not start the camera${errorName ? ` (${errorName})` : ''}.`
  }
}

export function describeHeadlinerCameraStatus(
  snapshot: Pick<HeadlinerCameraRuntimeSnapshot, 'status' | 'errorCode' | 'message'>,
): { title: string; detail: string | null } {
  switch (snapshot.status) {
    case 'requesting':
      return { title: 'Starting Camera', detail: 'Allow camera access if your system asks.' }
    case 'live':
      return { title: 'Camera Live', detail: null }
    case 'disconnected':
      return { title: 'Connection Lost', detail: snapshot.message }
    case 'error':
      return {
        title: snapshot.errorCode ? ERROR_TITLES[snapshot.errorCode] : 'Camera Error',
        detail: snapshot.message,
      }
    default:
      return { title: 'Camera Not Started', detail: snapshot.message }
  }
}

function errorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') {
    return error.name
  }
  return ''
}

export function resolveHeadlinerCameraError(
  error: unknown,
  context: HeadlinerCameraErrorContext = {},
): Pick<HeadlinerCameraRuntimeSnapshot, 'errorCode' | 'message'> {
  const name = errorName(error)
  let code: HeadlinerCameraErrorCode
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      code = 'permission-denied'
      break
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      code = 'no-camera'
      break
    case 'NotReadableError':
    case 'TrackStartError':
      code = 'camera-busy'
      break
    default:
      code = 'capture-error'
  }
  return { errorCode: code, message: headlinerCameraErrorMessage(code, context, name) }
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
  private sourceId: HeadlinerInputSourceId = HEADLINER_DEFAULT_CAMERA_SOURCE_ID
  private cameraLabel: string | null = null
  private osAccess: NativeCameraAccessStatus | null = null
  /** Bumped whenever a request is superseded so a late-resolving stream is closed instead of adopted. */
  private requestToken = 0

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
      sourceId: this.sourceId,
      video: this.video,
      stream: this.stream,
    }
  }

  start(video: HTMLVideoElement, sourceId: HeadlinerInputSourceId = this.sourceId): Promise<void> {
    this.desiredActive = true
    this.video = video
    this.observeMediaDevices()
    if (sourceId !== this.sourceId) {
      this.sourceId = sourceId
      if (this.stream || this.requestPromise) {
        this.reopen()
        return this.requestPromise ?? Promise.resolve()
      }
    }

    if (this.stream) {
      this.attachStream(video, this.stream)
      return Promise.resolve()
    }
    if (this.requestPromise) return this.requestPromise

    this.recoveryAttempt = 0
    return this.requestCapture(false)
  }

  /** Switches to another camera (or the default). Closes the current stream and reopens with the new choice. */
  setSource(sourceId: HeadlinerInputSourceId): void {
    if (sourceId === this.sourceId) return
    this.sourceId = sourceId
    this.reopen()
  }

  /** Drops whatever the camera is doing and tries again from scratch — the manual "Try again" path. */
  retry(): void {
    this.reopen()
  }

  private reopen(): void {
    if (!this.desiredActive || !this.video) return
    this.requestToken += 1
    this.requestPromise = null
    this.clearRecoveryTimer()
    this.recoveryAttempt = 0
    this.detachStreamResources(true)
    void this.requestCapture(false)
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

    const token = ++this.requestToken
    const sourceId = this.sourceId
    const open = () => mediaDevices.getUserMedia(buildHeadlinerCameraConstraints(sourceId))
    // The OS gate only exists in the desktop app. Elsewhere go straight to the browser prompt.
    const preflight = getNativeCameraBridge() ? this.preflightOsAccess() : null
    const capture = preflight
      ? preflight.then(access => {
        if (token === this.requestToken) this.osAccess = access
        if (access === 'denied' || access === 'restricted') {
          throw new DOMException(`Operating system camera access is ${access}.`, 'NotAllowedError')
        }
        return open()
      })
      : open()

    const request = capture
      .then(stream => {
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length === 0) {
          stopStream(stream)
          this.handleCaptureFailure(new DOMException('No video track was returned.', 'NotFoundError'), recovering)
          return
        }

        if (!this.desiredActive || !this.video || token !== this.requestToken) {
          stopStream(stream)
          return
        }

        const track = videoTracks[0]
        this.cameraLabel = track.label || null
        log.info('camera opened', {
          source: sourceId,
          label: track.label || null,
          deviceId: track.getSettings?.().deviceId ?? null,
          osAccess: this.osAccess,
        })
        this.stream = stream
        this.attachStream(this.video, stream)
      })
      .catch(error => {
        if (this.desiredActive && token === this.requestToken) this.handleCaptureFailure(error, recovering)
      })
      .finally(() => {
        if (token === this.requestToken) this.requestPromise = null
      })

    this.requestPromise = request
    return request
  }

  private async preflightOsAccess(): Promise<NativeCameraAccessStatus> {
    const bridge = getNativeCameraBridge()
    if (!bridge) return 'unknown'
    try {
      let status = (await bridge.getAccessStatus?.()) ?? 'unknown'
      if (status === 'not-determined' && bridge.requestAccess) status = await bridge.requestAccess()
      return status
    } catch {
      return 'unknown'
    }
  }

  private errorContext(): HeadlinerCameraErrorContext {
    return {
      specificDevice: this.sourceId !== HEADLINER_DEFAULT_CAMERA_SOURCE_ID,
      osAccess: this.osAccess,
    }
  }

  /** Writes why a capture failed — and which cameras the system reported — so a bare "unavailable" is diagnosable. */
  private logFailure(error: unknown, code: HeadlinerCameraErrorCode): void {
    const name = errorName(error)
    const detail = error instanceof Error ? error.message : String(error ?? '')
    void describeHeadlinerCameraDevices().then(devices => {
      log.warn('camera failed', {
        code,
        errorName: name || null,
        errorMessage: detail || null,
        source: this.sourceId,
        osAccess: this.osAccess,
        devices,
      })
    })
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
      // A track that was still muted when the first frame arrived (markLive declined) goes live here.
      if (this.snapshot.status !== 'live' && track.readyState !== 'ended') {
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
        this.setFailure('no-video', new DOMException('Camera frames did not become available.', 'AbortError'))
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
    const resolved = resolveHeadlinerCameraError(error, this.errorContext())
    if (!recovering) {
      this.setError(error)
      return
    }
    this.logFailure(error, resolved.errorCode ?? 'capture-error')

    this.detachStreamResources(true)
    if (resolved.errorCode === 'permission-denied') {
      this.setSnapshot({
        status: 'disconnected',
        errorCode: resolved.errorCode,
        message: `The camera connection was lost. ${resolved.message ?? 'Camera permission is required to reconnect.'}`,
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
    this.cameraLabel = null
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
    const resolved = resolveHeadlinerCameraError(error, this.errorContext())
    this.logFailure(error, resolved.errorCode ?? 'capture-error')
    this.setSnapshot({ status: 'error', ...resolved })
  }

  private setFailure(code: HeadlinerCameraErrorCode, error: unknown): void {
    this.detachStreamResources(true)
    this.logFailure(error, code)
    this.setSnapshot({ status: 'error', errorCode: code, message: headlinerCameraErrorMessage(code, this.errorContext()) })
  }

  private setSnapshot(patch: Pick<HeadlinerCameraRuntimeSnapshot, 'status' | 'errorCode' | 'message'>): void {
    const next: HeadlinerCameraRuntimeSnapshot = {
      slotId: this.slotId,
      ...patch,
      cameraLabel: this.cameraLabel,
      osAccess: this.osAccess,
    }
    if (
      next.status === this.snapshot.status
      && next.errorCode === this.snapshot.errorCode
      && next.message === this.snapshot.message
      && next.cameraLabel === this.snapshot.cameraLabel
      && next.osAccess === this.snapshot.osAccess
    ) return
    this.snapshot = next
    this.listeners.forEach(listener => listener())
  }
}
