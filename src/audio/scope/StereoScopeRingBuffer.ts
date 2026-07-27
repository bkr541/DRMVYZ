import type { StereoScopeFrame } from './scopeTypes'

/**
 * Synchronized stereo ring buffer.
 *
 * Left and right share one write cursor, so index i in both channels always
 * refers to the same sample frame. That invariant is the whole point: a
 * vectorscope plotting left[i] against right[i] is only meaningful if the pair
 * came from the same instant.
 *
 * Reads return views into caller-owned scratch buffers that the ring reuses, so
 * a steady read loop performs no allocation. Callers that retain data past the
 * next `readLatest()` must copy.
 */
export class StereoScopeRingBuffer {
  readonly capacityFrames: number

  private readonly left: Float32Array
  private readonly right: Float32Array

  private writePos = 0
  private written = 0

  /** Absolute frame index the next write will occupy. */
  private nextWriteFrame = 0

  private sequence = 0
  private sampleRateValue: number
  private channelCountValue = 2

  /** Scratch buffers reused by readLatest(). Grown on demand, never per read. */
  private readLeft: Float32Array
  private readRight: Float32Array

  private discontinuityCount = 0
  private droppedFrameCount = 0

  constructor(sampleRate: number, seconds = 4) {
    this.sampleRateValue = sampleRate > 0 ? sampleRate : 48_000
    this.capacityFrames = Math.max(1024, Math.ceil(this.sampleRateValue * seconds))
    this.left = new Float32Array(this.capacityFrames)
    this.right = new Float32Array(this.capacityFrames)
    this.readLeft = new Float32Array(0)
    this.readRight = new Float32Array(0)
  }

  get sampleRate(): number {
    return this.sampleRateValue
  }

  get channelCount(): number {
    return this.channelCountValue
  }

  get availableFrames(): number {
    return Math.min(this.written, this.capacityFrames)
  }

  get discontinuities(): number {
    return this.discontinuityCount
  }

  get droppedFrames(): number {
    return this.droppedFrameCount
  }

  /** Absolute frame index one past the newest written frame. */
  get writeFrame(): number {
    return this.nextWriteFrame
  }

  setChannelCount(count: number): void {
    this.channelCountValue = count >= 2 ? 2 : 1
  }

  /**
   * Appends one synchronized block.
   *
   * `startFrame` is the capture-side absolute frame index of `left[0]`. A gap or
   * rewind relative to the previous block means the audio path was suspended,
   * reconnected, or the source changed; the ring resets rather than splicing old
   * and new samples into one window, which would render as a false transient.
   */
  write(left: Float32Array, right: Float32Array, startFrame: number, frameCount?: number): void {
    const count = Math.min(
      frameCount ?? left.length,
      left.length,
      right.length,
    )
    if (count <= 0) return

    if (this.written > 0 && startFrame !== this.nextWriteFrame) {
      const gap = startFrame - this.nextWriteFrame
      this.discontinuityCount++
      if (gap > 0) this.droppedFrameCount += gap
      this.reset(startFrame)
    } else if (this.written === 0) {
      this.nextWriteFrame = startFrame
    }

    for (let i = 0; i < count; i++) {
      this.left[this.writePos] = left[i]
      this.right[this.writePos] = right[i]
      this.writePos = (this.writePos + 1) % this.capacityFrames
    }

    this.written += count
    this.nextWriteFrame += count
  }

  /**
   * Reads the newest `frameCount` frames, oldest-first.
   *
   * Returns null when fewer frames are available than requested — a partially
   * filled window would silently plot zeros as signal.
   */
  readLatest(frameCount: number, audioTimeSeconds = 0): StereoScopeFrame | null {
    const count = Math.floor(frameCount)
    if (count <= 0) return null
    if (count > this.capacityFrames) return null
    if (this.availableFrames < count) return null

    if (this.readLeft.length !== count) {
      this.readLeft = new Float32Array(count)
      this.readRight = new Float32Array(count)
    }

    let readPos = (((this.writePos - count) % this.capacityFrames) + this.capacityFrames) % this.capacityFrames
    for (let i = 0; i < count; i++) {
      this.readLeft[i] = this.left[readPos]
      this.readRight[i] = this.right[readPos]
      readPos = readPos + 1 === this.capacityFrames ? 0 : readPos + 1
    }

    this.sequence++
    return {
      left: this.readLeft,
      right: this.readRight,
      sampleRate: this.sampleRateValue,
      startFrame: this.nextWriteFrame - count,
      sequenceNumber: this.sequence,
      audioTimeSeconds,
      channelCount: this.channelCountValue,
    }
  }

  /**
   * Discards buffered audio. Called on discontinuity, source change, and seek so
   * no window can straddle a transport jump.
   */
  reset(nextFrame = 0): void {
    this.writePos = 0
    this.written = 0
    this.nextWriteFrame = nextFrame
    this.left.fill(0)
    this.right.fill(0)
  }

  /** Clears health counters without discarding audio. */
  resetDiagnostics(): void {
    this.discontinuityCount = 0
    this.droppedFrameCount = 0
  }
}
