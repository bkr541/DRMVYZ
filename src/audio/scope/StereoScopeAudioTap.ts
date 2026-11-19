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
const CAPTURE_STALL_SECONDS = .4

type WorkletFailure = Extract<ScopeCaptureUnavailableReason, 'workletUnsupported' | 'workletLoadFailed' | 'workletStalled'>

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
 * If the worklet cannot deliver blocks, a muted legacy processor reads both
 * channels from one AudioBuffer so the fallback retains their sample alignment.
 */
export class StereoScopeAudioTap {
  private readonly context: AudioContext
  private readonly ring: StereoScopeRingBuffer

  private node: AudioWorkletNode | null = null
  private fallback: { node: ScriptProcessorNode; sink: GainNode } | null = null
  private source: AudioNode | null = null
  private disposed = false
  private started = false
  private loadFailureReason: WorkletFailure | null = null
  private lastBlockTime = 0
  private triedStallRecovery = false
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
    if (this.disposed || this.started) return this.captureNode != null
    this.started = true
    this.source = source

    if (typeof AudioWorkletNode === 'undefined' || !this.context.audioWorklet) {
      return this.startFallback('workletUnsupported')
    }

    try {
      await this.context.audioWorklet.addModule(WORKLET_MODULE_URL)
    } catch {
      return this.startFallback('workletLoadFailed')
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
      this.source?.connect(node)
      this.lastBlockTime = this.context.currentTime
      return true
    } catch {
      this.disconnectCapture()
      return this.startFallback('workletLoadFailed')
    }
  }

  private get captureNode(): AudioNode | null { return this.node ?? this.fallback?.node ?? null }

  private startFallback(reason: WorkletFailure): boolean {
    if (this.disposed) return false
    this.loadFailureReason = reason
    const source = this.source
    if (!source || typeof this.context.createScriptProcessor !== 'function') return false
    let node: ScriptProcessorNode | undefined
    let sink: GainNode | undefined
    try {
      sink = this.context.createGain()
      // Keep the fallback scheduled without adding its signal to program output.
      sink.gain.value = 0
      // A full 20 ms scope window fits in one callback, even at high sample rates.
      const blockSize = Math.min(16_384, Math.max(BLOCK_FRAMES, 2 ** Math.ceil(Math.log2(this.sampleRate / 50))))
      node = this.context.createScriptProcessor(blockSize, 2, 1)
      node.onaudioprocess = event => {
        if (this.fallback?.node !== node) return
        const input = event.inputBuffer
        const left = input.getChannelData(0), right = input.numberOfChannels > 1 ? input.getChannelData(1) : left
        this.ring.write(left, right, Math.round(event.playbackTime * this.ring.sampleRate))
        this.lastBlockTime = this.context.currentTime
      }
      node.connect(sink)
      sink.connect(this.context.destination)
      source.connect(node)
      this.disconnectCapture()
      this.ring.reset(this.ring.writeFrame)
      this.fallback = { node, sink }
      this.lastBlockTime = this.context.currentTime
      this.loadFailureReason = null
      return true
    } catch {
      if (node) {
        node.onaudioprocess = null
        try { source.disconnect(node) } catch { /* The connection may not have completed. */ }
        try { node.disconnect() } catch { /* The graph may already be closed. */ }
      }
      try { sink?.disconnect() } catch { /* The graph may already be closed. */ }
      return false
    }
  }

  private handleMessage = (event: MessageEvent<StereoScopeBlockMessage>): void => {
    if (this.disposed || !this.node) return
    const data = event.data
    if (!data || data.type !== 'block') return

    this.ring.write(data.left, data.right, data.startFrame, data.frameCount)
    this.lastBlockTime = this.context.currentTime
    this.loadFailureReason = null
    this.triedStallRecovery = false

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
    if (this.disposed) return
    const node = this.captureNode
    if (!node) {
      this.source = source
      return
    }
    if (this.source === source) return
    try {
      this.source?.disconnect(node)
    } catch {
      // Already disconnected — nothing to undo.
    }
    this.source = source
    source.connect(node)
    this.ring.reset(this.ring.writeFrame)
    this.lastBlockTime = this.context.currentTime
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
    if (this.node && this.captureStalled() && !this.triedStallRecovery) {
      this.triedStallRecovery = true
      this.startFallback('workletStalled')
    }
    if (this.disposed || !this.captureNode || this.captureStalled()) return null
    return this.ring.readLatest(frameCount, audioTimeSeconds)
  }

  getStatus(): StereoScopeCaptureStatus {
    const available = this.ring.availableFrames
    const active = !this.disposed && this.captureNode != null && available > 0 && !this.captureStalled()
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
    if (this.captureStalled()) return this.node ? 'workletStalled' : 'fallbackStalled'
    if (this.loadFailureReason) return this.loadFailureReason
    return 'awaitingFirstBlock'
  }

  private captureStalled(): boolean {
    return this.captureNode != null && this.context.currentTime - this.lastBlockTime >= CAPTURE_STALL_SECONDS
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.disconnectCapture()
    this.source = null
    this.ring.reset()
  }

  private disconnectCapture(): void {
    const node = this.captureNode
    if (this.node) this.node.port.onmessage = null
    if (this.fallback) {
      this.fallback.node.onaudioprocess = null
      try { this.fallback.sink.disconnect() } catch { /* The graph may already be closed. */ }
    }
    if (node) {
      try { this.source?.disconnect(node) } catch { /* The source may already be disconnected. */ }
      try { node.disconnect() } catch { /* A zero-output worklet has no downstream node. */ }
    }
    this.node = null
    this.fallback = null
  }
}
