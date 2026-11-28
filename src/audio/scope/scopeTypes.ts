// ── Stereo scope capture: contracts ──────────────────────────────────────────
//
// Types for the synchronized stereo capture (StereoScopeAudioTap and its ring buffer) that Sound Drawing XY reads.
// Nothing here knows about rendering.

/** One synchronized stereo window read out of the capture ring buffer. */
export interface StereoScopeFrame {
  left: Float32Array
  right: Float32Array
  sampleRate: number
  /** Absolute sample-frame index of left[0]/right[0] since capture started. */
  startFrame: number
  /** Monotonic counter incremented once per successful read. */
  sequenceNumber: number
  audioTimeSeconds: number
  /** Channel count of the underlying source. 1 means R was duplicated from L. */
  channelCount: number
}

/** Health of the capture path, surfaced for diagnostics and UI honesty. */
export interface StereoScopeCaptureStatus {
  /** True once the capture is running and producing blocks. */
  active: boolean
  /** Reason capture is unavailable; null while healthy. */
  unavailableReason: ScopeCaptureUnavailableReason | null
  sampleRate: number
  channelCount: number
  /** Frames currently readable from the ring buffer. */
  availableFrames: number
  /** Sample frames lost to worklet pool exhaustion or main-thread stalls. */
  droppedFrames: number
  /** Count of detected gaps in the frame counter (suspend/resume, reconnection). */
  discontinuities: number
}

export type ScopeCaptureUnavailableReason =
  | 'notStarted'
  | 'workletUnsupported'
  | 'workletLoadFailed'
  | 'workletStalled'
  | 'fallbackStalled'
  | 'awaitingFirstBlock'
  | 'disposed'
