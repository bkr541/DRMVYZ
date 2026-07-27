/**
 * AudioWorkletProcessor: stereo-scope-processor
 *
 * Phase-accurate stereo capture for the Sound Drawing professional scope core.
 *
 * Left and right samples are read from the SAME input render quantum, so the
 * pair (left[i], right[i]) is a genuine stereo sample pair. This is the property
 * that a vectorscope needs and that two independent AnalyserNodes behind a
 * ChannelSplitter cannot guarantee (each analyser snapshots on its own
 * getFloatTimeDomainData() call, with no alignment contract between them).
 *
 * Separate from ring-buffer-processor.js, which stays a mono 4096-sample tap for
 * the existing 60-second analysis ring buffer. Two processors with different
 * batch sizes and channel counts are cheaper and clearer than one overloaded
 * processor, and keeping them apart means scope work cannot regress the existing
 * loaded-track analysis path.
 *
 * Node configuration: 1 input (stereo), 0 outputs. Per the Web Audio spec an
 * AudioNode with zero outputs stays active as long as an input is active, so no
 * connection to the destination is needed — and none is made, which is what
 * guarantees this tap can never alter the audible signal.
 *
 * Transport: transferable Float32Array blocks with main-thread recycling.
 * SharedArrayBuffer would avoid the copy entirely but requires cross-origin
 * isolation headers that are not guaranteed in every DRMVYZ host (browser dev
 * server, packaged Electron, preview builds), so the portable path is used.
 * Buffers are pooled and returned by the main thread, so steady-state capture
 * performs no allocation on the audio thread.
 */

/** Sample frames per posted block. ~21 ms at 48 kHz → ~47 messages/second. */
const BLOCK_FRAMES = 1024

/** Upper bound on pooled buffer pairs. Prevents unbounded growth if the main thread stalls. */
const MAX_POOLED_PAIRS = 8

class StereoScopeProcessor extends AudioWorkletProcessor {
  constructor() {
    super()

    this._left = new Float32Array(BLOCK_FRAMES)
    this._right = new Float32Array(BLOCK_FRAMES)
    this._pos = 0

    /** Frame index (in `currentFrame` units) of _left[0] / _right[0]. */
    this._blockStartFrame = 0
    this._blockStartCaptured = false

    /** Recycled {left, right} pairs returned by the main thread. */
    this._pool = []

    /** Blocks dropped because no buffer was available. Reported with the next block. */
    this._droppedBlocks = 0

    this.port.onmessage = (event) => {
      const data = event.data
      if (!data || data.type !== 'recycle') return
      if (this._pool.length >= MAX_POOLED_PAIRS) return
      const left = data.left
      const right = data.right
      // Reject anything that is not a correctly sized pair — a mismatched buffer
      // would silently truncate captures.
      if (!(left instanceof Float32Array) || !(right instanceof Float32Array)) return
      if (left.length !== BLOCK_FRAMES || right.length !== BLOCK_FRAMES) return
      this._pool.push({ left, right })
    }
  }

  /**
   * Takes the next output pair. Returns null when the pool is exhausted, which
   * is treated as a dropped block rather than an audio-thread allocation.
   */
  _takePair() {
    return this._pool.length > 0 ? this._pool.pop() : null
  }

  _flush() {
    const pair = this._takePair()
    if (!pair) {
      this._droppedBlocks++
      this._pos = 0
      this._blockStartCaptured = false
      return
    }

    const outLeft = pair.left
    const outRight = pair.right
    outLeft.set(this._left)
    outRight.set(this._right)

    this.port.postMessage(
      {
        type: 'block',
        left: outLeft,
        right: outRight,
        frameCount: BLOCK_FRAMES,
        startFrame: this._blockStartFrame,
        sampleRate,
        droppedBlocks: this._droppedBlocks,
      },
      [outLeft.buffer, outRight.buffer],
    )

    this._droppedBlocks = 0
    this._pos = 0
    this._blockStartCaptured = false
  }

  process(inputs) {
    const input = inputs[0]
    const left = input && input[0]
    if (!left) return true

    // Duplicate mono into R only when the source genuinely has one channel.
    // A silent second channel is a real stereo signal and must stay silent.
    const right = input.length > 1 && input[1] ? input[1] : left

    const quantumStartFrame = currentFrame

    for (let i = 0; i < left.length; i++) {
      if (!this._blockStartCaptured) {
        this._blockStartFrame = quantumStartFrame + i
        this._blockStartCaptured = true
      }
      this._left[this._pos] = left[i]
      this._right[this._pos] = right[i]
      this._pos++
      if (this._pos === BLOCK_FRAMES) this._flush()
    }

    return true // sink node — stay alive
  }
}

registerProcessor('stereo-scope-processor', StereoScopeProcessor)
