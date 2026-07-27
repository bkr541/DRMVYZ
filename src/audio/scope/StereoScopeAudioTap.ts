import { StereoScopeRingBuffer } from './StereoScopeRingBuffer'
import type {
  ScopeCaptureUnavailableReason,
  StereoScopeCaptureStatus,
  StereoScopeFrame,
} from './scopeTypes'

const WORKLET_MODULE_URL = '/worklets/stereo-scope-processor.js'
const PROCESSOR_NAME = 'stereo-scope-processor'
const BLOCK_FRAMES = 1024
const RING_SECONDS = 4

interface StereoScopeBlockMessage {
  type: 'block'
  left: Float32Array
  right: Float32Array
  frameCount: number
  startFrame: number
  sampleRate: number
  droppedBlocks: number
}

/**
 * Owns the stereo capture worklet and the ring buffer it feeds.
 *
 * The tap is a pure observer: it connects the source to a zero-output worklet
 * node and never inserts anything into the monitoring path, so it cannot change
 * what the user hears or add latency to it.
 *
 * Capture is best-effort by contract. When AudioWorklet is unavailable (older
 * runtime, restrictive CSP) or the module fails to load, the tap reports an
 * unavailable reason and `readLatest()` returns null forever. Callers fall back
 * to the existing mono analyser path — professional scope modes degrade, the
 * engine does not.
 */
export class StereoScopeAudioTap {
  private readonly context: AudioContext
  private readonly ring: StereoScopeRingBuffer

  private node: AudioWorkletNode | null = null
  private source: AudioNode | null = null
  private disposed = false
  private started = false
  private loadFailureReason: Extract<
    ScopeCaptureUnavailableReason,
    'workletUnsupported' | 'workletLoadFailed'
  > | null = null
  private observedChannelCount = 2

  constructor(context: AudioContext) {
    this.context = context
    this.ring = new StereoScopeRingBuffer(context.sampleRate, RING_SECONDS)
  }

  get sampleRate(): number {
    return this.ring.sampleRate
  }

  /**
   * Loads the worklet module and starts capturing from `source`.
   *
   * Safe to call once per tap. Resolves to true when capture is running.
   */
  async start(source: AudioNode): Promise<boolean> {
    if (this.disposed || this.started) return this.node != null
    this.started = true
    this.source = source

    if (typeof AudioWorkletNode === 'undefined' || !this.context.audioWorklet) {
      this.loadFailureReason = 'workletUnsupported'
      return false
    }

    try {
      await this.context.audioWorklet.addModule(WORKLET_MODULE_URL)
    } catch {
      this.loadFailureReason = 'workletLoadFailed'
      return false
    }

    // The context may have been torn down while the module loaded.
    if (this.disposed) return false

    try {
      const node = new AudioWorkletNode(this.context, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      })
      node.port.onmessage = this.handleMessage
      // Assign before seeding: recycle() posts through this.node, so seeding
      // first would silently drop the pool and lose the opening blocks.
      this.node = node
      // Seed the worklet's buffer pool so the first blocks are never dropped.
      for (let i = 0; i < 4; i++) this.recycle(new Float32Array(BLOCK_FRAMES), new Float32Array(BLOCK_FRAMES))
      source.connect(node)
      return true
    } catch {
      this.loadFailureReason = 'workletLoadFailed'
      return false
    }
  }

  private handleMessage = (event: MessageEvent<StereoScopeBlockMessage>): void => {
    if (this.disposed) return
    const data = event.data
    if (!data || data.type !== 'block') return

    this.ring.write(data.left, data.right, data.startFrame, data.frameCount)

    // Hand the buffers straight back so the audio thread never allocates.
    this.recycle(data.left, data.right)
  }

  private recycle(left: Float32Array, right: Float32Array): void {
    const node = this.node
    if (!node) return
    try {
      node.port.postMessage({ type: 'recycle', left, right }, [left.buffer, right.buffer])
    } catch {
      // A detached or already-transferred buffer is not worth escalating; the
      // worklet allocates a replacement pair on its next flush.
    }
  }

  /**
   * Declares the true channel count of the current source.
   *
   * The worklet duplicates mono into R, which is correct for plotting but would
   * otherwise make a mono file look like a perfectly correlated stereo signal.
   * Consumers use this to label the display honestly.
   */
  setSourceChannelCount(count: number): void {
    this.observedChannelCount = count >= 2 ? 2 : 1
    this.ring.setChannelCount(this.observedChannelCount)
  }

  /**
   * Reconnects capture to a new source node without rebuilding the worklet.
   * The ring resets so no window straddles the switch.
   */
  reconnect(source: AudioNode): void {
    if (this.disposed || !this.node) {
      this.source = source
      return
    }
    if (this.source === source) return
    try {
      this.source?.disconnect(this.node)
    } catch {
      // Already disconnected — nothing to undo.
    }
    this.source = source
    source.connect(this.node)
    this.ring.reset(this.ring.writeFrame)
  }

  /** Discards buffered audio. Call on seek, track change, and loop wrap. */
  reset(): void {
    this.ring.reset(this.ring.writeFrame)
  }

  /**
   * Reads the newest synchronized stereo window.
   * Returns null when capture is unavailable or the window is not yet filled.
   */
  readLatest(frameCount: number, audioTimeSeconds = 0): StereoScopeFrame | null {
    if (this.disposed || !this.node) return null
    return this.ring.readLatest(frameCount, audioTimeSeconds)
  }

  getStatus(): StereoScopeCaptureStatus {
    const available = this.ring.availableFrames
    const active = !this.disposed && this.node != null && available > 0
    return {
      active,
      unavailableReason: active ? null : this.resolveUnavailableReason(),
      sampleRate: this.ring.sampleRate,
      channelCount: this.observedChannelCount,
      availableFrames: available,
      droppedFrames: this.ring.droppedFrames,
      discontinuities: this.ring.discontinuities,
    }
  }

  private resolveUnavailableReason(): ScopeCaptureUnavailableReason {
    if (this.disposed) return 'disposed'
    if (!this.started) return 'notStarted'
    if (this.loadFailureReason) return this.loadFailureReason
    if (!this.node) return 'workletLoadFailed'
    return 'awaitingFirstBlock'
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const node = this.node
    if (node) {
      node.port.onmessage = null
      try {
        this.source?.disconnect(node)
      } catch {
        // Source may already be torn down with the context.
      }
      try {
        node.disconnect()
      } catch {
        // Zero-output node; disconnect is defensive.
      }
    }
    this.node = null
    this.source = null
    this.ring.reset()
  }
}
