/**
 * AudioWorkletProcessor: ring-buffer-processor
 *
 * Accumulates incoming mono audio samples into 4096-sample batches, then
 * transfers each batch to the main thread via the message port.
 *
 * Running on the audio worklet thread keeps sample accumulation off the
 * browser main thread, eliminating a ScriptProcessorNode that previously
 * competed with video rendering at ~11 callbacks/second.
 *
 * Node configuration: 1 input (mono, channel 0), 0 outputs.
 * Per the Web Audio spec an AudioNode with zero outputs remains active as
 * long as any of its inputs are active — no connection to AudioDestination
 * is required for the processor to run.
 */
class RingBufferProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf = new Float32Array(4096)
    this._pos = 0
  }

  process(inputs) {
    const ch = inputs[0]?.[0]
    if (!ch) return true

    for (let i = 0; i < ch.length; i++) {
      this._buf[this._pos++] = ch[i]
      if (this._pos === 4096) {
        // Copy and transfer ownership — zero-copy hand-off to main thread.
        const out = this._buf.slice(0)
        this.port.postMessage({ samples: out }, [out.buffer])
        this._pos = 0
      }
    }
    return true  // keep processor alive
  }
}

registerProcessor('ring-buffer-processor', RingBufferProcessor)
